
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user');
CREATE TYPE public.client_status AS ENUM ('active', 'inactive', 'prospect');
CREATE TYPE public.affiliate_status AS ENUM ('active', 'inactive', 'pending');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  job_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role checker (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','super_admin')
  )
$$;

-- ============ LOOKUP LISTS ============
CREATE TABLE public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.softwares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.softwares ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.affiliate_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.affiliate_channels ENABLE ROW LEVEL SECURITY;

-- ============ AFFILIATES ============
CREATE SEQUENCE public.affiliate_id_seq START 1;

CREATE TABLE public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unique_id TEXT NOT NULL UNIQUE,
  fixed_name TEXT NOT NULL,
  alias TEXT,
  email TEXT,
  phone TEXT,
  country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  status affiliate_status NOT NULL DEFAULT 'active',
  commission_pct NUMERIC(5,2) DEFAULT 0,
  payment_method TEXT,
  bank_details TEXT,
  tax_id TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

-- Auto-generate unique_id (OVO-00001)
CREATE OR REPLACE FUNCTION public.set_affiliate_unique_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.unique_id IS NULL OR NEW.unique_id = '' THEN
    NEW.unique_id := 'OVO-' || LPAD(nextval('public.affiliate_id_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_affiliate_unique_id
BEFORE INSERT ON public.affiliates
FOR EACH ROW EXECUTE FUNCTION public.set_affiliate_unique_id();

-- Protect fixed_name and unique_id from edits unless super_admin
CREATE OR REPLACE FUNCTION public.protect_affiliate_fixed_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.unique_id IS DISTINCT FROM OLD.unique_id
     OR NEW.fixed_name IS DISTINCT FROM OLD.fixed_name THEN
    IF NOT public.has_role(auth.uid(), 'super_admin') THEN
      RAISE EXCEPTION 'Solo el super admin puede modificar el ID único o el nombre fijo del afiliado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_protect_affiliate
BEFORE UPDATE ON public.affiliates
FOR EACH ROW EXECUTE FUNCTION public.protect_affiliate_fixed_fields();

-- Affiliate channels (many-to-many)
CREATE TABLE public.affiliate_channel_links (
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.affiliate_channels(id) ON DELETE CASCADE,
  PRIMARY KEY (affiliate_id, channel_id)
);
ALTER TABLE public.affiliate_channel_links ENABLE ROW LEVEL SECURITY;

-- ============ CLIENTS ============
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  address TEXT,
  country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE SET NULL,
  status client_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.client_software_links (
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  software_id UUID NOT NULL REFERENCES public.softwares(id) ON DELETE CASCADE,
  PRIMARY KEY (client_id, software_id)
);
ALTER TABLE public.client_software_links ENABLE ROW LEVEL SECURITY;

-- ============ TRIGGERS: updated_at ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_affiliates_updated BEFORE UPDATE ON public.affiliates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ AUTO PROFILE + FIRST USER = SUPER ADMIN ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles: own read/update; admins read all
CREATE POLICY "Own profile select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin_or_super(auth.uid()));

-- user_roles: read by self/admins; only super_admin manages
CREATE POLICY "Roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "Super admin insert role" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin update role" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin delete role" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Lookup lists: all authenticated read; admins write
CREATE POLICY "Countries read" ON public.countries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Countries write" ON public.countries FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Softwares read" ON public.softwares FOR SELECT TO authenticated USING (true);
CREATE POLICY "Softwares write" ON public.softwares FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Channels read" ON public.affiliate_channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Channels write" ON public.affiliate_channels FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

-- Affiliates: all authenticated read; admins write
CREATE POLICY "Affiliates read" ON public.affiliates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Affiliates insert" ON public.affiliates FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Affiliates update" ON public.affiliates FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Affiliates delete" ON public.affiliates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Aff channels read" ON public.affiliate_channel_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Aff channels write" ON public.affiliate_channel_links FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

-- Clients
CREATE POLICY "Clients read" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Clients insert" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Clients update" ON public.clients FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Clients delete" ON public.clients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Cli software read" ON public.client_software_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cli software write" ON public.client_software_links FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
