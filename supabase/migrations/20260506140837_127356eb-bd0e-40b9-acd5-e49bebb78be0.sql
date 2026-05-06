ALTER TABLE public.client_commission_plans DROP COLUMN IF EXISTS cpa_at_20;
ALTER TABLE public.client_commission_plans ADD COLUMN IF NOT EXISTS cpa_at_80 numeric;