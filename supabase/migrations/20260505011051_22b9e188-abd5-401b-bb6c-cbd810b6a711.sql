
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

-- Backfill from existing full_name
UPDATE public.profiles
SET first_name = COALESCE(first_name, NULLIF(split_part(full_name, ' ', 1), '')),
    last_name = COALESCE(last_name, NULLIF(NULLIF(regexp_replace(full_name, '^\S+\s*', ''), ''), full_name))
WHERE full_name IS NOT NULL AND full_name <> '';

-- Avatars bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Avatars public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Users manage their own avatar (folder = user id)
CREATE POLICY "Users upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
