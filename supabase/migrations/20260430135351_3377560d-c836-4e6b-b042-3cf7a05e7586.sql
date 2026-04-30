
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_commission_plans_client_id_fkey') THEN
    ALTER TABLE public.client_commission_plans
      ADD CONSTRAINT client_commission_plans_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_commission_plans_country_id_fkey') THEN
    ALTER TABLE public.client_commission_plans
      ADD CONSTRAINT client_commission_plans_country_id_fkey
      FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE SET NULL;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
