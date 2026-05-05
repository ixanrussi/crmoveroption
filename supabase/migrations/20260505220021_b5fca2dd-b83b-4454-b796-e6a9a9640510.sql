CREATE TABLE public.commission_closure_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closure_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'info',
  source TEXT NOT NULL DEFAULT 'auto',
  message TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_ccf_closure ON public.commission_closure_feedback(closure_id);
ALTER TABLE public.commission_closure_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback read" ON public.commission_closure_feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "feedback write" ON public.commission_closure_feedback FOR ALL TO authenticated USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));