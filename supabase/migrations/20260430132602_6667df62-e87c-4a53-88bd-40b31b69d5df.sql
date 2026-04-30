CREATE TABLE public.client_commission_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL,
  plan_start_date date,
  currency text,
  description text,
  country_id uuid,
  brand text,
  baseline numeric,
  cpa numeric,
  rev_share_pct numeric,
  cpl numeric,
  wager_type text CHECK (wager_type IN ('NCO','NNCO')),
  cap integer,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.client_commission_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Commission plans read" ON public.client_commission_plans
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Commission plans write" ON public.client_commission_plans
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER touch_commission_plans_updated_at
  BEFORE UPDATE ON public.client_commission_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_commission_plans_client ON public.client_commission_plans(client_id);