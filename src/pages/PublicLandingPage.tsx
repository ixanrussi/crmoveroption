import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight, ShieldCheck, Gift } from "lucide-react";

const SAMPLE_OFFERS = [
  "Bono de bienvenida hasta 500 €",
  "100 Free Spins en tu primer depósito",
  "Free Bet de 20 € sin depósito",
  "Ruleta de Premios — apuestas y giros extra",
  "Cashback semanal del 10%",
  "Apuesta gratis hasta 30 € al registrarte",
  "Duplicamos tu primer depósito hasta 200 €",
  "50 giros gratis sin depósito",
  "Bono recarga del 100% los viernes",
  "Oportunidad de ganar hasta 500 R$",
];

const offerFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SAMPLE_OFFERS[h % SAMPLE_OFFERS.length];
};

type Operator = { id: string; company_name: string; website: string | null; brands: string[] | null; logo_url?: string | null; ord: number };
type LinkRow = { client_id: string; brand: string | null; tracking_link: string; country_id: string | null };

type LP = {
  affiliate: { id: string; name: string; slug: string };
  country: { id: string; code: string; name: string } | null;
  page: {
    id: string;
    title: string;
    subtitle: string | null;
    intro: string | null;
    hero_image_url: string | null;
    seo_title: string | null;
    seo_description: string | null;
  };
  operators: Operator[];
  tracking_links: LinkRow[];
};

export default function PublicLandingPage() {
  const { affiliateSlug, countryCode, lpId } = useParams();
  const isPreview = !!lpId;
  const [data, setData] = useState<LP | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      let result: any = null;
      if (isPreview && lpId) {
        const { data: lp } = await supabase.from("landing_pages").select("*").eq("id", lpId).maybeSingle();
        if (lp) {
          const [{ data: aff }, coRes, { data: ops }, { data: links }] = await Promise.all([
            supabase.from("affiliates").select("id, fixed_name, slug").eq("id", lp.affiliate_id).maybeSingle(),
            lp.country_id
              ? supabase.from("countries").select("id, code, name").eq("id", lp.country_id).maybeSingle()
              : Promise.resolve({ data: null } as any),
            supabase.from("clients").select("id, company_name, website, brands, logo_url").in("id", lp.operator_ids ?? []),
            supabase.from("affiliate_tracking_links").select("client_id, brand, tracking_link, country_id")
              .eq("affiliate_id", lp.affiliate_id).in("client_id", lp.operator_ids ?? []),
          ]);
          const co = (coRes as any)?.data ?? null;
          const ordered = (lp.operator_ids ?? []).map((id: string, ord: number) => {
            const o = (ops ?? []).find((x: any) => x.id === id);
            return o ? { ...o, ord } : null;
          }).filter(Boolean);
          if (aff) {
            result = {
              affiliate: { id: aff.id, name: aff.fixed_name, slug: aff.slug },
              country: co ? { id: co.id, code: co.code, name: co.name } : null,
              page: { id: lp.id, title: lp.title, subtitle: lp.subtitle, intro: lp.intro, hero_image_url: lp.hero_image_url, seo_title: lp.seo_title, seo_description: lp.seo_description },
              operators: ordered,
              tracking_links: links ?? [],
            };
          }
        }
      } else if (affiliateSlug && countryCode) {
        const { data: r } = await supabase.rpc("get_public_landing_page", {
          _affiliate_slug: affiliateSlug,
          _country_code: countryCode,
        });
        result = r;
      }
      if (!result) {
        setNotFound(true);
      } else {
        setData(result as any);
        document.title = (result.page.seo_title || result.page.title) + (isPreview ? " · Preview" : "");
        const meta = document.querySelector('meta[name="description"]') || document.createElement("meta");
        meta.setAttribute("name", "description");
        meta.setAttribute("content", result.page.seo_description || result.page.subtitle || "");
        if (!meta.parentNode) document.head.appendChild(meta);
      }
      setLoading(false);
    })();
  }, [affiliateSlug, countryCode, lpId, isPreview]);

  const linkFor = useMemo(() => {
    if (!data) return () => null as string | null;
    return (clientId: string, brand?: string | null) => {
      const matches = data.tracking_links.filter((l) => l.client_id === clientId);
      const byBrand = matches.find((l) => (l.brand || "").toLowerCase() === (brand || "").toLowerCase());
      return (byBrand || matches[0])?.tracking_link || null;
    };
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (notFound || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-2 px-4 text-center">
        <p className="text-lg font-semibold">Página no encontrada</p>
        <p className="text-sm text-muted-foreground max-w-md">
          Verifica que la landing page exista para este afiliado y país, y que esté marcada como <b>Publicada</b> en el panel de administración.
        </p>
      </div>
    );
  }

  const BannerSlot = ({ side }: { side: "left" | "right" }) => (
    <aside
      aria-label={`Espacio publicitario ${side === "left" ? "izquierdo" : "derecho"} 120x600`}
      className="hidden xl:flex sticky top-6 self-start w-[120px] h-[600px] flex-shrink-0 rounded-md border border-dashed border-border bg-muted/30 items-center justify-center text-[10px] text-muted-foreground text-center px-1"
    >
      Publicidad<br />120 × 600
    </aside>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {isPreview && (
        <div className="bg-amber-500 text-black text-center text-xs py-1.5 px-4 font-medium">
          MODO PREVIEW — esta landing page aún no está publicada
        </div>
      )}

      <section className="bg-gradient-to-br from-primary/90 to-primary text-primary-foreground relative">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-16 relative">
          <h1 className="text-3xl md:text-5xl font-bold mb-3">{data.page.title}</h1>
          {data.page.subtitle && <p className="text-lg md:text-xl opacity-90 mb-4">{data.page.subtitle}</p>}
          {data.page.intro && <p className="opacity-80 max-w-3xl whitespace-pre-line">{data.page.intro}</p>}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 flex gap-6 justify-center">
        <BannerSlot side="left" />
        <main className="flex-1 max-w-3xl">
          <h2 className="text-xl md:text-2xl font-bold mb-4">Top Operadores {data.country ? `– ${data.country.name}` : ""}</h2>
          <ol className="space-y-3">
            {data.operators.map((op, idx) => {
              const link = linkFor(op.id);
              const initial = op.company_name?.[0]?.toUpperCase() || "?";
              return (
                <li key={op.id} className="rounded-lg border bg-card p-4 md:p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
                  <span className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="w-16 h-12 md:w-24 md:h-14 rounded-lg bg-card border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                    {op.logo_url ? (
                      <img src={op.logo_url} alt={`${op.company_name} logo`} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-foreground/80">{initial}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base md:text-lg truncate">{op.company_name}</div>
                    {op.brands && op.brands.length > 0 && (
                      <div className="text-xs text-muted-foreground truncate">{op.brands.join(" · ")}</div>
                    )}
                    <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs md:text-sm font-medium text-primary">
                      <Gift className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{offerFor(op.id)}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {link ? (
                      <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
                        <a href={link} target="_blank" rel="nofollow sponsored noopener">
                          Crear Cuenta <ChevronRight className="h-4 w-4 ml-1" />
                        </a>
                      </Button>
                    ) : (
                      <Button size="lg" variant="secondary" disabled>
                        Próximamente
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
            {data.operators.length === 0 && (
              <li className="text-center text-muted-foreground py-8">No hay operadores destacados.</li>
            )}
          </ol>

          <div className="mt-10 text-xs text-muted-foreground flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>Juega con responsabilidad. Apuestas disponibles solo para mayores de 18 años.</p>
          </div>
        </main>
        <BannerSlot side="right" />
      </div>

      <footer className="border-t mt-8">
        <div className="max-w-5xl mx-auto px-4 py-6 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} {data.affiliate.name}
        </div>
      </footer>
    </div>
  );
}
