
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS logo_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('operator-logos', 'operator-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "operator logos public read" ON storage.objects;
CREATE POLICY "operator logos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'operator-logos');

DROP POLICY IF EXISTS "operator logos admin insert" ON storage.objects;
CREATE POLICY "operator logos admin insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'operator-logos' AND public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "operator logos admin update" ON storage.objects;
CREATE POLICY "operator logos admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'operator-logos' AND public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "operator logos admin delete" ON storage.objects;
CREATE POLICY "operator logos admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'operator-logos' AND public.is_admin_or_super(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_public_landing_page(_affiliate_slug text, _country_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'id', c.id, 'company_name', c.company_name, 'website', c.website, 'brands', c.brands, 'logo_url', c.logo_url,
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
END $function$;
