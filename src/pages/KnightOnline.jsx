import { useMemo, useState } from "react";
import { useStore } from "../lib/store.jsx";
import { useT } from "../i18n.js";
import { makeMoney, ago } from "../lib/data.js";
import { Section, LineChart, Select, Input, Delta, TrendChip, StanceChip, Sparkline } from "../components/ui.jsx";

export default function KnightOnline({ ko, hist, trends, query }) {
  const { lang, currency, fx } = useStore(); const t = useT(lang); const M = makeMoney(currency, fx, lang);
  const servers = ko?.servers || []; const sources = Object.keys(ko?.bySource || {}); const L = (k) => ko?.labels?.[k]?.label || k;
  const tr = trends?.servers || {};
  const [server, setServer] = useState(query.get("server") && servers.includes(query.get("server")) ? query.get("server") : servers.includes("Zero") ? "Zero" : servers[0] || "");
  const [side, setSide] = useState("buy"); const [range, setRange] = useState("30");
  const [gb, setGb] = useState(10); const [fee, setFee] = useState(20);

  const best = useMemo(() => { const o = {}; for (const s of servers) { let b = null; for (const src of sources) { const v = ko.bySource[src]?.[s]; if (v?.buy != null && (!b || v.buy > b.buy)) b = { src, buy: v.buy }; } o[s] = b; } return o; }, [ko]);
  const chart = useMemo(() => {
    const snaps = (hist?.snapshots || []).filter((x) => Date.parse(x[0]) > Date.now() - Number(range) * 86400e3);
    const series = {}; const labels = [];
    for (const [ts, rows] of snaps) { labels.push(ts); for (const [src, srv, buy, sell] of rows) { if (srv !== server) continue; (series[src] ||= {})[ts] = side === "buy" ? buy : sell; } }
    const colors = ["#2563eb", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#06b6d4"];
    const datasets = Object.entries(series).map(([src, m], i) => ({ label: L(src), data: labels.map((l) => m[l] == null ? null : M.conv(m[l] / fx.usdtry)), borderColor: colors[i % 6], backgroundColor: colors[i % 6], spanGaps: true }));
    return { labels: labels.map((l) => new Date(l).toLocaleString(lang === "tr" ? "tr-TR" : "en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })), datasets, n: snaps.length };
  }, [hist, server, side, range, currency, lang]);
  const arb = useMemo(() => servers.map((s) => { let a = null, b = null; for (const src of sources) { const v = ko.bySource[src]?.[s]; if (!v) continue; if (v.sell != null && (!a || v.sell < a.p)) a = { src, p: v.sell }; if (v.buy != null && (!b || v.buy > b.p)) b = { src, p: v.buy }; } return a && b ? { s, a, b, r: b.p / a.p } : null; }).filter(Boolean).sort((x, y) => y.r - x.r), [ko]);
  const calc = sources.map((src) => ({ src, v: ko?.bySource[src]?.[server] })).filter((r) => r.v?.buy != null).sort((a, b) => b.v.buy - a.v.buy);
  const x = tr[server] || {};
  if (!ko) return null;
  return (
    <>
      <Section title={t.ko.title} sub={t.ko.sub} right={<span className="text-xs text-slate-500">{t.common.updated} {ago(ko.ts, lang)} · {Object.entries(ko.status || {}).filter(([k]) => ko.bySource[k]).map(([k, s]) => <span key={k} className={`ml-1 ${s.ok ? "chip-up" : s.stale ? "chip-warn" : "chip-down"}`}>{L(k)}</span>)}</span>}>
        <div className="card overflow-x-auto">
          <table className="w-full"><thead><tr><th className="th sticky-col">{t.ko.server}</th>{sources.map((s) => <th key={s} className="th text-right">{L(s)}<div className="text-[10px] font-normal normal-case tracking-normal text-slate-400">{t.ko.buy} / {t.ko.sell}</div></th>)}<th className="th text-right">{t.ko.bestBuy}</th><th className="th text-right">{t.ko.change24}</th><th className="th text-right">{t.ko.change7}</th><th className="th">{t.ko.trend}</th><th className="th">{t.ko.signal}</th><th className="th">7d</th></tr></thead>
            <tbody>{servers.map((s) => { const b = best[s]; const y = tr[s] || {}; return (
              <tr key={s} className={s === server ? "bg-indigo-50/50 dark:bg-indigo-500/5" : ""} onClick={() => setServer(s)} style={{ cursor: "pointer" }}>
                <td className="td sticky-col font-bold">{s}</td>
                {sources.map((src) => { const v = ko.bySource[src]?.[s]; const isB = b?.src === src; return <td key={src} className={`td text-right num ${isB ? "best" : ""}`}>{v ? <>{v.buy != null ? M.fromTL(v.buy) : <span className="text-slate-400">—</span>} <span className="text-slate-400">/ {v.sell != null ? M.fromTL(v.sell) : "—"}</span>{v.buyVia && <div className="text-[10px] text-slate-400">{t.ko.viaAgg}</div>}</> : <span className="text-slate-400">—</span>}</td>; })}
                <td className="td text-right num font-bold">{b ? M.fromTL(b.buy) : "—"}<div className="text-[10px] font-normal text-slate-400">{b ? L(b.src) : ""}</div></td>
                <td className="td text-right"><Delta v={y.change24h} /></td><td className="td text-right"><Delta v={y.change7d} /></td>
                <td className="td"><TrendChip trend={y.signal?.trend} t={t} /></td><td className="td"><StanceChip stance={y.signal?.stance} confidence={y.signal?.confidence} t={t} /></td>
                <td className="td"><Sparkline points={y.sparkline7d || []} w={90} h={28} up={y.signal?.trend === "up" ? true : y.signal?.trend === "down" ? false : null} /></td>
              </tr>); })}</tbody></table>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t.sig.disclaimer} {trends?.dataDays != null ? `${trends.dataDays} ${t.ko.dataDays}.` : ""} {trends?.dataDays != null && trends.dataDays < 3 ? t.ko.collecting : ""}</p>
      </Section>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="card p-4 lg:col-span-3">
          <div className="flex flex-wrap items-end gap-3">
            <Select label={t.ko.server} value={server} onChange={setServer} options={servers} className="w-36" />
            <Select label={t.ko.side} value={side} onChange={setSide} options={[{ value: "buy", label: t.ko.buy }, { value: "sell", label: t.ko.sell }]} className="w-36" />
            <Select label={t.ko.range} value={range} onChange={setRange} options={[{ value: "7", label: `7 ${t.ko.days}` }, { value: "30", label: `30 ${t.ko.days}` }, { value: "90", label: `90 ${t.ko.days}` }]} className="w-32" />
            <div className="ml-auto grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-4">
              <div>{t.ko.change30}<div className="text-sm"><Delta v={x.change30d} /></div></div>
              <div>{t.ko.min30}<div className="num text-sm font-semibold text-slate-700 dark:text-slate-200">{M.fromTL(x.min30d)}</div></div>
              <div>{t.ko.max30}<div className="num text-sm font-semibold text-slate-700 dark:text-slate-200">{M.fromTL(x.max30d)}</div></div>
              <div>{t.ko.posIn30}<div className="num text-sm font-semibold text-slate-700 dark:text-slate-200">{x.positionIn30d != null ? `${Math.round(x.positionIn30d * 100)}%` : "—"}</div></div>
            </div>
          </div>
          <div className="mt-3">{chart.n ? <LineChart labels={chart.labels} datasets={chart.datasets} fmtY={(v, d) => `${M.sym}${Number(v).toLocaleString(lang === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: d ?? 0 })}`} /> : <div className="py-16 text-center text-sm text-slate-500">{t.ko.noHist}</div>}</div>
          {x.signal && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><StanceChip stance={x.signal.stance} confidence={x.signal.confidence} t={t} /><TrendChip trend={x.signal.trend} t={t} /><span className="text-slate-600 dark:text-slate-300">{lang === "tr" ? x.signal.reasonTR : x.signal.reasonEN}</span><span className="text-xs text-slate-400">({t.sig[x.signal.confidence]})</span></div>}
        </div>
        <div className="card p-4 lg:col-span-2">
          <h3 className="text-sm font-bold">{t.ko.calc}</h3>
          <div className="mt-3 grid grid-cols-2 gap-3"><Input label={t.ko.amount} type="number" value={gb} min="0.1" step="0.1" onChange={(e) => setGb(Number(e.target.value))} /><Input label={t.ko.fee} type="number" value={fee} min="0" onChange={(e) => setFee(Number(e.target.value))} /></div>
          <table className="mt-3 w-full">{calc.map((r, i) => { const net = r.v.buy * gb - fee; return <tr key={r.src}><td className="td">{i === 0 ? "🥇 " : ""}{L(r.src)}{ko.labels[r.src]?.kind === "aggregator" ? <span className="text-xs text-slate-400"> ({t.ko.viaAgg})</span> : ""}</td><td className="td text-right num text-slate-500">{M.fromTL(r.v.buy)}/GB</td><td className={`td text-right num font-bold ${i === 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{M.fromTL(net)}</td></tr>; })}</table>
        </div>
      </div>

      <Section title={t.ko.arb} sub={t.ko.arbSub}>
        <div className="card overflow-x-auto"><table className="w-full"><thead><tr><th className="th">{t.ko.server}</th><th className="th text-right">{t.ko.cheapestBuy}</th><th className="th text-right">{t.ko.priciestSell}</th><th className="th text-right">{t.ko.ratio}</th><th className="th text-right">{t.ko.per10}</th></tr></thead>
          <tbody>{arb.map((r) => <tr key={r.s}><td className="td font-bold">{r.s}</td><td className="td text-right num">{M.fromTL(r.a.p)} <span className="text-xs text-slate-400">{L(r.a.src)}</span></td><td className="td text-right num">{M.fromTL(r.b.p)} <span className="text-xs text-slate-400">{L(r.b.src)}</span></td><td className={`td text-right num font-bold ${r.r >= 1 ? "text-emerald-600" : "text-rose-600 dark:text-rose-400"}`}>{r.r.toFixed(3)}</td><td className="td text-right num">{M.fromTL((r.b.p - r.a.p) * 10)}</td></tr>)}</tbody></table></div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{arb.some((r) => r.r >= 1) ? t.ko.arbYes : t.ko.noArb}</p>
      </Section>
    </>
  );
}
