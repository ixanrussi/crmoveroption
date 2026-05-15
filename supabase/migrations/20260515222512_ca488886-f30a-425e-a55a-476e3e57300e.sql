-- New table for affiliate tracking links per operator/brand
CREATE TABLE public.affiliate_tracking_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL,
  client_id UUID NOT NULL,
  brand TEXT,
  country_id UUID,
  tracking_link TEXT NOT NULL,
  operator_campaign_id TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'request'
  source_request_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_atl_affiliate ON public.affiliate_tracking_links(affiliate_id);
CREATE INDEX idx_atl_client ON public.affiliate_tracking_links(client_id);
CREATE INDEX idx_atl_affiliate_client_brand ON public.affiliate_tracking_links(affiliate_id, client_id, brand);

ALTER TABLE public.affiliate_tracking_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atl read" ON public.affiliate_tracking_links
FOR SELECT TO authenticated USING (true);

CREATE POLICY "atl write" ON public.affiliate_tracking_links
FOR ALL TO authenticated
USING (is_admin_or_super(auth.uid()))
WITH CHECK (is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_atl_updated_at
BEFORE UPDATE ON public.affiliate_tracking_links
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_atl_log
AFTER INSERT OR UPDATE OR DELETE ON public.affiliate_tracking_links
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Auto-fill from resolved tracking_link_requests
CREATE OR REPLACE FUNCTION public.sync_tracking_link_from_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'resolved'
     AND NEW.tracking_link IS NOT NULL
     AND NEW.tracking_link <> ''
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'resolved' OR OLD.tracking_link IS DISTINCT FROM NEW.tracking_link)
  THEN
    -- Avoid duplicate for same affiliate+client+brand+link
    IF NOT EXISTS (
      SELECT 1 FROM public.affiliate_tracking_links
      WHERE affiliate_id = NEW.affiliate_id
        AND client_id = NEW.client_id
        AND COALESCE(brand,'') = COALESCE(NEW.brand,'')
        AND tracking_link = NEW.tracking_link
    ) THEN
      INSERT INTO public.affiliate_tracking_links
        (affiliate_id, client_id, brand, country_id, tracking_link, source, source_request_id, created_by)
      VALUES
        (NEW.affiliate_id, NEW.client_id, NEW.brand, NEW.country_id, NEW.tracking_link, 'request', NEW.id, NEW.resolved_by);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tlr_sync_link
AFTER INSERT OR UPDATE ON public.tracking_link_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_tracking_link_from_request();