
-- Operator/campaign IDs per affiliate per client
CREATE TABLE public.affiliate_operator_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL,
  client_id uuid NOT NULL,
  operator_campaign_id text NOT NULL,
  brand text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, operator_campaign_id)
);
ALTER TABLE public.affiliate_operator_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operator ids read" ON public.affiliate_operator_ids FOR SELECT TO authenticated USING (true);
CREATE POLICY "operator ids write" ON public.affiliate_operator_ids FOR ALL TO authenticated USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));

-- Closures
CREATE TYPE public.closure_status AS ENUM ('draft','confirmed','paid');

CREATE TABLE public.commission_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  period text NOT NULL, -- YYYY-MM
  source_file_path text,
  source_file_name text,
  status public.closure_status NOT NULL DEFAULT 'draft',
  currency text,
  total_commission numeric DEFAULT 0,
  total_qualified integer DEFAULT 0,
  total_locked integer DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commission_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "closures read" ON public.commission_closures FOR SELECT TO authenticated USING (true);
CREATE POLICY "closures write" ON public.commission_closures FOR ALL TO authenticated USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));
CREATE TRIGGER trg_closures_updated BEFORE UPDATE ON public.commission_closures FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.commission_closure_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_id uuid NOT NULL REFERENCES public.commission_closures(id) ON DELETE CASCADE,
  affiliate_id uuid,
  raw_campaign_name text,
  raw_campaign_id text,
  brand text,
  qualified_players integer DEFAULT 0,
  locked_players integer DEFAULT 0,
  cpa_amount numeric DEFAULT 0,
  revshare_amount numeric DEFAULT 0,
  commission_total numeric DEFAULT 0,
  currency text,
  match_status text NOT NULL DEFAULT 'unmatched', -- auto_id | auto_alias | manual | unmatched
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commission_closure_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "closure items read" ON public.commission_closure_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "closure items write" ON public.commission_closure_items FOR ALL TO authenticated USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));
CREATE TRIGGER trg_closure_items_updated BEFORE UPDATE ON public.commission_closure_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_closure_items_closure ON public.commission_closure_items(closure_id);
CREATE INDEX idx_closure_items_affiliate ON public.commission_closure_items(affiliate_id);
CREATE INDEX idx_op_ids_affiliate ON public.affiliate_operator_ids(affiliate_id);

-- Storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('commission-reports', 'commission-reports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "commission reports read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'commission-reports');
CREATE POLICY "commission reports write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'commission-reports' AND public.is_admin_or_super(auth.uid()));
CREATE POLICY "commission reports update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'commission-reports' AND public.is_admin_or_super(auth.uid()));
CREATE POLICY "commission reports delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'commission-reports' AND public.is_admin_or_super(auth.uid()));
