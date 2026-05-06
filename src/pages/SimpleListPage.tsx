import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import WorldActivityMap from "@/components/WorldActivityMap";

interface Props {
  table: "countries" | "softwares" | "affiliate_channels" | "currencies";
  title: string;
  withCode?: boolean;
}

export default function SimpleListPage({ table, title, withCode }: Props) {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getFunctionError = async (error: unknown, data?: any) => {
    if (data?.error) return data.error;
    const context = (error as { context?: Response } | null)?.context;
    if (context) {
      const body = await context.clone().json().catch(() => null);
      if (body?.error) return body.error;
    }
    return (error as Error | null)?.message ?? "No se pudo completar la operación";
  };

  const load = async () => {
    const { data, error } = await supabase.from(table).select("*").order("name");
    if (error) toast.error(error.message);
    else setItems(data ?? []);
  };
  useEffect(() => { load(); }, [table]);

  const add = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("simple-list-items", {
      body: {
        action: "insert",
        table,
        name: name.trim(),
        code: withCode ? code.trim().toUpperCase() : undefined,
      },
    });
    setSaving(false);
    if (error || data?.error) {
      toast.error(await getFunctionError(error, data));
      return;
    }
    toast.success("Agregado");
    setName("");
    setCode("");
    load();
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    const { data, error } = await supabase.functions.invoke("simple-list-items", {
      body: { action: "delete", table, id },
    });
    setDeletingId(null);
    if (error || data?.error) {
      toast.error(await getFunctionError(error, data));
      return;
    }
    toast.success("Eliminado");
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground text-sm">Gestiona los valores disponibles en los formularios.</p>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle className="text-base">Agregar nuevo</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
            {withCode && <Input placeholder="Código" value={code} onChange={(e) => setCode(e.target.value)} className="max-w-[120px]" />}
            <Button onClick={add} disabled={saving}><Plus className="h-4 w-4 mr-1" /> {saving ? "Agregando..." : "Agregar"}</Button>
          </CardContent>
        </Card>
      )}

      {table === "countries" && <WorldActivityMap />}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                {withCode && <TableHead>Código</TableHead>}
                {isAdmin && <TableHead className="w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.name}</TableCell>
                  {withCode && <TableCell>{it.code}</TableCell>}
                  {isAdmin && (
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar "{it.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. El registro será eliminado permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(it.id)} disabled={deletingId === it.id}>
                              {deletingId === it.id ? "Eliminando..." : "Eliminar"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sin registros</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
