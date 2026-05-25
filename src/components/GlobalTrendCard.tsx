import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import TrendCard from "@/components/TrendCard";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtMoney = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

function monthBounds(d: Date) {
  const y = d.getFullYear(), m = d.getMonth();
  return { first: new Date(y, m, 1), last: new Date(y, m + 1, 0), daysInMonth: new Date(y, m + 1, 0).getDate() };
}

type Row = { cpaCount?: number; cpaCommission?: number; revShareCommission?: number };

async function fetchTotals(from: Date, to: Date) {
  const { data } = await supabase.functions.invoke<{ data: Row[] }>("routy-proxy", {
    body: { from: `${iso(from)}T00:00:00`, to: `${iso(to)}T23:59:59` },
  });
  let cpa = 0, comm = 0;
  for (const r of data?.data ?? []) {
    cpa += Number(r.cpaCount) || 0;
    comm += (Number(r.cpaCommission) || 0) + (Number(r.revShareCommission) || 0);
  }
  return { cpa, comm };
}

export default function GlobalTrendCard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ cpa: 0, comm: 0, prevCpa: 0, prevComm: 0 });

  const today = new Date(); today.setHours(0,0,0,0);
  const { first, last, daysInMonth } = monthBounds(today);
  const dayOfMonth = today.getDate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const prev = new Date(first); prev.setMonth(prev.getMonth() - 1);
      const pm = monthBounds(prev);
      const [curr, prevTot] = await Promise.all([
        fetchTotals(first, last),
        fetchTotals(pm.first, pm.last),
      ]);
      if (cancelled) return;
      setData({ cpa: curr.cpa, comm: curr.comm, prevCpa: prevTot.cpa, prevComm: prevTot.comm });
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [first.getTime()]);

  if (loading) return null;

  return (
    <TrendCard
      title="Tendencia global del mes"
      daysInMonth={daysInMonth}
      dayOfMonth={dayOfMonth}
      metrics={[
        { label: "FTDs / CPAs", currentMTD: data.cpa, previousMonthTotal: data.prevCpa },
        { label: "Comisión total", currentMTD: data.comm, previousMonthTotal: data.prevComm, format: fmtMoney },
      ]}
    />
  );
}
