import { useEffect, useMemo, useState } from "react";
import { useStore } from "../lib/store.jsx";
import { useT } from "../i18n.js";
import { makeMoney, ago, n as fmtN } from "../lib/data.js";
import { Section, Input, Delta, Empty, LineChart } from "../components/ui.jsx";

export default function Cs2({ cs2, tr, signals, cs2hist, query }) {
  const { lang, currency, fx } = useStore(); const t = useT(lang); const M = makeMoney(currency, fx, lang);
  const items = cs2?.items || {}; const names = useMemo(() => Object.keys(items), [cs2]);
  const [q, setQ] = useState(""); const [list, setList] = useState([]); const [cur, setCur] = useState(-1);
  const [name, setName] = useState(query.get("item") && items[query.get("item")] ? query.get("item") : "");
  const [qty, setQty] = useState(1); const [price, setPrice] = useState(""); const [tl, setTl] = useState(""); const [cfw, setCfw] = useState(2.5); const [fxl, setFxl] = useState(1);
  useEffect(() => { const u = query.get("item"); if (u && items[u]) setName(u); }, [query, cs2]);
  const v = name ? items[name] : null;
  useEffect(() => { if (!v) return; const [cf, , sk, skm, , st] = v; const base = cf ?? sk ?? st; setPrice(base != null ? base.toFixed(2) : ""); const ref = st ?? (base != null ? base / 0.75 : null); const trI = tr?.items?.[name]; setTl(trI?.itemsatisMinTL ?? (ref != null ? Math.round(ref * fx.usdtry * 0.88) : "")); setQ(name); }, [name]);
  const search = (s) => { setQ(s); const tt = s.trim().toLowerCase(); setCur(-1); if (tt.length < 2) return setList([]); const sc = []; for (const nm of names) { const l = nm.toLowerCase(); const r = l.startsWith(tt) ? 0 : l.includes(tt) ? 1 : tt.split(" ").every((w) => l.includes(w)) ? 2 : -1; if (r >= 0) { sc.push([r, nm]); if (sc.length > 400) break; } } sc.sort((a, b) => a[0] - b[0] || (items[b[1]][4] || 0) - (items[a[1]][4] || 0)); setList(sc.slice(0, 25).map((x) => x[1])); };
  const pick = (nm) => { setName(nm); setList([]); try { history.replaceState(null, "", `#/cs2?item=${encodeURIComponent(nm)}`); } catch {} };
  const key = (e) => { if (e.key === "ArrowDown") { setCur((c) => Math.min(c + 1, list.length - 1)); e.preventDefault(); } else if (e.key === "ArrowUp") { setCur((c) => Math.max(c - 1, 0)); e.preventDefault(); } else if (e.key === "Enter" && list.length) pick(list[cur >= 0 ? cur : 0]); else if (e.key === "Escape") setList([]); };

  const routes = useMemo(() => {
    if (!v) return []; const [cf, , sk, , , st] = v; const Q = Math.max(1, qty), p = (Number(price) || 0) * Q, T = (Number(tl) || 0) * Q, w = cfw / 100, l = fxl / 100;
    const rows = [];
    rows.push({ k: "cf", name: "CSFloat → Stripe → IBAN", price: M.fmt(p), fees: `2% + ${cfw}% + ${fxl}%`, netUsd: p * 0.98 * (1 - w) * (1 - l), note: lang === "tr" ? "1–4 iş günü; 7 gün Trade Protection sonrası listelenir" : "1–4 business days; listable after 7-day Trade Protection", cash: true });
    rows.push({ k: "is", name: "itemsatis → IBAN", price: M.fromTL(T), fees: "7% + 20 TL", netUsd: (T * 0.93 - 20) / fx.usdtry, note: lang === "tr" ? "alıcı bulmak gerek; T.C. kimlik doğrulaması" : "needs a buyer; Turkish ID verification", cash: true });
    if (st != null) rows.push({ k: "bng", name: "ByNoGame Bize Sat", price: M.fmt(st * Q), fees: lang === "tr" ? "Steam değerinin %65'i" : "65% of Steam value", netUsd: st * Q * 0.65, note: lang === "tr" ? "anında; 8 gün Steam koruması sonrası cüzdana" : "instant; wallet after 8-day Steam hold", cash: true });
    if (st != null) rows.push({ k: "steam", name: "Steam Community Market", price: M.fmt(st * Q), fees: "13%", netUsd: st * Q * 0.87, note: t.cs2.notCash, cash: false });
    rows.push({ k: "sp", name: "Skinport", price: sk != null ? M.fmt(sk * Q) : "—", fees: "8%", netUsd: null, note: t.cs2.noPay, cash: false });
    return rows;
  }, [v, qty, price, tl, cfw, fxl, currency, lang]);
  const bestNet = Math.max(...routes.filter((r) => r.cash && r.netUsd != null).map((r) => r.netUsd), -Infinity);
  const histSeries = useMemo(() => { if (!name || !cs2hist?.days) return null; const days = Object.keys(cs2hist.days).sort(); const pts = days.map((d) => [d, cs2hist.days[d][name]]).filter((x) => x[1]); if (pts.length < 2) return null; return { labels: pts.map((x) => x[0].slice(5)), datasets: [{ label: "CSFloat", data: pts.map((x) => x[1][0] == null ? null : M.conv(x[1][0])), borderColor: "#2563eb", spanGaps: true }, { label: "Skinport", data: pts.map((x) => x[1][1] == null ? null : M.conv(x[1][1])), borderColor: "#10b981", spanGaps: true }, { label: "Steam", data: pts.map((x) => x[1][2] == null ? null : M.conv(x[1][2])), borderColor: "#f59e0b", spanGaps: true }] }; }, [name, cs2hist, currency]);
  const liquid = signals?.liquid || [];
  const trI = tr?.items?.[name];

  return (
    <>
      <Section title={t.cs2.title} sub={t.cs2.sub} right={<span className="text-xs text-slate-500">{fmtN(names.length, lang)} {t.cs2.loaded} · {ago(cs2?.ts, lang)}</span>}>
        <div className="relative">
          <input className="input !py-3.5 !text-base" placeholder={t.cs2.search} value={q} onChange={(e) => search(e.target.value)} onKeyDown={key} onBlur={() => setTimeout(() => setList([]), 150)} />
          {list.length > 0 && <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">{list.map((nm, i) => <div key={nm} onMouseDown={() => pick(nm)} className={`flex cursor-pointer justify-between px-4 py-2 text-sm ${i === cur ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"}`}><span>{nm}</span><span className="num text-slate-400">{M.fmt(items[nm][0] ?? items[nm][2])}</span></div>)}</div>}
        </div>
        {!v && <Empty>{t.cs2.pick}</Empty>}
        {v && (() => { const [cf, cfq, sk, skm, skq, st, stl] = v; const ratio = st && (cf ?? sk) ? (cf ?? sk) / st : null; return (
          <div className="mt-4 fade-in">
            <h3 className="text-xl font-extrabold tracking-tight">{name}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[[t.cs2.csfloat, M.fmt(cf), cf != null ? `${fmtN(cfq, lang)} ${t.cs2.listings}` : "—"], [t.cs2.skinport, `${M.fmt(sk)} / ${M.fmt(skm)}`, sk != null ? `${fmtN(skq, lang)} ${t.cs2.listings} · ${t.cs2.noPay}` : "—"], [t.cs2.steam, M.fmt(st), st != null ? `${fmtN(stl, lang)} ${t.cs2.listings} · ${t.cs2.walletOnly}` : t.cs2.notTop], [t.cs2.ratio, ratio ? ratio.toFixed(2) : "—", ""]].map(([a, b, c]) => <div key={a} className="card p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{a}</div><div className="mt-1 text-xl font-extrabold num">{b}</div><div className="text-xs text-slate-500">{c}</div></div>)}
            </div>
            {trI && <div className="card mt-3 p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t.cs2.trItem}</div><div className="mt-1 flex flex-wrap gap-4 text-sm">{trI.itemsatisMinTL != null && <span>itemsatis: <b className="num">{M.fromTL(trI.itemsatisMinTL)}</b> <span className="text-slate-400">({trI.itemsatisN})</span></span>}{trI.bynogameMinTL != null && <span>ByNoGame: <b className="num">{M.fromTL(trI.bynogameMinTL)}</b> <span className="text-slate-400">({trI.bynogameN})</span></span>}</div></div>}
            <div className="mt-6"><h3 className="text-lg font-bold">{t.cs2.routes}</h3><p className="text-sm text-slate-500">{t.cs2.routesSub}</p>
              <div className="card mt-3 grid grid-cols-2 gap-3 p-4 md:grid-cols-5"><Input label={t.cs2.qty} type="number" min="1" value={qty} onChange={(e) => setQty(Number(e.target.value))} /><Input label={t.cs2.price} type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /><Input label={t.cs2.tlPrice} type="number" value={tl} onChange={(e) => setTl(e.target.value)} /><Input label={t.cs2.cfw} type="number" step="0.1" value={cfw} onChange={(e) => setCfw(Number(e.target.value))} /><Input label={t.cs2.fxl} type="number" step="0.1" value={fxl} onChange={(e) => setFxl(Number(e.target.value))} /></div>
              <div className="card mt-3 overflow-x-auto"><table className="w-full"><thead><tr><th className="th">{t.cs2.route}</th><th className="th text-right">{lang === "tr" ? "Fiyat" : "Price"}</th><th className="th">{t.cs2.fees}</th><th className="th text-right">{t.cs2.net}</th><th className="th">{t.cs2.note}</th></tr></thead>
                <tbody>{routes.map((r) => <tr key={r.k}><td className="td font-semibold">{r.name}</td><td className="td text-right num">{r.price}</td><td className="td text-slate-500">{r.fees}</td><td className={`td text-right num font-bold ${r.netUsd != null && r.cash && r.netUsd === bestNet ? "best" : !r.cash ? "text-slate-400" : ""}`}>{r.netUsd != null ? M.fmt(r.netUsd) : "—"}</td><td className="td !whitespace-normal text-xs text-slate-500">{r.note}</td></tr>)}</tbody></table></div>
              <p className="mt-2 text-sm">{t.cs2.bestNet}: <b className="num">{Number.isFinite(bestNet) ? M.fmt(bestNet) : "—"}</b></p>
            </div>
            {histSeries && <div className="card mt-6 p-4"><h3 className="text-sm font-bold">{t.cs2.hist}</h3><div className="mt-2"><LineChart labels={histSeries.labels} datasets={histSeries.datasets} fmtY={(x, d) => M.sym + Number(x).toLocaleString(undefined, { maximumFractionDigits: d ?? 2 })} height={200} /></div></div>}
          </div>); })()}
      </Section>
      {liquid.length > 0 && (
        <Section title={t.cs2.liquid}>
          <div className="card overflow-x-auto"><table className="w-full"><thead><tr><th className="th">{lang === "tr" ? "Ürün" : "Item"}</th><th className="th text-right">CSFloat</th><th className="th text-right">Skinport</th><th className="th text-right">Steam</th><th className="th text-right">{t.cs2.ratio}</th><th className="th text-right">{t.cs2.change7}</th><th className="th text-right">Skinport {t.cs2.listings}</th></tr></thead>
            <tbody>{liquid.slice(0, 60).map((r) => <tr key={r[0]} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => pick(r[0])}><td className="td">{r[0]}</td><td className="td text-right num">{M.fmt(r[1])}</td><td className="td text-right num">{M.fmt(r[2])}</td><td className="td text-right num">{M.fmt(r[4])}</td><td className="td text-right num">{r[4] && (r[1] ?? r[2]) ? ((r[1] ?? r[2]) / r[4]).toFixed(2) : "—"}</td><td className="td text-right"><Delta v={r[7]} /></td><td className="td text-right num text-slate-500">{fmtN(r[5], lang)}</td></tr>)}</tbody></table></div>
        </Section>
      )}
    </>
  );
}
