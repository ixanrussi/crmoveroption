ALTER TABLE public.client_commission_plans
ADD COLUMN IF NOT EXISTS proportional_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS proportional_min_pct numeric;