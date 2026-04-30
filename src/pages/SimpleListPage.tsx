import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  table: "countries" | "softwares" | "affiliate_channels";
  title: string;
  withCode?: boolean;
}

export default function SimpleListPage({ table, title, withCode }: Props) {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const load = async () => {
    const { data, error } = await supabase.from(table).select("*").order("name");
    if (error) toast.error(error.message);
    else setItems(data ?? []);
  };
  useEffect(() => { load(); }, [table]);

  const add = async () => {
    if (!name.trim()) return;
    const payload: any = { name: name.trim() };
    if (withCode && code.trim()) payload.code = code.trim().toUpperCase();
    const { error } = await supabase.from(table).insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Agregado"); setName(""); setCode(""); load(); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminado"); load(); }
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
            <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> Agregar</Button>
          </CardContent>
        </Card>
      )}

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
                      <Button size="icon" variant="ghost" onClick={() => remove(it.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
