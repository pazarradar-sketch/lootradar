import { readJson, writeJson, log } from "./lib.js";

/**
 * cs2_history.json — günde bir (UTC) kompakt fiyat kaydı: { days: { "YYYY-MM-DD": { name: [csfloatMin, skMin, steamAsk] } } }, 180 gün.
 * Kapsam: Skinport adedine göre ilk 600 ürün + Steam fiyatı olan her ürün.
 * cs2_signals.json — üç rota (sk2cf, cf2st, st2cf) için en iyi 100 oran + likit 200 ürün + geçmişten 7g/30g değişim.
 * Ücret modeli: CSFloat net = fiyat×0.98×0.975 (satış komisyonu + Stripe çekim); Steam net = fiyat×0.87 (Steam+oyun kesintisi).
 */
const CF_NET = 0.98 * 0.975, ST_NET = 0.87, KEEP_DAYS = 180;
const today = () => new Date().toISOString().slice(0, 10);
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

function trackedNames(items) {
  const bySk = Object.entries(items).filter(([, v]) => v[4] != null).sort((a, b) => (b[1][4] || 0) - (a[1][4] || 0)).slice(0, 600).map(([n]) => n);
  const set = new Set(bySk);
  for (const [n, v] of Object.entries(items)) if (v[5] != null) set.add(n);
  return set;
}

export function snapshotCs2History() {
  const cs2 = readJson("cs2.json", null);
  if (!cs2?.items) { log("cs2_history: cs2.json yok"); return null; }
  const hist = readJson("cs2_history.json", { days: {} });
  const d = today();
  if (hist.days[d]) { log("cs2_history: bugün kayıtlı", d, Object.keys(hist.days).length, "gün"); return hist; }
  const rec = {};
  for (const n of trackedNames(cs2.items)) { const v = cs2.items[n]; rec[n] = [v[0] ?? null, v[2] ?? null, v[5] ?? null]; }
  hist.days[d] = rec;
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400e3).toISOString().slice(0, 10);
  for (const k of Object.keys(hist.days)) if (k < cutoff) delete hist.days[k];
  writeJson("cs2_history.json", hist);
  log("cs2_history yazıldı", d, Object.keys(rec).length, "ürün,", Object.keys(hist.days).length, "gün");
  return hist;
}

/** Geçmişte n gün önceki (±2 gün tolerans) fiyata göre yüzde değişim; idx: 0 csfloat, 1 skinport, 2 steam. */
function changeFn(hist) {
  const days = Object.keys(hist.days || {}).sort();
  const latestDay = days[days.length - 1];
  const dayAt = (n) => {
    const target = new Date(Date.now() - n * 86400e3).toISOString().slice(0, 10);
    let best = null, bestDiff = Infinity;
    for (const d of days) { const diff = Math.abs((Date.parse(d) - Date.parse(target)) / 86400e3); if (diff <= 2 && diff < bestDiff) { best = d; bestDiff = diff; } }
    return best && best !== latestDay ? best : null;
  };
  const refs = { 7: dayAt(7), 30: dayAt(30) };
  return (name, n, idx = 0) => {
    const d = refs[n]; if (!d) return null;
    const old = hist.days[d]?.[name]?.[idx], cur = hist.days[latestDay]?.[name]?.[idx];
    return old && cur ? r2(((cur - old) / old) * 100) : null;
  };
}

export function buildCs2Signals() {
  const cs2 = readJson("cs2.json", null);
  if (!cs2?.items) return null;
  const hist = readJson("cs2_history.json", { days: {} });
  const chg = changeFn(hist);
  const items = cs2.items;
  const MINQ = 20, MINP = 1;
  // [buy, sell, net, ratio, qtyA, qtyB]
  const routes = {
    sk2cf: (v) => v[2] != null && v[0] != null && v[4] >= MINQ && v[1] >= MINQ && v[2] >= MINP ? [v[2], v[0], v[0] * CF_NET, v[4], v[1]] : null,
    cf2st: (v) => v[0] != null && v[5] != null && v[1] >= MINQ && v[6] >= MINQ && v[0] >= MINP ? [v[0], v[5], v[5] * ST_NET, v[1], v[6]] : null,
    st2cf: (v) => v[5] != null && v[0] != null && v[6] >= MINQ && v[1] >= MINQ && v[5] >= MINP ? [v[5], v[0], v[0] * CF_NET, v[6], v[1]] : null,
  };
  const out = { ts: new Date().toISOString(), fees: { csfloatNet: r2(CF_NET), steamNet: ST_NET }, filters: { minQty: MINQ, minPriceUsd: MINP }, routes: {}, changes: {}, liquid: [] };
  const names = new Set();
  for (const [key, fn] of Object.entries(routes)) {
    const rows = [];
    for (const [name, v] of Object.entries(items)) {
      const r = fn(v); if (!r) continue;
      const [buy, sell, net, qa, qb] = r;
      rows.push([name, r2(buy), r2(sell), r2(net), Math.round((net / buy) * 1000) / 1000, qa, qb]);
    }
    rows.sort((a, b) => b[4] - a[4]);
    out.routes[key] = rows.slice(0, 100);
    for (const r of out.routes[key]) names.add(r[0]);
  }
  for (const n of names) { const c7 = chg(n, 7), c30 = chg(n, 30); if (c7 != null || c30 != null) out.changes[n] = [c7, c30]; }
  out.liquid = Object.entries(items).filter(([, v]) => v[4] != null).sort((a, b) => (b[1][4] || 0) - (a[1][4] || 0)).slice(0, 200)
    .map(([n, v]) => [n, v[0], v[2], v[3], v[5], v[4], v[1], chg(n, 7)]);
  out.historyDays = Object.keys(hist.days || {}).length;
  writeJson("cs2_signals.json", out);
  log("cs2_signals yazıldı", Object.fromEntries(Object.entries(out.routes).map(([k, v]) => [k, v.length])), "likit", out.liquid.length, "değişim", Object.keys(out.changes).length);
  return out;
}
