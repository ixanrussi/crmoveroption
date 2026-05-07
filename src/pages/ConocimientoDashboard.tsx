import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle2, AlertTriangle, DollarSign, Users, UserCheck, HelpCircle, ArrowRight, ShieldAlert } from "lucide-react";

type Doc = { id: string; client_id: string; status: string; created_at: string };
type Finding = {
  id: string; client_id: string; document_id: string;
  kind: string; severity: string; status: string;
  title: string; detail: string | null;
};
type Client = { id: string; company_name: string };

type RiskKey = "financiero" | "usuarios" | "afiliados" | "otros";

const RISK_META: Record<RiskKey, { label: string; icon: any; color: string; keywords: RegExp }> = {
  financiero: {
    label: "Riesgo financiero",
    icon: DollarSign,
    color: "text-destructive",
    keywords: /(comisi[oó]n|cpa|revshare|pago|importe|monto|factur|baseline|cap|wager|negativ|saldo|deduc|retenci[oó]n|moneda|currency|total|diferencia|cobr|deuda|fij)/i,
  },
  usuarios: {
    label: "Calidad usuarios / tráfico",
    icon: Users,
    color: "text-warning",
    keywords: /(jugador|player|ftd|deposito|dep[oó]sito|traffic|tr[aá]fico|conversi[oó]n|qualified|cualific|activo|locked|fraude|chargeback|geo|pa[ií]s|country|bonus|abuse)/i,
  },
  afiliados: {
    label: "Calidad afiliados",
    icon: UserCheck,
    color: "text-info",
    keywords: /(afiliad|affiliate|campaign|campa[ñn]a|brand|marca|sub[\s_-]?id|sub_id|partner|fuente|source|canal|channel)/i,
  },
  otros: {
    label: "Otros / generales",
    icon: HelpCircle,
    color: "text-muted-foreground",
    keywords: /.*/,
  },
};

const classifyRisk = (f: Finding): RiskKey => {
  const text = `${f.title} ${f.detail ?? ""}`;
  if (RISK_META.financiero.keywords.test(text)) return "financiero";
  if (RISK_META.usuarios.keywords.test(text)) return "usuarios";
  if (RISK_META.afiliados.keywords.test(text)) return "afiliados";
  return "otros";
};

export default function ConocimientoDashboard() {
  const [clients, setClients] = useState<Client[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [c, d, f] = await Promise.all([
        supabase.from("clients").select("id, company_name").order("company_name"),
        supabase.from("knowledge_documents").select("id, client_id, status, created_at"),
        supabase.from("knowledge_findings").select("id, client_id, document_id, kind, severity, status, title, detail"),
      ]);
      setClients((c.data ?? []) as Client[]);
      setDocs((d.data ?? []) as Doc[]);
      setFindings((f.data ?? []) as Finding[]);
      setLoading(false);
    })();
  }, []);

  const totals = useMemo(() => {
    const totalDocs = docs.length;
    const analyzed = docs.filter((x) => x.status === "analyzed").length;
    const pending = docs.filter((x) => x.status === "pending" || x.status === "analyzing").length;
    const failed = docs.filter((x) => x.status === "failed").length;
    const openFindings = findings.filter((x) => x.status === "open");
    const high = openFindings.filter((x) => x.severity === "high").length;
    const medium = openFindings.filter((x) => x.severity === "medium").length;
    const low = openFindings.filter((x) => x.severity === "low").length;
    return { totalDocs, analyzed, pending, failed, openCount: openFindings.length, high, medium, low };
  }, [docs, findings]);

  const byRisk = useMemo(() => {
    const open = findings.filter((f) => f.status === "open");
    const groups: Record<RiskKey, Finding[]> = { financiero: [], usuarios: [], afiliados: [], otros: [] };
    open.forEach((f) => groups[classifyRisk(f)].push(f));
    return groups;
  }, [findings]);

  const byOperator = useMemo(() => {
    const map = new Map<string, { client: Client; docs: number; analyzed: number; open: number; high: number }>();
    clients.forEach((c) => map.set(c.id, { client: c, docs: 0, analyzed: 0, open: 0, high: 0 }));
    docs.forEach((d) => {
      const e = map.get(d.client_id);
      if (!e) return;
      e.docs++;
      if (d.status === "analyzed") e.analyzed++;
    });
    findings.forEach((f) => {
      const e = map.get(f.client_id);
      if (!e || f.status !== "open") return;
      e.open++;
      if (f.severity === "high") e.high++;
    });
    return Array.from(map.values()).filter((e) => e.docs > 0).sort((a, b) => b.high - a.high || b.open - a.open || b.docs - a.docs);
  }, [clients, docs, findings]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Base de Conocimiento</h1>
          <p className="text-sm text-muted-foreground">Resumen general de los documentos analizados y los hallazgos detectados por la IA.</p>
        </div>
        <Button asChild>
          <Link to="/conocimiento/operador">Gestionar por operador <ArrowRight className="h-4 w-4 ml-1" /></Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileText} label="Archivos subidos" value={totals.totalDocs} hint={`${totals.pending} en cola · ${totals.failed} con error`} />
        <StatCard icon={CheckCircle2} label="Analizados" value={totals.analyzed} hint={totals.totalDocs ? `${Math.round((totals.analyzed / totals.totalDocs) * 100)}% del total` : ""} accent="text-success" />
        <StatCard icon={AlertTriangle} label="Inconsistencias abiertas" value={totals.openCount} hint={`${totals.high} altas · ${totals.medium} medias · ${totals.low} bajas`} accent={totals.high > 0 ? "text-destructive" : "text-warning"} />
        <StatCard icon={ShieldAlert} label="Severidad alta" value={totals.high} accent="text-destructive" hint={totals.high > 0 ? "Requieren revisión urgente" : "Sin riesgos críticos"} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Inconsistencias por categoría de riesgo</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(RISK_META) as RiskKey[]).map((k) => {
            const meta = RISK_META[k];
            const items = byRisk[k];
            const high = items.filter((i) => i.severity === "high").length;
            const Icon = meta.icon;
            return (
              <Card key={k} className={items.length === 0 ? "opacity-70" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                    {meta.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-bold">{items.length}</span>
                    {high > 0 && <Badge variant="destructive" className="text-[10px]">{high} altas</Badge>}
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {items.slice(0, 3).map((i) => (
                      <div key={i.id} className="truncate" title={i.title}>• {i.title}</div>
                    ))}
                    {items.length === 0 && <p>Sin hallazgos en esta categoría.</p>}
                    {items.length > 3 && <p className="italic">+{items.length - 3} más…</p>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Por operador</h2>
        <Card>
          <CardContent className="p-0 divide-y">
            {loading && <p className="p-6 text-sm text-muted-foreground text-center">Cargando…</p>}
            {!loading && byOperator.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground text-center">Aún no hay operadores con documentos subidos.</p>
            )}
            {byOperator.map((row) => (
              <Link
                key={row.client.id}
                to="/conocimiento/operador"
                className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{row.client.company_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.docs} documentos · {row.analyzed} analizados
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {row.high > 0 && <Badge variant="destructive">{row.high} altas</Badge>}
                  {row.open > 0 ? (
                    <Badge variant="secondary">{row.open} abiertas</Badge>
                  ) : (
                    <Badge className="bg-success">Sin pendientes</Badge>
                  )}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, accent }: { icon: any; label: string; value: number | string; hint?: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className={`h-4 w-4 ${accent ?? ""}`} />
          {label}
        </div>
        <p className={`text-3xl font-bold ${accent ?? ""}`}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
