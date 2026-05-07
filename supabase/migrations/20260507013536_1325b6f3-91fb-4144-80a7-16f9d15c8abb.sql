CREATE TABLE public.calculator_simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  prospect_name TEXT,
  country_id UUID,
  selections JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_fijo_usd NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.calculator_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sims read own or admin"
ON public.calculator_simulations FOR SELECT
TO authenticated
USING (created_by = auth.uid() OR is_admin_or_super(auth.uid()));

CREATE POLICY "Sims insert own"
ON public.calculator_simulations FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Sims update own or admin"
ON public.calculator_simulations FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR is_admin_or_super(auth.uid()));

CREATE POLICY "Sims delete own or admin"
ON public.calculator_simulations FOR DELETE
TO authenticated
USING (created_by = auth.uid() OR is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_calc_sims_updated_at
BEFORE UPDATE ON public.calculator_simulations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_calc_sims_created_by ON public.calculator_simulations(created_by);
CREATE INDEX idx_calc_sims_created_at ON public.calculator_simulations(created_at DESC);