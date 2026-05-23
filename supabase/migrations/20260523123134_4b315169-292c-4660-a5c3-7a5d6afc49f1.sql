ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS ext_id_oo text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ext_id_oo text;
CREATE UNIQUE INDEX IF NOT EXISTS affiliates_ext_id_oo_key ON public.affiliates (ext_id_oo) WHERE ext_id_oo IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_ext_id_oo_key ON public.clients (ext_id_oo) WHERE ext_id_oo IS NOT NULL;