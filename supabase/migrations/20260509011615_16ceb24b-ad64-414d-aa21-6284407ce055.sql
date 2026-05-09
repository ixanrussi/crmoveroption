ALTER TABLE public.commission_plan_templates
  ADD CONSTRAINT commission_plan_templates_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;