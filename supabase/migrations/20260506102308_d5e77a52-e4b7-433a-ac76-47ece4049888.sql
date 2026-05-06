ALTER TABLE public.affiliates 
  ADD COLUMN IF NOT EXISTS fixed_remuneration numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fixed_remuneration_currency text;