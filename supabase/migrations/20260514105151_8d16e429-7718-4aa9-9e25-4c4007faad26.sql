-- Status enum
DO $$ BEGIN
  CREATE TYPE public.tracking_link_request_status AS ENUM ('pending','created','rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE public.tracking_link_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL,
  client_id uuid NOT NULL,
  brand text,
  country_id uuid,
  status public.tracking_link_request_status NOT NULL DEFAULT 'pending',
  tracking_link text,
  notes text,
  admin_notes text,
  requested_by uuid NOT NULL,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tlr_status ON public.tracking_link_requests(status);
CREATE INDEX idx_tlr_requested_by ON public.tracking_link_requests(requested_by);

ALTER TABLE public.tracking_link_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tlr read all"
ON public.tracking_link_requests FOR SELECT
TO authenticated USING (true);

CREATE POLICY "tlr comercial insert own"
ON public.tracking_link_requests FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND (has_role(auth.uid(),'comercial') OR is_admin_or_super(auth.uid()))
);

CREATE POLICY "tlr comercial update own pending"
ON public.tracking_link_requests FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(),'comercial')
  AND requested_by = auth.uid()
  AND status = 'pending'
)
WITH CHECK (
  has_role(auth.uid(),'comercial')
  AND requested_by = auth.uid()
  AND status = 'pending'
);

CREATE POLICY "tlr admin update all"
ON public.tracking_link_requests FOR UPDATE
TO authenticated
USING (is_admin_or_super(auth.uid()))
WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "tlr super delete"
ON public.tracking_link_requests FOR DELETE
TO authenticated
USING (has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_tlr_touch
BEFORE UPDATE ON public.tracking_link_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_tlr_log
AFTER INSERT OR UPDATE OR DELETE ON public.tracking_link_requests
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Permission to show menu for comercial role
INSERT INTO public.role_menu_permissions (role, menu_key)
VALUES ('comercial','solicitar-links'), ('admin','solicitar-links'), ('user','solicitar-links')
ON CONFLICT DO NOTHING;