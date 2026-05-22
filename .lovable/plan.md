# Página de Performance del Afiliado

Nueva ruta `/afiliados/:id/performance` con acceso desde la lista de afiliados y desde `PortalAfiliado` (el afiliado solo ve la suya).

## Filosofía de métricas

- **Métrica principal: CPA cualificado** — número de FTDs que cumplen baseline + wagering y por los que el operador nos paga. Es el corazón de todos los KPIs y agregados.
- **NGR**: métrica secundaria de **calidad del tráfico** que entregamos al operador. Se muestra siempre acompañando a CPAs, no como número principal.
- Comisión generada y a pagar se derivan del CPA cualificado × tarifa del plan (operador) / plan del afiliado.

## Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Header: avatar · nombre · país · status · selector período   │
├──────────────────────────────────────────────────────────────┤
│ KPI principal (destacado, grande)                            │
│  ▸ CPAs cualificados en el período · vs período anterior     │
│  ▸ vs meta (affiliate_goals) — barra de progreso             │
├──────────────────────────────────────────────────────────────┤
│ KPI row secundaria (5 tarjetas)                              │
│ [Comisión generada €] [Comisión a pagar al aff €]            │
│ [Pagado] [Pendiente] [% Margen bruto OO]                     │
├──────────────────────────────────────────────────────────────┤
│ Card "Calidad del tráfico"                                   │
│  ▸ NGR total del período · NGR / CPA cualificado             │
│  ▸ Funnel: Visitas → Signups → FTDs → CPA cualificado        │
│  ▸ Tasas: signup%, FTD%, cualificación% (FTD→CPA cualif.)    │
├──────────────────────────────────────────────────────────────┤
│ Gráfico diario (líneas)                                      │
│ Eje izq: CPAs cualificados (barra) · Eje der: NGR (línea)    │
│ Toggle adicional: comisión generada                          │
├──────────────────────────────────────────────────────────────┤
│ Split: [CPAs por operador] | [CPAs por marca]                │
│ Barras horizontales · tabla con CPAs · NGR · Comisión        │
│ generada · Tarifa CPA aplicada · Moneda                      │
├──────────────────────────────────────────────────────────────┤
│ Tabla de cierres del período                                 │
│ Período · Operador · Marca · FTDs · CPAs cualif. · NGR ·     │
│ CPA tarifa · Total cobrado · Pagado al afiliado              │
├──────────────────────────────────────────────────────────────┤
│ Card "Pagos" (placeholder hasta integrar finanzas)           │
│ Total recibido · Pendiente · próxima fecha · histórico       │
└──────────────────────────────────────────────────────────────┘
```

## Definición exacta de KPIs

- **CPAs cualificados** = Σ `commission_closure_items.qualified_players` filtrado por `affiliate_id` y `report_type = 'cpa'` dentro del período. Es la cifra autoritativa (ya viene validada por baseline + wagering desde el operador).
- **Comisión generada** = Σ `commission_closure_items.commission_total` (CPA + RevShare) cobrada al operador, normalizada a EUR.
- **Comisión a pagar al afiliado** = calculada con `affiliate_commission_plans` del afiliado para ese operador/marca (CPA × cualificados + RevShare% × NGR + fijo/instalments aplicables) — no se asume igual a lo cobrado.
- **% Margen bruto OO** = (Comisión cobrada − Comisión a pagar al afiliado) ÷ margen bruto total de OO del período. Indicador con barra y delta vs período anterior.
- **NGR** = Σ `commission_closure_items.sports_ngr + casino_ngr` (cuando hay) o `netRevenue` de Routy si el cierre no lo tiene desglosado.
- **Calidad** = visitas → signups → FTDs (Routy) → CPAs cualificados (CRM). La última conversión (FTD→cualificado) es el verdadero indicador de calidad para el operador.

## Fuentes de datos

**CRM (Supabase):**
- `commission_closures` + `commission_closure_items` (autoritativo para CPAs cualificados, NGR y comisión).
- `affiliate_commission_plans` (tarifa CPA, revshare, fijo/instalments por operador+marca+país del afiliado).
- `affiliate_goals` (meta de CPAs/FTDs).
- `affiliates`, `clients` (cabecera y nombre/logo del operador).

**Routy (vía `routy-proxy` ya existente):**
- Solo para el funnel arriba del CPA: visits, signups, firstTimeDeposits, depositAmount, netRevenue por día/brand/operador.
- Por cada operador con `routy_account_id`, llamar `routy-proxy` y filtrar las filas pivotadas cuyo `tracker` coincida con `affiliates.unique_id`, `aliases` o `affiliate_operator_ids.operator_campaign_id`.

**Pagos (paso 2):**
- Nueva tabla `affiliate_payments` (afiliado, período, monto, moneda, status, fecha, referencia, proveedor) que alimenta la card de pagos. Mientras tanto, derivar "pagado" de `commission_closure_items.is_paid_to_affiliate = true`.

## Arquitectura técnica

- Ruta `/afiliados/:id/performance` en `src/App.tsx`, archivo `src/pages/AfiliadoPerformance.tsx`.
- Hook `useAffiliatePerformance(affiliateId, period)` con React Query: corre en paralelo los reads del CRM y las llamadas Routy por operador, luego agrega.
- Conversión a EUR usando `src/lib/fxRates.ts` con la moneda de cada plan/closure.
- Componentes Recharts (barras + línea combinadas), `Card`/`Badge`/`Progress`/`Table` de shadcn. Reutilizar el patrón visual de `MarketingFunnel` y `MonthlyCpaChart` del Dashboard.
- Permisos: admin/super ven cualquier afiliado; rol `affiliate` solo el suyo (validado contra `affiliates.email = profiles.email`).
- Acceso: botón "Performance" en cada card de `Afiliados.tsx` y CTA grande en `PortalAfiliado.tsx`.
- Sin cambios de schema en esta entrega; la tabla `affiliate_payments` se añade en el paso 2 cuando definamos la plataforma de finanzas.

## Entregables de esta iteración

1. Página `AfiliadoPerformance` con todas las secciones excepto pagos reales (placeholder + datos derivados de `is_paid_to_affiliate`).
2. Hook de agregación CRM + Routy con período seleccionable (Mes actual / Mes pasado / Trimestre / YTD / custom).
3. Enlaces de acceso desde lista de afiliados y portal del afiliado.

¿Confirmas para implementar, o quieres ajustar algún KPI / añadir desglose (p. ej. por país, por canal) antes?
