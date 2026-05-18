import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight, ShieldCheck } from "lucide-react";

type Operator = { id: string; company_name: string; website: string | null; brands: string[] | null; ord: number };
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
  const { affiliateSlug, countryCode } = useParams();
  const [data, setData] = useState<LP | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!affiliateSlug || !countryCode) return;
    (async () => {
      const { data: result } = await supabase.rpc("get_public_landing_page", {
        _affiliate_slug: affiliateSlug,
        _country_code: countryCode,
      });
      if (!result) {
        setNotFound(true);
      } else {
        setData(result as any);
        const lp = result as any;
        document.title = lp.page.seo_title || lp.page.title;
        const meta = document.querySelector('meta[name="description"]') || document.createElement("meta");
        meta.setAttribute("name", "description");
        meta.setAttribute("content", lp.page.seo_description || lp.page.subtitle || "");
        if (!meta.parentNode) document.head.appendChild(meta);
      }
      setLoading(false);
    })();
  }, [affiliateSlug, countryCode]);

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
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="font-bold text-lg">{data.affiliate.name}</div>
          {data.country && <div className="text-sm text-muted-foreground">{data.country.name}</div>}
        </div>
      </header>

      <section className="bg-gradient-to-br from-primary/90 to-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
          <h1 className="text-3xl md:text-5xl font-bold mb-3">{data.page.title}</h1>
          {data.page.subtitle && <p className="text-lg md:text-xl opacity-90 mb-4">{data.page.subtitle}</p>}
          {data.page.intro && <p className="opacity-80 max-w-3xl whitespace-pre-line">{data.page.intro}</p>}
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
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
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-foreground/90 text-background flex items-center justify-center text-xl font-bold flex-shrink-0">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base md:text-lg truncate">{op.company_name}</div>
                  {op.brands && op.brands.length > 0 && (
                    <div className="text-xs text-muted-foreground truncate">{op.brands.join(" · ")}</div>
                  )}
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

      <footer className="border-t mt-8">
        <div className="max-w-5xl mx-auto px-4 py-6 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} {data.affiliate.name}
        </div>
      </footer>
    </div>
  );
}
