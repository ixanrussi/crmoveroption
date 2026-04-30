ALTER TABLE public.client_commission_plans ADD COLUMN wager numeric;
ALTER TABLE public.client_commission_plans RENAME COLUMN wager_type TO conversion_type;
ALTER TABLE public.client_commission_plans DROP CONSTRAINT IF EXISTS client_commission_plans_wager_type_check;
ALTER TABLE public.client_commission_plans ADD CONSTRAINT client_commission_plans_conversion_type_check CHECK (conversion_type IN ('NCO','NNCO'));