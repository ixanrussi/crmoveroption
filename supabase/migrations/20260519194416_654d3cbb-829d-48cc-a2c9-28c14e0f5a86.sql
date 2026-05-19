ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('affiliate-avatars', 'affiliate-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "affiliate avatars public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'affiliate-avatars');

CREATE POLICY "affiliate avatars admin insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'affiliate-avatars' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));

CREATE POLICY "affiliate avatars admin update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'affiliate-avatars' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));

CREATE POLICY "affiliate avatars admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'affiliate-avatars' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));