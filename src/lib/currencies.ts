import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const FALLBACK = [
  "EUR","USD","GBP","ARS","BOB","BRL","CLP","COP","CRC","CUP","DOP",
  "GTQ","HNL","HTG","MXN","NIO","PAB","PEN","PYG","SVC","UYU","VES",
];

let cache: string[] | null = null;
const subs = new Set<(v: string[]) => void>();

async function fetchCurrencies() {
  const { data } = await supabase.from("currencies").select("code").order("code");
  let codes = (data ?? []).map((r: any) => r.code).filter(Boolean);
  if (!codes.length) codes = FALLBACK;
  // prioritize EUR and USD at the top
  const priority = ["EUR", "USD"];
  const prioritySet = new Set(priority);
  const prioritized = [
    ...priority.filter((c) => codes.includes(c)),
    ...codes.filter((c) => !prioritySet.has(c)),
  ];
  cache = prioritized;
  subs.forEach((cb) => cb(cache!));
}

export function useCurrencies() {
  const [list, setList] = useState<string[]>(cache ?? FALLBACK);
  useEffect(() => {
    subs.add(setList);
    if (!cache) fetchCurrencies();
    return () => { subs.delete(setList); };
  }, []);
  return list;
}
