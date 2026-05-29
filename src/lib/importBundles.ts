import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";

// Columns that are arrays or jsonb and need JSON.stringify per cell.
// Anything not listed is treated as a scalar.
const JSON_COLUMNS: Record<string, string[]> = {
  affiliates: ["brands", "country_ids", "aliases", "fixed_remuneration_installments"],
  clients: ["brands", "country_ids", "brand_aliases"],
  affiliate_commission_plans: ["country_ids"],
  client_commission_plans: ["country_ids"],
  commission_plan_templates: ["country_ids"],
  affiliate_salary_deals: ["selections"],
  landing_pages: ["operator_ids"],
  calculator_simulations: ["selections"],
  knowledge_documents: ["analysis_extracted"],
  knowledge_findings: ["context"],
  activity_logs: ["old_data", "new_data", "diff"],
};

function csvEscape(val: any): string {
  if (val === null || val === undefined) return "";
  let s: string;
  if (typeof val === "object") s = JSON.stringify(val);
  else if (val instanceof Date) s = val.toISOString();
  else s = String(val);
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Columns that reference auth.users and won't exist in a fresh destination
// project. We blank them on export so FKs to auth.users don't fail.
const USER_FK_COLUMNS = new Set([
  "created_by",
  "updated_by",
  "answered_by",
  "resolved_by",
  "requested_by",
  "user_id",
]);

function rowsToCsv(rows: any[], table: string): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const jsonCols = new Set(JSON_COLUMNS[table] ?? []);
  const header = cols.join(",");
  const lines = rows.map((r) =>
    cols
      .map((c) => {
        if (USER_FK_COLUMNS.has(c)) return ""; // strip user FKs
        const v = r[c];
        if (jsonCols.has(c) && v !== null && v !== undefined) {
          return csvEscape(JSON.stringify(v));
        }
        return csvEscape(v);
      })
      .join(","),
  );
  return [header, ...lines].join("\n");
}


async function fetchAll(table: string, orderBy = "created_at"): Promise<any[]> {
  const pageSize = 1000;
  const out: any[] = [];
  // Try preferred order column, then "id", then no ordering at all (for pure junction tables).
  const orderCandidates: (string | null)[] = [orderBy, "id", null];
  let orderCol: string | null | undefined;

  // Probe which order works with a single small query.
  for (const cand of orderCandidates) {
    let q = supabase.from(table as any).select("*").range(0, 0);
    if (cand) q = q.order(cand, { ascending: true });
    const { error } = await q;
    if (!error) {
      orderCol = cand;
      break;
    }
    if (!/does not exist|column/i.test(error.message)) {
      throw new Error(`${table}: ${error.message}`);
    }
  }
  if (orderCol === undefined) {
    // All probes failed for non-column reasons; fall back to no order.
    orderCol = null;
  }

  let from = 0;
  while (true) {
    let q = supabase.from(table as any).select("*").range(from, from + pageSize - 1);
    if (orderCol) q = q.order(orderCol, { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    const chunk = data ?? [];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

export type BundleKey = "listas_maestras" | "operadores" | "afiliados" | "comision_afiliados";

export interface Bundle {
  key: BundleKey;
  label: string;
  description: string;
  tables: string[];
}


export const BUNDLES: Bundle[] = [
  {
    key: "listas_maestras",
    label: "Listas maestras",
    description: "Países, monedas, software y canales de afiliados.",
    tables: ["countries", "currencies", "softwares", "affiliate_channels"],
  },
  {
    key: "operadores",
    label: "Operadores",
    description: "Clientes con contactos, software vinculado, planes de comisión y plantillas.",
    tables: [
      "clients",
      "client_contacts",
      "client_software_links",
      "client_commission_plans",
      "commission_plan_templates",
    ],
  },
  {
    key: "afiliados",
    label: "Afiliados",
    description: "Afiliados con canales, IDs de operador, cuentas, tracking links, deals y goals.",
    tables: [
      "affiliates",
      "affiliate_channel_links",
      "affiliate_operator_ids",
      "affiliate_casino_accounts",
      "affiliate_tracking_links",
      "affiliate_salary_deals",
      "affiliate_goals",
      "affiliate_prospect_interests",
    ],
  },
  {
    key: "comision_afiliados",
    label: "Comisión afiliados",
    description: "Planes de comisión de afiliados, objetivos por marca y cierres de comisiones.",
    tables: [
      "affiliate_commission_plans",
      "brand_cpa_goals",
      "commission_closures",
      "commission_closure_items",
      "commission_closure_feedback",
    ],
  },
];

export async function buildBundleZip(bundle: Bundle): Promise<Blob> {
  const zip = new JSZip();
  const summary: string[] = [];
  // Prefix numeric to preserve import order alphabetically
  for (let i = 0; i < bundle.tables.length; i++) {
    const t = bundle.tables[i];
    const rows = await fetchAll(t);
    const csv = rowsToCsv(rows, t);
    const name = `${String(i + 1).padStart(2, "0")}_${t}.csv`;
    zip.file(name, csv);
    summary.push(`${name}  ->  ${rows.length} filas`);
  }

  const readme = `Bundle de importación: ${bundle.label}
Generado: ${new Date().toISOString()}

Orden de importación (cargar en este orden para preservar relaciones):
${summary.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}

Formato:
  - CSV UTF-8, separador coma, comillas dobles.
  - Se incluyen TODAS las columnas, incluido "id" (UUID) para preservar
    relaciones de claves foráneas entre tablas.
  - Las columnas que en Postgres son arrays o JSONB están serializadas
    como JSON string. Al importar, hay que parsearlas con JSON.parse y
    pasarlas como array/objeto a Supabase.
  - Las fechas están en formato ISO 8601.

Cómo importar en el proyecto nuevo:
  1. Asegurarse de que el esquema (tablas, enums, triggers) ya existe.
  2. Para cada archivo, en el orden numérico del nombre, ejecutar:
       INSERT ... ON CONFLICT (id) DO NOTHING
     (o usar el script de importación del proyecto destino).
  3. Tras importar 'affiliates' ajustar la secuencia:
       SELECT setval('public.affiliate_id_seq', 85);

Notas:
  - Las columnas que referencian auth.users (created_by, updated_by,
    answered_by, resolved_by, requested_by, user_id) se exportan VACÍAS
    para evitar violar FKs cuando los usuarios no existen en el destino.
  - Storage (avatars, logos, knowledge docs) tampoco se incluye.
`;

  zip.file("README.txt", readme);
  return zip.generateAsync({ type: "blob" });
}
