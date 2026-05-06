ALTER TABLE public.client_commission_plans
  ADD COLUMN IF NOT EXISTS fallback_cpa numeric,
  ADD COLUMN IF NOT EXISTS cpa_at_20 numeric,
  ADD COLUMN IF NOT EXISTS cpa_at_90 numeric;