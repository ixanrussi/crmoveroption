CREATE TABLE IF NOT EXISTS public.currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Currencies read"
  ON public.currencies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Currencies write"
  ON public.currencies FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

INSERT INTO public.currencies (code, name) VALUES
  ('USD','Dólar estadounidense'),
  ('EUR','Euro'),
  ('GBP','Libra esterlina'),
  ('ARS','Peso argentino'),
  ('BOB','Boliviano'),
  ('BRL','Real brasileño'),
  ('CLP','Peso chileno'),
  ('COP','Peso colombiano'),
  ('CRC','Colón costarricense'),
  ('CUP','Peso cubano'),
  ('DOP','Peso dominicano'),
  ('GTQ','Quetzal'),
  ('HNL','Lempira'),
  ('HTG','Gourde'),
  ('MXN','Peso mexicano'),
  ('NIO','Córdoba'),
  ('PAB','Balboa'),
  ('PEN','Sol peruano'),
  ('PYG','Guaraní'),
  ('SVC','Colón salvadoreño'),
  ('UYU','Peso uruguayo'),
  ('VES','Bolívar soberano')
ON CONFLICT (code) DO NOTHING;