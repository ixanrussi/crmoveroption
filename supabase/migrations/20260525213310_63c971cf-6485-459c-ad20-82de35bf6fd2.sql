DROP POLICY IF EXISTS "atl write" ON public.affiliate_tracking_links;
CREATE POLICY "atl write" ON public.affiliate_tracking_links
FOR ALL TO authenticated
USING (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'comercial'))
WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'comercial'));