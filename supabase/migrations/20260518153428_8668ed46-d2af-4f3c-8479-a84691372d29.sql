
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_count INT;
  matched_affiliate UUID;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_active)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), false);

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
    UPDATE public.profiles SET is_active = true WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- Auto-link to affiliate when email matches a registered affiliate
  SELECT id INTO matched_affiliate FROM public.affiliates
   WHERE lower(email) = lower(NEW.email)
   LIMIT 1;

  IF matched_affiliate IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'affiliate');
    UPDATE public.profiles SET is_active = true WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
