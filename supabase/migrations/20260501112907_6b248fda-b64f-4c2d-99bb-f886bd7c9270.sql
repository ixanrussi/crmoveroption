CREATE TABLE IF NOT EXISTS public.affiliate_commission_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  plan_start_date date,
  currency text,
  description text,
  country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  brand text,
  baseline numeric,
  cpa numeric,
  rev_share_pct numeric,
  cpl numeric,
  wager numeric,
  conversion_type text,
  cap integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS brands text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.affiliate_commission_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aff commission plans read" ON public.affiliate_commission_plans
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Aff commission plans write" ON public.affiliate_commission_plans
  FOR ALL TO authenticated USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_aff_comm_plans_affiliate ON public.affiliate_commission_plans(affiliate_id);

NOTIFY pgrst, 'reload schema';