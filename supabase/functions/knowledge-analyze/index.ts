// Edge function: analyze a knowledge document with Lovable AI
// Downloads the file from Storage, asks the model for summary + extracted data + findings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(bin);
}

async function tryExtractPdfText(buf: Uint8Array): Promise<string | null> {
  try {
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    const t = (text || "").trim();
    return t.length >= 30 ? t : null;
  } catch (e) {
    console.warn("pdf text extract failed:", (e as any)?.message);
    return null;
  }
}

const SYSTEM = `Eres un analista experto en reportes de afiliación iGaming para "Overoption", una red de afiliados que cobra CPA y RevShare a casinos/operadores y paga CPA a sus afiliados (tipsters/influencers).

Recibirás un documento (PDF, Excel/CSV, o resumen de texto) con datos de un cliente. Debes:
1. Resumir en 4-8 líneas qué contiene el archivo y para qué sirve.
2. Extraer datos estructurados clave (períodos, marcas, monedas, IDs de campañas, métricas como FTD, NGR, jugadores calificados, comisión, etc.).
3. Identificar DUDAS, INCONSISTENCIAS y ALERTAS que un humano debería responder antes de facturar al cliente o pagar al afiliado. Sé exhaustivo: monedas mezcladas, totales que no cuadran, jugadores bloqueados sin explicación, campañas no mapeadas, períodos faltantes, valores negativos sospechosos, formatos extraños, etc.

MEMORIA DEL CLIENTE — MUY IMPORTANTE:
Si en el mensaje del usuario aparece un bloque "### Preguntas ya respondidas previamente por el operador", significa que ese cliente YA RESPONDIÓ esas dudas en documentos anteriores similares.
- NO vuelvas a generar un finding sobre un tema ya respondido satisfactoriamente, salvo que la respuesta previa sea claramente insuficiente, ambigua, evasiva, o que el dato del documento actual NO ENCAJE con esa respuesta.
- Si la respuesta previa NO ACLARA la duda para este nuevo documento, vuelves a preguntar, pero cita textualmente la respuesta previa en el campo "detail" y explica por qué no es suficiente esta vez.
- Si una respuesta previa SÍ resuelve un patrón recurrente (p.ej. "esa moneda es siempre BRL"), aplícala como dato confirmado en "extracted" y no la conviertas en finding.

Devuelve SIEMPRE la respuesta llamando a la función "submit_analysis".`;

const TOOL = {
  type: "function",
  function: {
    name: "submit_analysis",
    description: "Devuelve el análisis estructurado del documento.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Resumen en español, 4-8 líneas." },
        extracted: {
          type: "object",
          description: "Datos clave estructurados detectados en el archivo (libre).",
          properties: {
            periods: { type: "array", items: { type: "string" } },
            brands: { type: "array", items: { type: "string" } },
            currencies: { type: "array", items: { type: "string" } },
            metrics: { type: "object" },
            tables: { type: "array", items: { type: "object" } },
          },
          additionalProperties: true,
        },
        findings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["question", "inconsistency", "warning", "info"] },
              severity: { type: "string", enum: ["low", "medium", "high"] },
              title: { type: "string" },
              detail: { type: "string" },
              context: { type: "object" },
            },
            required: ["kind", "severity", "title", "detail"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "findings"],
      additionalProperties: false,
    },
  },
};

async function callModel(model: string, userParts: any[]) {
  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userParts },
      ],
      tools: [TOOL],
      tool_choice: { type: "function", function: { name: "submit_analysis" } },
    }),
  });
  return aiResp;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);

    const { document_id } = await req.json();
    if (!document_id) return json({ error: "document_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: doc, error: docErr } = await admin
      .from("knowledge_documents").select("*").eq("id", document_id).maybeSingle();
    if (docErr || !doc) return json({ error: "doc not found" }, 404);

    await admin.from("knowledge_documents").update({ status: "analyzing", analysis_error: null }).eq("id", document_id);

    // Download file
    const { data: file, error: dlErr } = await admin.storage.from("client-knowledge").download(doc.file_path);
    if (dlErr || !file) {
      await admin.from("knowledge_documents").update({ status: "failed", analysis_error: dlErr?.message ?? "download failed" }).eq("id", document_id);
      return json({ error: "download failed" }, 500);
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    const mime = (doc.mime_type || file.type || "").toLowerCase();
    const name = doc.file_name as string;
    const ext = name.toLowerCase().split(".").pop() || "";

    // Build user message
    const baseText = `Cliente ID: ${doc.client_id}\nArchivo: ${name}\nCategoría: ${doc.category ?? "—"}\nNotas: ${doc.notes ?? "—"}\n\nAnaliza el contenido y devuelve summary + extracted + findings vía la función submit_analysis.`;
    const userParts: any[] = [{ type: "text", text: baseText }];

    // Memoria: traer findings previos respondidos/resueltos del MISMO cliente (excluyendo este doc)
    const { data: prevFindings } = await admin
      .from("knowledge_findings")
      .select("title, detail, kind, severity, status, answer, answered_at")
      .eq("client_id", doc.client_id)
      .neq("document_id", document_id)
      .in("status", ["answered", "resolved", "dismissed"])
      .not("answer", "is", null)
      .order("answered_at", { ascending: false })
      .limit(80);

    if (prevFindings && prevFindings.length) {
      const memo = prevFindings.map((p: any, i: number) =>
        `${i + 1}. [${p.status}/${p.severity}] ${p.title}` +
        (p.detail ? `\n   Contexto: ${String(p.detail).slice(0, 300)}` : "") +
        `\n   Respuesta del operador: ${String(p.answer).slice(0, 600)}`
      ).join("\n\n");
      userParts.push({
        type: "text",
        text: `### Preguntas ya respondidas previamente por el operador (memoria del cliente)\n` +
              `Usa esto para NO repetir preguntas ya aclaradas. Solo vuelve a preguntar si la respuesta previa es ambigua o no aplica al nuevo documento.\n\n${memo}`,
      });
    }


    let pdfTextOnly = false;
    if (mime === "application/pdf" || ext === "pdf") {
      // Try to pre-extract text — much more reliable than sending binary PDF
      const txt = await tryExtractPdfText(buf);
      if (txt) {
        pdfTextOnly = true;
        userParts.push({
          type: "text",
          text: `Texto extraído del PDF "${name}" (puede estar truncado a 80k caracteres):\n\n${txt.slice(0, 80000)}`,
        });
      } else {
        // Fallback: send PDF as base64 inline (works for image/scanned PDFs via Gemini)
        const b64 = bytesToBase64(buf);
        userParts.push({ type: "image_url", image_url: { url: `data:application/pdf;base64,${b64}` } });
        userParts.push({
          type: "text",
          text: "No se pudo extraer texto del PDF (probablemente es una imagen escaneada). Intenta interpretarlo igualmente; si no es legible, indícalo en findings con severity=high.",
        });
      }
    } else if (ext === "csv" || mime.includes("csv") || mime.startsWith("text/")) {
      const txt = new TextDecoder("utf-8", { fatal: false }).decode(buf).slice(0, 80000);
      userParts.push({ type: "text", text: `Contenido del archivo (texto, posiblemente truncado a 80k caracteres):\n\n${txt}` });
    } else if (ext === "xlsx" || ext === "xls" || mime.includes("sheet") || mime.includes("excel")) {
      const b64 = bytesToBase64(buf);
      userParts.push({
        type: "text",
        text: `Archivo Excel (.${ext}) en base64 (${buf.byteLength} bytes). Si no podés leer el binario, pedí en findings que el usuario lo convierta a CSV. Base64 (truncado): ${b64.slice(0, 4000)}...`,
      });
    } else {
      const b64 = bytesToBase64(buf.slice(0, 200000));
      userParts.push({ type: "text", text: `Archivo desconocido (${mime || ext}). Base64 parcial: ${b64.slice(0, 2000)}...` });
    }

    // First attempt: Pro for binary PDFs (vision), Flash for text-only payloads (faster + cheaper)
    const primaryModel = pdfTextOnly || ext === "csv" || mime.includes("csv") || mime.startsWith("text/")
      ? "google/gemini-2.5-flash"
      : "google/gemini-2.5-pro";

    let aiResp = await callModel(primaryModel, userParts);
    let usedModel = primaryModel;

    let parsed: any = null;
    let lastRaw = "";

    if (aiResp.ok) {
      const data = await aiResp.json();
      const call = data?.choices?.[0]?.message?.tool_calls?.[0];
      try { parsed = call?.function?.arguments ? JSON.parse(call.function.arguments) : null; } catch { parsed = null; }
      if (!parsed) lastRaw = data?.choices?.[0]?.message?.content || "";
    } else {
      lastRaw = await aiResp.text();
    }

    // Fallback to flash if primary failed or returned no structured output
    if (!parsed && primaryModel !== "google/gemini-2.5-flash") {
      console.log("Retrying with gemini-2.5-flash…");
      aiResp = await callModel("google/gemini-2.5-flash", userParts);
      usedModel = "google/gemini-2.5-flash";
      if (aiResp.ok) {
        const data = await aiResp.json();
        const call = data?.choices?.[0]?.message?.tool_calls?.[0];
        try { parsed = call?.function?.arguments ? JSON.parse(call.function.arguments) : null; } catch { parsed = null; }
        if (!parsed) lastRaw = data?.choices?.[0]?.message?.content || lastRaw;
      } else {
        lastRaw = await aiResp.text();
      }
    }

    if (!parsed) {
      const status = aiResp.status;
      const msg = status === 429 ? "Rate limit excedido. Intenta nuevamente en un minuto."
                : status === 402 ? "Sin créditos en Lovable AI. Agrega créditos en Settings → Workspace → Usage."
                : `Sin respuesta estructurada del modelo (${usedModel}). ${String(lastRaw).slice(0, 300)}`;
      await admin.from("knowledge_documents").update({ status: "failed", analysis_error: msg.slice(0, 1000) }).eq("id", document_id);
      return json({ error: msg }, 500);
    }

    // Persist
    await admin.from("knowledge_documents").update({
      status: "analyzed",
      analysis_summary: parsed.summary ?? null,
      analysis_extracted: parsed.extracted ?? null,
      analyzed_at: new Date().toISOString(),
      analysis_error: null,
    }).eq("id", document_id);

    // Replace findings (clear existing ones from this doc and insert new)
    await admin.from("knowledge_findings").delete().eq("document_id", document_id);
    const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
    if (findings.length) {
      const rows = findings.map((f: any) => ({
        document_id,
        client_id: doc.client_id,
        kind: f.kind || "question",
        severity: f.severity || "medium",
        title: String(f.title || "").slice(0, 280),
        detail: f.detail ?? null,
        context: f.context ?? null,
      }));
      await admin.from("knowledge_findings").insert(rows);
    }

    return json({ ok: true, findings: findings.length, model: usedModel });
  } catch (e: any) {
    console.error("knowledge-analyze error:", e);
    return json({ error: e?.message ?? "unknown" }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
