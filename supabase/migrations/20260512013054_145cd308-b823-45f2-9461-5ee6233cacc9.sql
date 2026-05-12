
DO $$ BEGIN
  CREATE TYPE public.salary_deal_status AS ENUM ('active','paused','ended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.affiliate_salary_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL,
  name text NOT NULL,
  status public.salary_deal_status NOT NULL DEFAULT 'active',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  salary_amount numeric NOT NULL DEFAULT 0,
  salary_currency text NOT NULL DEFAULT 'EUR',
  cpa_bonus_amount numeric DEFAULT 0,
  cpa_bonus_threshold integer DEFAULT 0,
  selections jsonb NOT NULL DEFAULT '[]'::jsonb,
  breakeven_ftd_monthly integer DEFAULT 0,
  trigger_min_ftd_monthly integer,
  trigger_breakeven_pct numeric,
  trigger_min_ngr_per_ftd numeric,
  trial_months integer DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salary_deals_affiliate ON public.affiliate_salary_deals(affiliate_id);

ALTER TABLE public.affiliate_salary_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salary deals read" ON public.affiliate_salary_deals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "salary deals write" ON public.affiliate_salary_deals
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_salary_deals_touch
  BEFORE UPDATE ON public.affiliate_salary_deals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
