// Lightweight FX rate helper. Fetches rates from a free public API
// (open.er-api.com — no API key required) and caches per base currency.
// Used to convert amounts to a target currency for display purposes.

import { useEffect, useState } from "react";

type RatesMap = Record<string, number>;
const cache = new Map<string, RatesMap>();
const inflight = new Map<string, Promise<RatesMap>>();
const subs = new Set<() => void>();

async function fetchRates(base: string): Promise<RatesMap> {
  const key = base.toUpperCase();
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;
  const p = (async () => {
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${key}`);
      const json = await res.json();
      const rates: RatesMap = json?.rates ?? {};
      rates[key] = 1;
      cache.set(key, rates);
      subs.forEach((cb) => cb());
      return rates;
    } catch {
      const empty: RatesMap = { [key]: 1 };
      cache.set(key, empty);
      return empty;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export function convert(amount: number, from: string, to: string, rates: RatesMap | undefined): number | null {
  if (!Number.isFinite(amount)) return null;
  if (!from || !to) return null;
  if (from.toUpperCase() === to.toUpperCase()) return amount;
  if (!rates) return null;
  const r = rates[to.toUpperCase()];
  if (!r || !Number.isFinite(r)) return null;
  return amount * r;
}

export function useFxRates(bases: (string | null | undefined)[]): Record<string, RatesMap> {
  const wanted = Array.from(new Set(bases.filter(Boolean).map((b) => b!.toUpperCase())));
  const [, setTick] = useState(0);
  useEffect(() => {
    const cb = () => setTick((n) => n + 1);
    subs.add(cb);
    wanted.forEach((b) => { if (!cache.has(b)) fetchRates(b); });
    return () => { subs.delete(cb); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted.join(",")]);
  const out: Record<string, RatesMap> = {};
  wanted.forEach((b) => { const r = cache.get(b); if (r) out[b] = r; });
  return out;
}
