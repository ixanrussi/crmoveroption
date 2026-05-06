ALTER TABLE public.client_commission_plans
  ADD COLUMN IF NOT EXISTS overoption_retention numeric;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS net_min_cpa numeric;