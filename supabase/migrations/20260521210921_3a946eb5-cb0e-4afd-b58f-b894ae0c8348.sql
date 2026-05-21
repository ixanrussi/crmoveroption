ALTER TABLE public.client_commission_plans
  ADD COLUMN IF NOT EXISTS fixed_remuneration NUMERIC,
  ADD COLUMN IF NOT EXISTS fixed_remuneration_currency TEXT,
  ADD COLUMN IF NOT EXISTS fixed_remuneration_min_ftd INTEGER,
  ADD COLUMN IF NOT EXISTS fixed_remuneration_fallback_cpa NUMERIC,
  ADD COLUMN IF NOT EXISTS fixed_remuneration_fallback_cpa_currency TEXT,
  ADD COLUMN IF NOT EXISTS fixed_remuneration_installments JSONB NOT NULL DEFAULT '[]'::jsonb;