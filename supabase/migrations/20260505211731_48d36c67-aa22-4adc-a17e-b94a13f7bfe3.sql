
ALTER TABLE public.commission_closures
  ADD COLUMN IF NOT EXISTS report_type text DEFAULT 'cpa';

ALTER TABLE public.commission_closure_items
  ADD COLUMN IF NOT EXISTS report_type text DEFAULT 'cpa',
  ADD COLUMN IF NOT EXISTS visits integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_accounts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_accounts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_purchasing integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS casino_ngr numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sports_ngr numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_paid_to_affiliate boolean DEFAULT true;
