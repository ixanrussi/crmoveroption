
# Migração de dados Lovable Cloud → Lovable Cloud (outra conta)

Lovable Cloud não tem hoje um botão "exportar/importar projeto" entre contas. A migração é feita manualmente em 4 blocos: **schema**, **dados**, **storage** e **configuração** (secrets, auth, edge functions). Como o novo projeto já tem Cloud habilitado, ele já tem seu próprio backend vazio pronto para receber.

## Pré-requisitos

- Acesso de owner aos **dois** projetos Lovable.
- Ambos com Lovable Cloud habilitado (✅ confirmado neste).
- `psql` e `pg_dump` instalados localmente (vêm com Postgres client).
- Strings de conexão de banco de **ambos** os projetos. No Lovable: **Cloud → Database → Connection string** (use a connection string "Session pooler" ou direta, não a "Transaction pooler", porque `pg_dump` precisa de sessão).

## 1. Schema (estrutura)

A forma mais limpa e suportada é **reaplicar as migrations** no projeto novo, não fazer `pg_dump` de schema bruto. Motivo: o Cloud novo já tem o schema base do Supabase (auth, storage, realtime). Despejar tudo gera conflito.

Passos:
1. No projeto novo (Lovable da outra conta), abrir o chat e pedir: "aplica todas as migrations existentes em `supabase/migrations/`". O agente vai rodar as 1+N migrations em ordem.
2. Alternativa manual: copiar a pasta `supabase/migrations/` para o repo do novo projeto e deixar o Lovable executá-las.

Resultado: tabelas, enums, funções (`has_role`, `is_admin_or_super`, triggers de activity log, etc.), RLS, grants — tudo recriado idêntico.

## 2. Dados (linhas das tabelas)

Usar `pg_dump` só de dados (`--data-only`) das tabelas do schema `public`, e restaurar no novo. Importante: **excluir** tabelas do Supabase (`auth.*`, `storage.*`) e desligar triggers durante o restore para não disparar `activity_logs` e `handle_new_user`.

```bash
# dump apenas dados do schema public
pg_dump "postgres://postgres:SENHA@HOST_ATUAL:5432/postgres" \
  --data-only \
  --schema=public \
  --disable-triggers \
  --no-owner --no-privileges \
  -f data.sql

# restore no novo
psql "postgres://postgres:SENHA@HOST_NOVO:5432/postgres" -f data.sql
```

Pontos de atenção:
- IDs (`uuid`) são preservados → bom, mantém referências entre tabelas.
- `auth.users` **não** é migrado por esta etapa (ver bloco 4).
- Se houver FKs para `auth.users` (ex.: `created_by`), os usuários precisam existir no novo projeto antes do restore, senão restore falha. Por isso bloco 4 vem primeiro na prática.
- Sequences (`affiliate_id_seq`) precisam ser reajustadas: rodar `SELECT setval('public.affiliate_id_seq', (SELECT max(...) FROM ...));` depois.

## 3. Storage (arquivos)

Os 5 buckets (`avatars`, `commission-reports`, `client-knowledge`, `operator-logos`, `affiliate-avatars`) precisam ser:
1. **Recriados** no projeto novo com mesma visibilidade (public/private). Pode ser via migration SQL ou via UI Cloud.
2. **Conteúdo copiado** com a CLI do Supabase ou script Node usando service_role key dos dois projetos:
   - listar objetos do bucket origem
   - baixar
   - subir no bucket destino com mesmo path

Caminhos armazenados no banco (`avatar_url`, `logo_url`, `file_path`) continuam válidos se buckets e paths se mantêm.

## 4. Usuários de autenticação

`auth.users` é o mais sensível. Duas opções:

**a) Migração assistida (recomendado):** usar a API admin do Supabase do projeto antigo para listar usuários e recriá-los no novo via `auth.admin.createUser` mantendo o mesmo `id`. Senhas hash podem ser migradas com `password_hash` no createUser. Faço um edge function temporário que lê do antigo (service_role antigo como secret) e escreve no novo.

**b) Reset:** usuários recriam contas no novo. Mais simples mas perde histórico de login e quebra FKs (`created_by`, `user_id`).

Depois disso, repopular `public.user_roles` (vem do dump de dados do bloco 2).

## 5. Secrets, Auth providers, Edge Functions

- **Edge functions**: já estão no repo (`supabase/functions/*`). Ao abrir o projeto novo no Lovable e fazer qualquer deploy, elas sobem automaticamente.
- **Secrets** (`ROUTY_TOKEN`, etc.): precisam ser adicionados manualmente no projeto novo via Cloud → Secrets ou pelo chat. `LOVABLE_API_KEY`, `SUPABASE_*` são auto-provisionados.
- **Auth providers** (Google, etc.): reconfigurar no projeto novo (Cloud → Users → Auth Settings).
- **Custom domain**: re-apontar para o novo projeto quando estiver pronto.

## Ordem recomendada de execução

```text
1. No projeto NOVO: aplicar migrations  → schema pronto
2. Adicionar secrets + auth providers   → infra pronta
3. Recriar buckets + copiar arquivos    → storage pronto
4. Migrar auth.users (mesmos IDs)       → users prontos
5. Restaurar dados public (data-only)   → dados prontos
6. Reajustar sequences                  → IDs auto consistentes
7. Smoke test: login, listagens, RLS    → validação
8. Trocar URL pública / domínio         → cutover
```

## O que preciso de você antes de executar

1. Confirmar se quer **migrar usuários mantendo o mesmo `id`** (recomendo sim — preserva todos os `created_by` e roles) ou se aceita que cada usuário se recadastre.
2. Me passar (ou colar quando começarmos) as **duas connection strings** do banco — origem e destino. Não as cole agora se não quiser; pode esperar até estarmos no projeto novo.
3. Confirmar se o projeto novo está **vazio** (sem nenhuma migration aplicada além do default), ou se já tem alguma estrutura que precisa ser preservada.

Quando me confirmar, eu te guio comando por comando — boa parte da execução acontece **no chat do projeto novo**, não neste.
