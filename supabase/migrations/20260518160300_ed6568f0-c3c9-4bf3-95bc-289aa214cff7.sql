
-- helpers first
CREATE OR REPLACE FUNCTION public.unaccent_safe(_txt text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT translate(_txt,
    'áàäâãÁÀÄÂÃéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛçÇñÑ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN');
$$;

CREATE OR REPLACE FUNCTION public.slugify(_txt text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(regexp_replace(regexp_replace(public.unaccent_safe(_txt), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));
$$;

ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS affiliates_slug_unique ON public.affiliates (lower(slug)) WHERE slug IS NOT NULL;

UPDATE public.affiliates
SET slug = public.slugify(COALESCE(fixed_name, unique_id))
WHERE slug IS NULL OR slug = '';

CREATE OR REPLACE FUNCTION public.set_affiliate_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.slugify(COALESCE(NEW.fixed_name, NEW.unique_id));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_affiliate_slug ON public.affiliates;
CREATE TRIGGER trg_set_affiliate_slug BEFORE INSERT OR UPDATE ON public.affiliates
FOR EACH ROW EXECUTE FUNCTION public.set_affiliate_slug();

CREATE TABLE IF NOT EXISTS public.landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL,
  country_id uuid,
  slug text NOT NULL,
  title text NOT NULL,
  subtitle text,
  intro text,
  hero_image_url text,
  operator_ids uuid[] NOT NULL DEFAULT '{}',
  seo_title text,
  seo_description text,
  is_published boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS landing_pages_aff_country_slug
  ON public.landing_pages (affiliate_id, COALESCE(country_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(slug));

ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lp auth read all" ON public.landing_pages
FOR SELECT TO authenticated USING (true);

CREATE POLICY "lp admin write" ON public.landing_pages
FOR ALL TO authenticated
USING (is_admin_or_super(auth.uid()))
WITH CHECK (is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_lp_touch BEFORE UPDATE ON public.landing_pages
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.get_public_landing_page(_affiliate_slug text, _country_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_aff record;
  v_country record;
  v_lp record;
  v_operators jsonb;
  v_links jsonb;
BEGIN
  SELECT id, fixed_name, slug INTO v_aff FROM public.affiliates WHERE lower(slug) = lower(_affiliate_slug) LIMIT 1;
  IF v_aff.id IS NULL THEN RETURN NULL; END IF;

  SELECT id, code, name INTO v_country FROM public.countries WHERE lower(code) = lower(_country_code) LIMIT 1;

  SELECT * INTO v_lp FROM public.landing_pages
   WHERE affiliate_id = v_aff.id
     AND (country_id = v_country.id OR (country_id IS NULL AND v_country.id IS NULL))
     AND is_published = true
   ORDER BY updated_at DESC LIMIT 1;
  IF v_lp.id IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'company_name', c.company_name, 'website', c.website, 'brands', c.brands,
    'ord', array_position(v_lp.operator_ids, c.id)
  ) ORDER BY array_position(v_lp.operator_ids, c.id)), '[]'::jsonb)
  INTO v_operators
  FROM public.clients c WHERE c.id = ANY(v_lp.operator_ids);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'client_id', t.client_id, 'brand', t.brand, 'tracking_link', t.tracking_link, 'country_id', t.country_id
  )), '[]'::jsonb)
  INTO v_links
  FROM public.affiliate_tracking_links t
  WHERE t.affiliate_id = v_aff.id
    AND t.client_id = ANY(v_lp.operator_ids)
    AND (t.country_id = v_country.id OR t.country_id IS NULL);

  RETURN jsonb_build_object(
    'affiliate', jsonb_build_object('id', v_aff.id, 'name', v_aff.fixed_name, 'slug', v_aff.slug),
    'country', CASE WHEN v_country.id IS NOT NULL THEN jsonb_build_object('id', v_country.id, 'code', v_country.code, 'name', v_country.name) ELSE NULL END,
    'page', jsonb_build_object(
      'id', v_lp.id, 'title', v_lp.title, 'subtitle', v_lp.subtitle, 'intro', v_lp.intro,
      'hero_image_url', v_lp.hero_image_url, 'seo_title', v_lp.seo_title, 'seo_description', v_lp.seo_description
    ),
    'operators', v_operators,
    'tracking_links', v_links
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_public_landing_page(text, text) TO anon, authenticated;
