CREATE TABLE public.affiliate_prospect_interests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid NOT NULL,
  client_id uuid NOT NULL,
  template_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_affiliate ON public.affiliate_prospect_interests(affiliate_id);
CREATE INDEX idx_api_client ON public.affiliate_prospect_interests(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_prospect_interests TO authenticated;
GRANT ALL ON public.affiliate_prospect_interests TO service_role;

ALTER TABLE public.affiliate_prospect_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api read" ON public.affiliate_prospect_interests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "api admin write" ON public.affiliate_prospect_interests
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "api comercial write own prospects" ON public.affiliate_prospect_interests
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'comercial'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_id
        AND a.status = 'prospect'::affiliate_status
        AND a.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'comercial'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_id
        AND a.status = 'prospect'::affiliate_status
        AND a.created_by = auth.uid()
    )
  );

CREATE TRIGGER trg_api_touch
  BEFORE UPDATE ON public.affiliate_prospect_interests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();