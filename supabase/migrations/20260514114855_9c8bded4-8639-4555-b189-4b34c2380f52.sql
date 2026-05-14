-- Allow multiple links per (affiliate, channel) by changing PK to surrogate id
ALTER TABLE public.affiliate_channel_links DROP CONSTRAINT IF EXISTS affiliate_channel_links_pkey;
ALTER TABLE public.affiliate_channel_links ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.affiliate_channel_links ADD PRIMARY KEY (id);
-- Avoid exact duplicates of (affiliate, channel, link)
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_channel_links_unique_link
  ON public.affiliate_channel_links (affiliate_id, channel_id, COALESCE(link, ''));