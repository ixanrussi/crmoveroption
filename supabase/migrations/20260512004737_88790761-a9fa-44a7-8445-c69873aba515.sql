CREATE TABLE public.brand_cpa_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  period TEXT NOT NULL,
  cpa_target INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (brand, period)
);

ALTER TABLE public.brand_cpa_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand goals read" ON public.brand_cpa_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Brand goals write" ON public.brand_cpa_goals FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));

CREATE TRIGGER brand_cpa_goals_touch_updated_at
BEFORE UPDATE ON public.brand_cpa_goals
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();