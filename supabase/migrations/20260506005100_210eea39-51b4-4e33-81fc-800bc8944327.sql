
-- Storage bucket for client knowledge files
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-knowledge', 'client-knowledge', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (authenticated users can read; admins can write/delete)
CREATE POLICY "client-knowledge read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-knowledge');

CREATE POLICY "client-knowledge insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-knowledge' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "client-knowledge update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'client-knowledge' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "client-knowledge delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-knowledge' AND public.is_admin_or_super(auth.uid()));

-- Tables
CREATE TABLE public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  category TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | analyzing | analyzed | failed
  analysis_summary TEXT,
  analysis_extracted JSONB,
  analysis_error TEXT,
  analyzed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_knowledge_documents_client ON public.knowledge_documents(client_id);
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kdoc read" ON public.knowledge_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "kdoc write" ON public.knowledge_documents FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_kdoc_updated BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.knowledge_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'question', -- question | inconsistency | warning | info
  severity TEXT NOT NULL DEFAULT 'medium', -- low | medium | high
  title TEXT NOT NULL,
  detail TEXT,
  context JSONB,
  status TEXT NOT NULL DEFAULT 'open', -- open | answered | resolved | dismissed
  answer TEXT,
  answered_by UUID,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kfindings_doc ON public.knowledge_findings(document_id);
CREATE INDEX idx_kfindings_client ON public.knowledge_findings(client_id);
ALTER TABLE public.knowledge_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kfind read" ON public.knowledge_findings FOR SELECT TO authenticated USING (true);
CREATE POLICY "kfind write" ON public.knowledge_findings FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_kfind_updated BEFORE UPDATE ON public.knowledge_findings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
