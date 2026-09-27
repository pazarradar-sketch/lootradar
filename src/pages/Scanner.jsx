import { useMemo, useState } from "react";
import { useStore } from "../lib/store.jsx";
import { useT } from "../i18n.js";
import { makeMoney, ago, n as fmtN } from "../lib/data.js";
import { Section, Select, Input, Delta } from "../components/ui.jsx";

export default function Scanner({ cs2, signals }) {
  const { lang, currency, fx } = useStore(); const t = useT(lang); const M = makeMoney(currency, fx, lang);
  const [route, setRoute] = useState("sk2cf"); const [min, setMin] = useState(1); const [mq, setMq] = useState(20); const [N, setN] = useState("60");
  const rows = useMemo(() => {
    const items = cs2?.items || {}; const cfNet = (p) => p * 0.98 * 0.975; const out = [];
    const ch = signals?.change7d || {};
    for (const [nm, v] of Object.entries(items)) { const [cf, cfq, sk, , skq, st, stl] = v; let buy, sell, net, qa, qb;
      if (route === "sk2cf") { if (sk == null || cf == null) continue; buy = sk; sell = cf; net = cfNet(cf); qa = skq; qb = cfq; }
      else if (route === "cf2st") { if (cf == null || st == null) continue; buy = cf; sell = st; net = st * 0.87; qa = cfq; qb = stl; }
      else { if (st == null || cf == null) continue; buy = st; sell = cf; net = cfNet(cf); qa = stl; qb = cfq; }
      if (buy < min || (qa || 0) < mq || (qb || 0) < mq) continue; out.push({ nm, buy, sell, net, r: net / buy, qa, qb, c7: ch[nm] }); }
    out.sort((a, b) => b.r - a.r); return out;
  }, [cs2, route, min, mq, signals]);
  const top = rows.slice(0, Number(N)); const labels = { sk2cf: ["Skinport", "CSFloat"], cf2st: ["CSFloat", "Steam"], st2cf: ["Steam", "CSFloat"] }[route];
  return (
    <Section title={t.scan.title} sub={t.scan.sub} right={<span className="text-xs text-slate-500">{ago(cs2?.ts, lang)}</span>}>
      <div className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
        <Select label={t.scan.route} value={route} onChange={setRoute} options={[{ value: "sk2cf", label: t.scan.r_sk2cf }, { value: "cf2st", label: t.scan.r_cf2st }, { value: "st2cf", label: t.scan.r_st2cf }]} className="col-span-2 md:col-span-1" />
        <Input label={t.scan.minPrice} type="number" step="0.5" value={min} onChange={(e) => setMin(Number(e.target.value))} />
        <Input label={t.scan.minQty} type="number" step="5" value={mq} onChange={(e) => setMq(Number(e.target.value))} />
        <Select label={t.scan.rows} value={N} onChange={setN} options={["30", "60", "120"]} />
      </div>
      <p className="mt-2 text-xs text-slate-500">{fmtN(rows.length, lang)} {t.scan.passed} · {top.filter((x) => x.r >= 1).length} {t.scan.above1}</p>
      <div className="card mt-3 overflow-x-auto"><table className="w-full"><thead><tr><th className="th">{lang === "tr" ? "Ürün" : "Item"}</th><th className="th text-right">{t.scan.buyAt} ({labels[0]})</th><th className="th text-right">{t.scan.sellAt} ({labels[1]})</th><th className="th text-right">{t.scan.net}</th><th className="th text-right">{t.scan.ratio}</th><th className="th text-right">7d</th><th className="th text-right">{t.scan.qty}</th></tr></thead>
        <tbody>{top.map((x) => <tr key={x.nm}><td className="td"><a className="hover:underline" href={`#/cs2?item=${encodeURIComponent(x.nm)}`}>{x.nm}</a></td><td className="td text-right num">{M.fmt(x.buy)}</td><td className="td text-right num">{M.fmt(x.sell)}</td><td className="td text-right num">{M.fmt(x.net)}</td><td className={`td text-right num font-bold ${x.r >= 1.05 ? "text-emerald-600 dark:text-emerald-400" : x.r >= 1 ? "" : "text-slate-400"}`}>{x.r.toFixed(3)}</td><td className="td text-right"><Delta v={x.c7} /></td><td className="td text-right num text-slate-500">{fmtN(x.qa, lang)} / {fmtN(x.qb, lang)}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t.scan.guide}</p>
    </Section>
  );
}
