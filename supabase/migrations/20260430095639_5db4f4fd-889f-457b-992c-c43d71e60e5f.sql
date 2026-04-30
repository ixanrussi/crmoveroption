ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS client_type text,
ADD COLUMN IF NOT EXISTS brands text[] NOT NULL DEFAULT '{}';