
CREATE TABLE public.affiliate_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL,
  scope TEXT NOT NULL DEFAULT 'general', -- 'general' | 'monthly'
  period TEXT,        -- 'YYYY-MM' when scope = 'monthly'
  client_id UUID,     -- optional
  brand TEXT,         -- optional
  ftd_target INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_aff_goals_aff ON public.affiliate_goals(affiliate_id);
CREATE INDEX idx_aff_goals_period ON public.affiliate_goals(period);

ALTER TABLE public.affiliate_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Goals read" ON public.affiliate_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Goals write" ON public.affiliate_goals FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_aff_goals_touch BEFORE UPDATE ON public.affiliate_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_log_aff_goals AFTER INSERT OR UPDATE OR DELETE ON public.affiliate_goals
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
