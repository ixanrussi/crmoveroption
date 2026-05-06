import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, RefreshCw } from "lucide-react";

type Log = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: any;
  new_data: any;
  diff: any;
  created_at: string;
};

const TABLE_LABELS: Record<string, string> = {
  affiliates: "Afiliados",
  clients: "Clientes",
  affiliate_commission_plans: "Planes comisión (afiliado)",
  client_commission_plans: "Planes comisión (cliente)",
  commission_closures: "Cierres",
  commission_closure_items: "Filas de cierre",
  affiliate_operator_ids: "Mapeos operador",
  affiliate_channel_links: "Canales afiliado",
  user_roles: "Roles",
  knowledge_documents: "Documentos KB",
  knowledge_findings: "Hallazgos KB",
};

export default function ActivityLogs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [fUser, setFUser] = useState("");
  const [fTable, setFTable] = useState<string>("all");
  const [fAction, setFAction] = useState<string>("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setLogs((data ?? []) as Log[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (fUser && !(l.user_email || "").toLowerCase().includes(fUser.toLowerCase())) return false;
      if (fTable !== "all" && l.table_name !== fTable) return false;
      if (fAction !== "all" && l.action !== fAction) return false;
      if (fFrom && l.created_at < fFrom) return false;
      if (fTo && l.created_at > `${fTo}T23:59:59`) return false;
      return true;
    });
  }, [logs, fUser, fTable, fAction, fFrom, fTo]);

  const actionVariant = (a: string): "default" | "secondary" | "destructive" | "outline" =>
    a === "INSERT" ? "default" : a === "DELETE" ? "destructive" : "secondary";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Log de actividad</h1>
          <p className="text-sm text-muted-foreground">Auditoría de cambios en datos. Solo super admin.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div><Label className="text-xs">Usuario (email)</Label>
            <Input value={fUser} onChange={(e) => setFUser(e.target.value)} placeholder="email@..." /></div>
          <div><Label className="text-xs">Tabla</Label>
            <Select value={fTable} onValueChange={setFTable}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(TABLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Acción</Label>
            <Select value={fAction} onValueChange={setFAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="INSERT">INSERT</SelectItem>
                <SelectItem value="UPDATE">UPDATE</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Desde</Label>
            <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Hasta</Label>
            <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Sin registros.
                </TableCell></TableRow>
              )}
              {filtered.map((l) => {
                const diffEntries = l.diff ? Object.entries(l.diff as Record<string, { old: any; new: any }>) : [];
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{l.user_email ?? <span className="text-muted-foreground">sistema</span>}</TableCell>
                    <TableCell><Badge variant={actionVariant(l.action)}>{l.action}</Badge></TableCell>
                    <TableCell className="text-xs">{TABLE_LABELS[l.table_name] ?? l.table_name}</TableCell>
                    <TableCell className="font-mono text-[10px]">{l.record_id?.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <ChevronDown className="h-3 w-3 mr-1" />
                            {l.action === "UPDATE" ? `${diffEntries.length} campo(s)` : "Ver datos"}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          {l.action === "UPDATE" && diffEntries.length > 0 ? (
                            <div className="space-y-1 text-xs">
                              {diffEntries.map(([k, v]) => (
                                <div key={k} className="border rounded p-2 bg-muted/30">
                                  <div className="font-semibold">{k}</div>
                                  <div className="grid grid-cols-2 gap-2 mt-1">
                                    <div>
                                      <div className="text-[10px] text-destructive">Antes</div>
                                      <pre className="text-[10px] whitespace-pre-wrap break-all">{JSON.stringify(v.old, null, 2)}</pre>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-success">Después</div>
                                      <pre className="text-[10px] whitespace-pre-wrap break-all">{JSON.stringify(v.new, null, 2)}</pre>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <pre className="text-[10px] whitespace-pre-wrap break-all bg-muted/30 p-2 rounded border max-h-64 overflow-auto">
                              {JSON.stringify(l.new_data ?? l.old_data, null, 2)}
                            </pre>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
