
-- Activity log table for auditing data changes
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  diff JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_created ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_table ON public.activity_logs(table_name);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin reads logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Generic audit trigger
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_old JSONB;
  v_new JSONB;
  v_diff JSONB := '{}'::jsonb;
  v_record_id TEXT;
  k TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_record_id := COALESCE((v_old->>'id'), '');
    INSERT INTO public.activity_logs(user_id, user_email, action, table_name, record_id, old_data, new_data, diff)
    VALUES (v_user_id, v_email, TG_OP, TG_TABLE_NAME, v_record_id, v_old, NULL, NULL);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_record_id := COALESCE((v_new->>'id'), '');
    INSERT INTO public.activity_logs(user_id, user_email, action, table_name, record_id, old_data, new_data, diff)
    VALUES (v_user_id, v_email, TG_OP, TG_TABLE_NAME, v_record_id, NULL, v_new, NULL);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := COALESCE((v_new->>'id'), '');
    FOR k IN SELECT jsonb_object_keys(v_new) LOOP
      IF k IN ('updated_at') THEN CONTINUE; END IF;
      IF (v_new->k) IS DISTINCT FROM (v_old->k) THEN
        v_diff := v_diff || jsonb_build_object(k, jsonb_build_object('old', v_old->k, 'new', v_new->k));
      END IF;
    END LOOP;
    IF v_diff <> '{}'::jsonb THEN
      INSERT INTO public.activity_logs(user_id, user_email, action, table_name, record_id, old_data, new_data, diff)
      VALUES (v_user_id, v_email, TG_OP, TG_TABLE_NAME, v_record_id, v_old, v_new, v_diff);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach to the relevant data tables
CREATE TRIGGER trg_log_affiliates AFTER INSERT OR UPDATE OR DELETE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_log_clients AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_log_aff_plans AFTER INSERT OR UPDATE OR DELETE ON public.affiliate_commission_plans
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_log_cli_plans AFTER INSERT OR UPDATE OR DELETE ON public.client_commission_plans
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_log_closures AFTER INSERT OR UPDATE OR DELETE ON public.commission_closures
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_log_closure_items AFTER INSERT OR UPDATE OR DELETE ON public.commission_closure_items
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_log_op_ids AFTER INSERT OR UPDATE OR DELETE ON public.affiliate_operator_ids
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_log_aff_channels AFTER INSERT OR UPDATE OR DELETE ON public.affiliate_channel_links
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_log_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_log_kdocs AFTER INSERT OR UPDATE OR DELETE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_log_kfindings AFTER INSERT OR UPDATE OR DELETE ON public.knowledge_findings
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
