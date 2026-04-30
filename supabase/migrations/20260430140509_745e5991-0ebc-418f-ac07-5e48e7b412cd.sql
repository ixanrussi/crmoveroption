ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS country_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.clients
SET country_ids = ARRAY[country_id]
WHERE country_id IS NOT NULL
  AND (country_ids IS NULL OR array_length(country_ids, 1) IS NULL);