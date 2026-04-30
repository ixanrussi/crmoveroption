-- Trigger para generar unique_id en affiliates
DROP TRIGGER IF EXISTS trg_set_affiliate_unique_id ON public.affiliates;
CREATE TRIGGER trg_set_affiliate_unique_id
BEFORE INSERT ON public.affiliates
FOR EACH ROW
EXECUTE FUNCTION public.set_affiliate_unique_id();

-- Trigger para proteger campos fijos en affiliates
DROP TRIGGER IF EXISTS trg_protect_affiliate_fixed_fields ON public.affiliates;
CREATE TRIGGER trg_protect_affiliate_fixed_fields
BEFORE UPDATE ON public.affiliates
FOR EACH ROW
EXECUTE FUNCTION public.protect_affiliate_fixed_fields();

-- Trigger updated_at en affiliates
DROP TRIGGER IF EXISTS trg_affiliates_updated_at ON public.affiliates;
CREATE TRIGGER trg_affiliates_updated_at
BEFORE UPDATE ON public.affiliates
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

-- Trigger updated_at en clients (si existe)
DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

-- Trigger handle_new_user en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();