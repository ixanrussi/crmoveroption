ALTER TABLE public.affiliate_salary_deals
  DROP COLUMN IF EXISTS trigger_min_ngr_per_ftd,
  ADD COLUMN IF NOT EXISTS trigger_min_activity_ratio numeric,
  ADD COLUMN IF NOT EXISTS trigger_min_conversion_pct numeric,
  ADD COLUMN IF NOT EXISTS trigger_min_net_margin numeric;