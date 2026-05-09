ALTER TABLE public.client_commission_plans
  ADD COLUMN IF NOT EXISTS baseline_currency text,
  ADD COLUMN IF NOT EXISTS cpa_currency text,
  ADD COLUMN IF NOT EXISTS cpl_currency text,
  ADD COLUMN IF NOT EXISTS wager_currency text;