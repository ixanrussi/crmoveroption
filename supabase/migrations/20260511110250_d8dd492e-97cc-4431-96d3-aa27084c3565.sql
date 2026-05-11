CREATE TABLE public.role_menu_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role app_role NOT NULL,
  menu_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, menu_key)
);

ALTER TABLE public.role_menu_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role menu perms read"
  ON public.role_menu_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Role menu perms write"
  ON public.role_menu_permissions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Default permissions reflecting current behavior
-- admin: all main + all listas + conocimiento (no usuarios/logs which are super_admin-only anyway)
INSERT INTO public.role_menu_permissions (role, menu_key) VALUES
  ('admin', 'dashboard'),
  ('admin', 'clientes'),
  ('admin', 'afiliados'),
  ('admin', 'planes-comision'),
  ('admin', 'cierres'),
  ('admin', 'comisiones-dashboard'),
  ('admin', 'calculadora-fijos'),
  ('admin', 'tracker-report'),
  ('admin', 'listas-paises'),
  ('admin', 'listas-software'),
  ('admin', 'listas-canales'),
  ('admin', 'listas-monedas'),
  ('admin', 'conocimiento'),
  ('user', 'dashboard'),
  ('user', 'clientes'),
  ('user', 'afiliados'),
  ('user', 'planes-comision'),
  ('user', 'cierres'),
  ('user', 'comisiones-dashboard'),
  ('user', 'calculadora-fijos'),
  ('user', 'tracker-report'),
  ('comercial', 'calculadora-fijos');