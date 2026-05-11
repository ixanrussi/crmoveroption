import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, FileText, Upload } from "lucide-react";
import { toast } from "sonner";

const CONTRACT_CATEGORIES = ["Contrato", "Insertion Order", "Anexo", "Otro"] as const;

type Doc = {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: string | null;
  created_at: string;
};

export default function ClientContractsUploader({ clientId, canEdit = true }: { clientId: string; canEdit?: boolean }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [category, setCategory] = useState<string>("Contrato");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const refresh = async () => {
    const { data } = await supabase
      .from("knowledge_documents")
      .select("id, file_name, file_path, mime_type, size_bytes, category, created_at")
      .eq("client_id", clientId)
      .in("category", CONTRACT_CATEGORIES as unknown as string[])
      .order("created_at", { ascending: false });
    setDocs((data ?? []) as Doc[]);
  };

  useEffect(() => { if (clientId) refresh(); }, [clientId]);

  const handleUpload = async (file: File) => {
    if (!clientId) return;
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.\- ]+/g, "_");
      const path = `${clientId}/contracts/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from("client-knowledge").upload(path, file, {
        contentType: file.type || undefined, upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("knowledge_documents").insert({
        client_id: clientId,
        file_name: file.name,
        file_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        category,
        status: "stored",
      });
      if (insErr) throw insErr;
      toast.success("Documento subido");
      if (fileRef.current) fileRef.current.value = "";
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al subir");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (doc: Doc) => {
    if (!confirm(`Eliminar ${doc.file_name}?`)) return;
    await supabase.storage.from("client-knowledge").remove([doc.file_path]);
    await supabase.from("knowledge_documents").delete().eq("id", doc.id);
    refresh();
  };

  const download = async (doc: Doc) => {
    const { data } = await supabase.storage.from("client-knowledge").createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const fmtSize = (n: number | null) => {
    if (!n) return "—";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Contratos / Insertion Orders</Label>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTRACT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[220px]">
            <Label className="text-xs">Archivo (PDF, DOC, IMG)</Label>
            <Input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </div>
          {uploading && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Upload className="h-3 w-3 animate-pulse" /> Subiendo…
            </div>
          )}
        </div>
      )}

      {docs.length === 0 ? (
        <div className="text-sm text-muted-foreground">Sin documentos.</div>
      ) : (
        <div className="space-y-1">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 text-sm border rounded px-2 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="secondary" className="shrink-0">{d.category ?? "—"}</Badge>
                <span className="truncate">{d.file_name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{fmtSize(d.size_bytes)}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => download(d)} title="Descargar">
                  <Download className="h-4 w-4" />
                </Button>
                {canEdit && (
                  <Button size="icon" variant="ghost" onClick={() => remove(d)} title="Eliminar">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
