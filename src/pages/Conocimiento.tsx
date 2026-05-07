import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, Sparkles, FileText, Trash2, Download, RefreshCw, AlertTriangle, CheckCircle2, MessageSquare } from "lucide-react";

type Client = { id: string; company_name: string };
type Doc = {
  id: string; client_id: string; file_name: string; file_path: string;
  mime_type: string | null; size_bytes: number | null; category: string | null;
  notes: string | null; status: string; analysis_summary: string | null;
  analysis_extracted: any; analysis_error: string | null; analyzed_at: string | null;
  created_at: string;
};
type Finding = {
  id: string; document_id: string; client_id: string;
  kind: string; severity: string; title: string; detail: string | null;
  context: any; status: string; answer: string | null; answered_at: string | null;
};

const CATEGORIES = ["Reporte CPA", "Reporte RevShare", "Reporte global", "Factura", "Listado de jugadores", "Otro"];

export default function Conocimiento() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [notes, setNotes] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshCounts = async () => {
    const { data } = await supabase.from("knowledge_documents").select("client_id");
    const map: Record<string, number> = {};
    (data ?? []).forEach((r: any) => { map[r.client_id] = (map[r.client_id] || 0) + 1; });
    setDocCounts(map);
  };

  const [searchParams] = useSearchParams();
  useEffect(() => {
    supabase.from("clients").select("id, company_name").order("company_name")
      .then(({ data }) => {
        setClients((data ?? []) as Client[]);
        const requested = searchParams.get("client");
        if (requested && data?.some((c: any) => c.id === requested)) {
          setClientId(requested);
        } else if (data?.length && !clientId) {
          setClientId(data[0].id);
        }
      });
    refreshCounts();
  }, [searchParams]);

  const refresh = async () => {
    if (!clientId) return;
    const [d, f] = await Promise.all([
      supabase.from("knowledge_documents").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("knowledge_findings").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    ]);
    setDocs((d.data ?? []) as Doc[]);
    setFindings((f.data ?? []) as Finding[]);
    refreshCounts();
  };
  useEffect(() => { refresh(); }, [clientId]);

  // Realtime: refresh on doc/finding changes for the active client
  useEffect(() => {
    if (!clientId) return;
    const ch = supabase
      .channel(`know-${clientId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "knowledge_documents", filter: `client_id=eq.${clientId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "knowledge_findings", filter: `client_id=eq.${clientId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [clientId]);

  const handleUpload = async (file: File) => {
    if (!clientId) { toast.error("Selecciona un cliente"); return; }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.\- ]+/g, "_");
      const path = `${clientId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from("client-knowledge").upload(path, file, {
        contentType: file.type || undefined, upsert: false,
      });
      if (upErr) throw upErr;
      const { data: ins, error: insErr } = await supabase.from("knowledge_documents").insert({
        client_id: clientId,
        file_name: file.name,
        file_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        category: category || null,
        notes: notes || null,
        status: "pending",
      }).select("id").single();
      if (insErr) throw insErr;
      toast.success("Archivo subido. Iniciando análisis…");
      setNotes(""); setCategory("");
      if (fileRef.current) fileRef.current.value = "";
      // fire and forget
      analyze(ins.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al subir");
    } finally {
      setUploading(false);
    }
  };

  const analyze = async (docId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("knowledge-analyze", { body: { document_id: docId } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Análisis listo · ${(data as any)?.findings ?? 0} hallazgos`);
      refresh();
    } catch (e: any) {
      toast.error(`Error de análisis: ${e?.message ?? e}`);
      refresh();
    }
  };

  const remove = async (doc: Doc) => {
    if (!confirm(`Eliminar ${doc.file_name}?`)) return;
    await supabase.storage.from("client-knowledge").remove([doc.file_path]);
    await supabase.from("knowledge_documents").delete().eq("id", doc.id);
    refresh();
  };

  const downloadUrl = async (doc: Doc) => {
    const { data } = await supabase.storage.from("client-knowledge").createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const answerFinding = async (id: string, answer: string, status: string) => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("knowledge_findings").update({
      answer, status, answered_by: u.user?.id ?? null, answered_at: new Date().toISOString(),
    }).eq("id", id);
    toast.success("Respuesta guardada");
    refresh();
  };

  const openCount = useMemo(() => findings.filter(f => f.status === "open").length, [findings]);
  const highCount = useMemo(() => findings.filter(f => f.status === "open" && f.severity === "high").length, [findings]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Base de Conocimiento</h1>
          <p className="text-sm text-muted-foreground">Sube PDF / Excel / CSV de cada cliente. La IA extrae datos clave y genera dudas / inconsistencias para revisar antes de facturar y pagar.</p>
        </div>
        <div className="space-y-1 min-w-[260px]">
          <Label className="text-xs">Operador</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
            <SelectContent>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <span>{c.company_name}</span>
                    <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                      {docCounts[c.id] ?? 0}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Documentos</p><p className="text-2xl font-bold">{docs.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Hallazgos abiertos</p><p className="text-2xl font-bold">{openCount}</p></CardContent></Card>
        <Card className={highCount > 0 ? "border-destructive/40" : ""}>
          <CardContent className="p-4"><p className="text-xs text-muted-foreground">Severidad alta</p><p className={`text-2xl font-bold ${highCount > 0 ? "text-destructive" : ""}`}>{highCount}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Subir archivo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Notas (contexto para la IA)</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: Reporte CPA enero 2026, marca Betway.es" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input ref={fileRef} type="file" accept=".pdf,.csv,.xlsx,.xls,.txt,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
              disabled={uploading || !clientId} />
            {uploading && <span className="text-xs text-muted-foreground">Subiendo…</span>}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="findings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="findings">⚠️ Dudas e inconsistencias ({openCount})</TabsTrigger>
          <TabsTrigger value="docs">📄 Documentos ({docs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="findings">
          <Card>
            <CardHeader><CardTitle className="text-base">Hallazgos detectados por la IA</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {findings.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Aún no hay hallazgos. Sube un archivo para comenzar.</p>}
              {findings.map(f => {
                const doc = docs.find(d => d.id === f.document_id);
                return <FindingCard key={f.id} f={f} docName={doc?.file_name ?? "—"} onAnswer={answerFinding} />;
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Archivo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Resumen IA</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin documentos</TableCell></TableRow>}
                  {docs.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> {d.file_name}</TableCell>
                      <TableCell>{d.category || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={d.status} />
                        {(d.status === "analyzing" || d.status === "pending") && (
                          <div className="mt-2 w-40">
                            <IndeterminateBar />
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {d.status === "analyzing" ? "Analizando con IA…" : "En cola…"}
                            </p>
                          </div>
                        )}
                        {d.analysis_error && <p className="text-xs text-destructive mt-1 max-w-xs truncate" title={d.analysis_error}>{d.analysis_error}</p>}
                      </TableCell>
                      <TableCell className="max-w-md text-xs text-muted-foreground">
                        {d.analysis_summary ? <span className="line-clamp-3">{d.analysis_summary}</span> : "—"}
                      </TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => downloadUrl(d)}><Download className="h-4 w-4" /></Button>
                        {d.status === "failed" ? (
                          <Button size="sm" variant="outline" onClick={() => analyze(d.id)}>
                            <RefreshCw className="h-4 w-4 mr-1" /> Reanalizar
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => analyze(d.id)} disabled={d.status === "analyzing"} title="Reanalizar">
                            {d.status === "analyzing" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => remove(d)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "analyzed") return <Badge className="bg-success">Analizado</Badge>;
  if (status === "analyzing") return <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Analizando</Badge>;
  if (status === "failed") return <Badge variant="destructive">Falló</Badge>;
  return <Badge variant="outline">Pendiente</Badge>;
}

function IndeterminateBar() {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div className="absolute inset-y-0 left-0 w-1/3 bg-primary animate-[indeterminate_1.4s_ease-in-out_infinite]" style={{
        animationName: "indeterminate",
      }} />
      <style>{`@keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
    </div>
  );
}

function FindingCard({ f, docName, onAnswer }: { f: Finding; docName: string; onAnswer: (id: string, answer: string, status: string) => void }) {
  const [answer, setAnswer] = useState(f.answer ?? "");
  const sevColor = f.severity === "high" ? "border-destructive/50 bg-destructive/5"
                  : f.severity === "medium" ? "border-warning/40 bg-warning/5"
                  : "border-border";
  const KindIcon = f.kind === "inconsistency" ? AlertTriangle
                  : f.kind === "warning" ? AlertTriangle
                  : f.kind === "info" ? CheckCircle2
                  : MessageSquare;
  return (
    <div className={`rounded-lg border p-4 space-y-3 ${sevColor} ${f.status !== "open" ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <KindIcon className="h-4 w-4" />
            <p className="font-medium text-sm">{f.title}</p>
            <Badge variant="outline" className="text-[10px]">{f.kind}</Badge>
            <Badge variant={f.severity === "high" ? "destructive" : "secondary"} className="text-[10px]">{f.severity}</Badge>
            {f.status !== "open" && <Badge className="bg-success text-[10px]">{f.status}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">📄 {docName}</p>
          {f.detail && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{f.detail}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Tu respuesta o aclaración…" rows={2} />
        <div className="flex gap-2 justify-end">
          {f.status === "open" ? <>
            <Button size="sm" variant="outline" onClick={() => onAnswer(f.id, answer, "dismissed")}>Descartar</Button>
            <Button size="sm" variant="secondary" onClick={() => onAnswer(f.id, answer, "answered")} disabled={!answer.trim()}>Responder</Button>
            <Button size="sm" onClick={() => onAnswer(f.id, answer, "resolved")} disabled={!answer.trim()}>Resolver</Button>
          </> : <Button size="sm" variant="outline" onClick={() => onAnswer(f.id, answer, "open")}>Reabrir</Button>}
        </div>
      </div>
    </div>
  );
}
