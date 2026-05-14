CREATE POLICY "Comercial insert prospect clients"
ON public.clients FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'comercial'::app_role)
  AND status = 'prospect'::client_status
  AND created_by = auth.uid()
);

CREATE POLICY "Comercial update own prospect clients"
ON public.clients FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'comercial'::app_role)
  AND status = 'prospect'::client_status
  AND created_by = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'comercial'::app_role)
  AND status = 'prospect'::client_status
  AND created_by = auth.uid()
);

CREATE POLICY "Comercial insert prospect affiliates"
ON public.affiliates FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'comercial'::app_role)
  AND status = 'prospect'::affiliate_status
  AND created_by = auth.uid()
);

CREATE POLICY "Comercial update own prospect affiliates"
ON public.affiliates FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'comercial'::app_role)
  AND status = 'prospect'::affiliate_status
  AND created_by = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'comercial'::app_role)
  AND status = 'prospect'::affiliate_status
  AND created_by = auth.uid()
);