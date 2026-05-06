ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS fixed_remuneration_min_ftd integer,
  ADD COLUMN IF NOT EXISTS fixed_remuneration_fallback_cpa numeric;