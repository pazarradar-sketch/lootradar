import { useStore } from "../lib/store.jsx";
import { useT } from "../i18n.js";
import { makeMoney, ago } from "../lib/data.js";
import { Stat, Sparkline, Delta, TrendChip, StanceChip, Section } from "../components/ui.jsx";

export default function Home({ ko, trends, signals, fxInfo }) {
  const { lang, currency, fx } = useStore(); const t = useT(lang); const M = makeMoney(currency, fx, lang);
  const servers = ko?.servers || [];
  const tr = trends?.servers || {};
  const best = (s) => tr[s]?.bestBuy || null;
  const ranked = servers.filter(best).sort((a, b) => best(b).price - best(a).price);
  const liveN = ko ? Object.values(ko.status || {}).filter((x) => x.ok).length : 0, totalN = ko ? Object.keys(ko.bySource || {}).length : 0;
  const opp = (signals?.routes?.sk2cf || []).slice(0, 5);
  return (
    <>
      <div className="mt-6 overflow-hidden rounded-3xl brand-grad p-6 text-white shadow-lg sm:p-8 fade-in">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.hero.title}</h1>
          <p className="mt-2 text-sm text-white/85 sm:text-base">{t.hero.sub}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/80">
            <span className="rounded-full bg-white/15 px-3 py-1">{t.hero.updated}: {ago(ko?.ts, lang)}</span>
            <span className="rounded-full bg-white/15 px-3 py-1">{liveN}/{totalN} {t.hero.sources}</span>
            <a href="#/scan" className="rounded-full bg-white px-3 py-1 font-semibold text-indigo-700 hover:bg-white/90">{t.hero.cta} →</a>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t.kpi.fx} value={`$1 = ₺${fx.usdtry?.toFixed(2)}`} sub={fxInfo?.source} />
        <Stat label={t.kpi.bestServer} value={ranked[0] || "—"} sub={ranked[0] ? `${M.fromTL(best(ranked[0]).price)} / GB · ${ko.labels?.[best(ranked[0]).src]?.label}` : ""} accent />
        <Stat label={t.kpi.cheapest} value={ranked[ranked.length - 1] || "—"} sub={ranked.length ? `${M.fromTL(best(ranked[ranked.length - 1]).price)} / GB` : ""} />
        <Stat label={t.kpi.sources} value={`${liveN}/${totalN}`} sub={t.kpi.liveOf} />
      </div>

      <Section title={t.ko.title} sub={t.sig.what} right={<a href="#/ko" className="btn-ghost">{t.common.more} →</a>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map((s) => { const x = tr[s] || {}; const sig = x.signal || {}; return (
            <a key={s} href={`#/ko?server=${s}`} className="card p-4 transition hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div><div className="text-base font-bold">{s}</div><div className="text-xs text-slate-500 dark:text-slate-400">{t.ko.bestBuy} · {ko.labels?.[x.bestBuy?.src]?.label}</div></div>
                <StanceChip stance={sig.stance} confidence={sig.confidence} t={t} />
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div><div className="text-2xl font-extrabold num">{M.fromTL(x.bestBuy?.price)}</div><div className="mt-0.5 flex gap-3 text-xs"><span>{t.ko.change24} <Delta v={x.change24h} /></span><span>{t.ko.change7} <Delta v={x.change7d} /></span></div></div>
                <Sparkline points={x.sparkline7d || []} up={x.signal?.trend === "up" ? true : x.signal?.trend === "down" ? false : null} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400"><TrendChip trend={sig.trend} t={t} /><span>{lang === "tr" ? sig.reasonTR : sig.reasonEN}</span></div>
            </a>); })}
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t.sig.disclaimer} {trends?.dataDays != null && trends.dataDays < 3 ? t.ko.collecting : ""}</p>
      </Section>

      {opp.length > 0 && (
        <Section title={t.scan.title} sub={t.scan.r_sk2cf} right={<a href="#/scan" className="btn-ghost">{t.common.more} →</a>}>
          <div className="card overflow-x-auto"><table className="w-full"><thead><tr><th className="th">{lang === "tr" ? "Ürün" : "Item"}</th><th className="th text-right">{t.scan.buyAt}</th><th className="th text-right">{t.scan.sellAt}</th><th className="th text-right">{t.scan.net}</th><th className="th text-right">{t.scan.ratio}</th></tr></thead>
            <tbody>{opp.map((r) => <tr key={r[0]}><td className="td"><a className="hover:underline" href={`#/cs2?item=${encodeURIComponent(r[0])}`}>{r[0]}</a></td><td className="td text-right num">{M.fmt(r[1])}</td><td className="td text-right num">{M.fmt(r[2])}</td><td className="td text-right num">{M.fmt(r[3])}</td><td className={`td text-right num font-bold ${r[4] >= 1 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{r[4].toFixed(3)}</td></tr>)}</tbody></table></div>
        </Section>
      )}
    </>
  );
}
