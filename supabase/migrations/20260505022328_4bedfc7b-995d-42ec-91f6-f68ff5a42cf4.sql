ALTER TABLE public.client_commission_plans ADD COLUMN IF NOT EXISTS country_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

UPDATE public.client_commission_plans SET country_ids = ARRAY[country_id] WHERE country_id IS NOT NULL AND (country_ids IS NULL OR array_length(country_ids,1) IS NULL);