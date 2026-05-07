ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;
-- Existing users with at least one role are considered active
UPDATE public.profiles p SET is_active = true
WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id);