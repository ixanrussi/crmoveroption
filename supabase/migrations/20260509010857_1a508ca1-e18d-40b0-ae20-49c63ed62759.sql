
-- Catalog table for reusable commission plan templates
CREATE TABLE public.commission_plan_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  plan_start_date DATE,
  currency TEXT,
  client_id UUID,
  brand TEXT,
  country_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  baseline NUMERIC,
  baseline_currency TEXT,
  cpa NUMERIC,
  cpa_currency TEXT,
  rev_share_pct NUMERIC,
  cpl NUMERIC,
  cpl_currency TEXT,
  wager NUMERIC,
  wager_currency TEXT,
  conversion_type TEXT,
  cap INTEGER,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_plan_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tpl read" ON public.commission_plan_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tpl write" ON public.commission_plan_templates
  FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid()))
  WITH CHECK (is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_tpl_touch_updated_at
  BEFORE UPDATE ON public.commission_plan_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Traceability: which template a per-affiliate plan came from (nullable)
ALTER TABLE public.affiliate_commission_plans
  ADD COLUMN template_id UUID REFERENCES public.commission_plan_templates(id) ON DELETE SET NULL;
