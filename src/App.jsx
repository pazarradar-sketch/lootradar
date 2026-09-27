import { useEffect, useMemo, useState } from "react";
import { StoreProvider, useStore } from "./lib/store.jsx";
import { loadJson, ago } from "./lib/data.js";
import { useT } from "./i18n.js";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import KnightOnline from "./pages/KnightOnline.jsx";
import Cs2 from "./pages/Cs2.jsx";
import Scanner from "./pages/Scanner.jsx";
import { Alerts, Pricing, About } from "./pages/Misc.jsx";

const useHash = () => { const [h, setH] = useState(location.hash || "#/"); useEffect(() => { const f = () => setH(location.hash || "#/"); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []); const [path, qs] = h.slice(1).split("?"); const route = { "/": "home", "/ko": "ko", "/cs2": "cs2", "/scan": "scan", "/alerts": "alerts", "/pricing": "pricing", "/about": "about" }[path] || "home"; return { route, query: useMemo(() => new URLSearchParams(qs || ""), [qs]) }; };

function Shell() {
  const { route, query } = useHash(); const { lang, setFx } = useStore(); const t = useT(lang);
  const [d, setD] = useState({});
  useEffect(() => { (async () => { const [fx, ko, trends, meta] = await Promise.all([loadJson("fx.json"), loadJson("ko_latest.json"), loadJson("ko_trends.json"), loadJson("meta.json")]); if (fx?.usdtry) setFx({ usdtry: fx.usdtry, usdeur: fx.usdeur || 0.92 }); setD((s) => ({ ...s, fx, ko, trends, meta })); const [hist, signals] = await Promise.all([loadJson("ko_history.json"), loadJson("cs2_signals.json")]); setD((s) => ({ ...s, hist, signals })); })(); }, []);
  useEffect(() => { if ((route === "cs2" || route === "scan" || route === "home") && !d.cs2 && !d.cs2Loading) { setD((s) => ({ ...s, cs2Loading: true })); Promise.all([loadJson("cs2.json"), loadJson("cs2_tr.json"), loadJson("cs2_history.json")]).then(([cs2, tr, cs2hist]) => setD((s) => ({ ...s, cs2, tr, cs2hist }))); } }, [route]);
  useEffect(() => { scrollTo({ top: 0 }); }, [route]);
  const meta = d.ko ? `${t.common.updated} ${ago(d.ko.ts, lang)}` : null;
  const page = route === "ko" ? <KnightOnline ko={d.ko} hist={d.hist} trends={d.trends} query={query} />
    : route === "cs2" ? (d.cs2 ? <Cs2 cs2={d.cs2} tr={d.tr} signals={d.signals} cs2hist={d.cs2hist} query={query} /> : <div className="py-20 text-center text-sm text-slate-500">{t.common.loading}</div>)
    : route === "scan" ? (d.cs2 ? <Scanner cs2={d.cs2} signals={d.signals} /> : <div className="py-20 text-center text-sm text-slate-500">{t.common.loading}</div>)
    : route === "alerts" ? <Alerts /> : route === "pricing" ? <Pricing /> : route === "about" ? <About meta={d.meta} />
    : (d.ko ? <Home ko={d.ko} trends={d.trends} signals={d.signals} fxInfo={d.fx} /> : <div className="py-20 text-center text-sm text-slate-500">{t.common.loading}</div>);
  return <Layout route={route} meta={meta}>{page}</Layout>;
}
export default function App() { return <StoreProvider><Shell /></StoreProvider>; }
