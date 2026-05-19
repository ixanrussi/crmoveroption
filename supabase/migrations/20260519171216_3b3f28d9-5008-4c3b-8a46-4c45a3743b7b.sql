ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS routy_account_id text;
CREATE INDEX IF NOT EXISTS idx_clients_routy_account_id ON public.clients(routy_account_id);