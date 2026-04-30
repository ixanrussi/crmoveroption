
-- Fix mutable search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.set_affiliate_unique_id()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.unique_id IS NULL OR NEW.unique_id = '' THEN
    NEW.unique_id := 'OVO-' || LPAD(nextval('public.affiliate_id_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Revoke broad EXECUTE on SECURITY DEFINER fns; only RLS policies need them
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_super(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_affiliate_fixed_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
