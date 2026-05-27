CREATE TABLE public.affiliate_casino_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL,
  client_id UUID NOT NULL,
  brand TEXT,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  balance NUMERIC,
  balance_currency TEXT,
  balance_notes TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_casino_accounts TO authenticated;
GRANT ALL ON public.affiliate_casino_accounts TO service_role;

ALTER TABLE public.affiliate_casino_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aca read" ON public.affiliate_casino_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "aca write" ON public.affiliate_casino_accounts FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_aca_touch_updated_at
BEFORE UPDATE ON public.affiliate_casino_accounts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_aca_affiliate ON public.affiliate_casino_accounts(affiliate_id);