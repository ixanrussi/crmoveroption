CREATE POLICY "Comercial insert affiliate channels"
ON public.affiliate_channels
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'comercial'::app_role));