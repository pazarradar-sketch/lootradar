import { readJson, writeJson, log } from "./lib.js";

/**
 * KO GB trend/sinyal özeti → docs/data/ko_trends.json
 * Girdi: ko_latest.json (anlık), ko_history.json (90 gün saatlik), ko_daily.json (daha eski günlük).
 * Sunucu başına "en iyi alış" serisi (her anlık görüntüde kaynaklar arası en yüksek alış) üzerinden
 * 1s/24s/7g/30g değişim, 7g/30g min-max, 30g konum, sparkline, volatilite ve al/sat/bekle sinyali.
 * Az veriyle (bugün başlamış geçmiş) de çalışır: yetersiz alanlar null.
 */
const H = 3600e3, D = 86400e3;
const pct = (a, b) => (a != null && b != null && b !== 0 ? Math.round(((a - b) / b) * 10000) / 100 : null);
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

/** Sunucu → sıralı [ts(ms), bestBuy] serisi (daily + hourly). */
function buildSeries(hist, daily) {
  const series = {};
  const push = (srv, t, p) => { if (p == null) return; (series[srv] ||= []).push([t, p]); };
  for (const [d, per] of Object.entries(daily?.days || {})) {
    const t = Date.parse(d + "T12:00:00Z"); if (!Number.isFinite(t)) continue;
    const best = {};
    for (const [k, v] of Object.entries(per)) { const srv = k.split("|")[1]; const buy = v?.[0]; if (buy != null && (best[srv] == null || buy > best[srv])) best[srv] = buy; }
    for (const [srv, p] of Object.entries(best)) push(srv, t, p);
  }
  for (const [ts, rows] of hist?.snapshots || []) {
    const t = Date.parse(ts); if (!Number.isFinite(t)) continue;
    const best = {};
    for (const [, srv, buy] of rows) if (buy != null && (best[srv] == null || buy > best[srv])) best[srv] = buy;
    for (const [srv, p] of Object.entries(best)) push(srv, t, p);
  }
  for (const s of Object.values(series)) s.sort((a, b) => a[0] - b[0]);
  return series;
}

/** t anındaki (veya hemen öncesindeki) fiyat; seri o kadar geriye gitmiyorsa null. */
function priceAt(series, t) {
  if (!series.length || series[0][0] > t) return null;
  let v = null;
  for (const [ts, p] of series) { if (ts <= t) v = p; else break; }
  return v;
}

function downsample(points, max) {
  if (points.length <= max) return points;
  const out = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round((i * (points.length - 1)) / (max - 1))]);
  return out;
}

function stdev(xs) {
  if (xs.length < 3) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function buildKoTrends() {
  const latest = readJson("ko_latest.json", null);
  if (!latest?.bySource) { log("ko_trends: ko_latest yok, atlandı"); return null; }
  const hist = readJson("ko_history.json", { snapshots: [] });
  const daily = readJson("ko_daily.json", { days: {} });
  const series = buildSeries(hist, daily);
  const now = Date.now();
  const servers = latest.servers || Object.keys(series);
  const out = { ts: new Date().toISOString(), servers: {} };

  for (const srv of servers) {
    let bestBuy = null, bestSell = null;
    for (const [src, per] of Object.entries(latest.bySource)) {
      const v = per?.[srv]; if (!v) continue;
      if (v.buy != null && (bestBuy == null || v.buy > bestBuy.price)) bestBuy = { src, price: v.buy };
      if (v.sell != null && (bestSell == null || v.sell < bestSell.price)) bestSell = { src, price: v.sell };
    }
    const s = series[srv] || [];
    const cur = s.length ? s[s.length - 1][1] : bestBuy?.price ?? null;
    const first = s.length ? s[0][0] : now;
    const dataDays = Math.round(((now - first) / D) * 10) / 10;
    const chg = (span) => (cur == null ? null : pct(cur, priceAt(s, now - span)));
    const win = (span) => s.filter(([t]) => t >= now - span).map(([, p]) => p);
    const w7 = win(7 * D), w30 = win(30 * D);
    const min7 = w7.length ? Math.min(...w7) : null, max7 = w7.length ? Math.max(...w7) : null;
    const min30 = w30.length ? Math.min(...w30) : null, max30 = w30.length ? Math.max(...w30) : null;
    const positionIn30d = cur == null || min30 == null ? null : max30 === min30 ? 0.5 : Math.round(((cur - min30) / (max30 - min30)) * 1000) / 1000;
    const pts7 = s.filter(([t]) => t >= now - 7 * D);
    const sparkline7d = downsample(pts7, 84).map(([t, p]) => [new Date(t).toISOString().slice(0, 16) + "Z", p]);
    // Saatlik yüzde değişimler (ardışık noktalar; en az 30 dk aralıklı olanlar)
    const rets = [];
    for (let i = 1; i < pts7.length; i++) { const [t0, p0] = pts7[i - 1], [t1, p1] = pts7[i]; if (t1 - t0 >= 0.5 * H && p0) rets.push(((p1 - p0) / p0) * 100); }
    const volatility7d = r2(stdev(rets));

    const change1h = chg(H), change24h = chg(D), change7d = chg(7 * D), change30d = chg(30 * D);
    const TH = 1.5;
    const sig = (x) => (x == null ? null : x >= TH ? 1 : x <= -TH ? -1 : 0);
    const s24 = sig(change24h), s7 = sig(change7d);
    let trend = "flat";
    if (s24 != null && s7 != null) trend = s24 === 1 && s7 === 1 ? "up" : s24 === -1 && s7 === -1 ? "down" : "flat";
    else { const one = s24 ?? s7; trend = one === 1 ? "up" : one === -1 ? "down" : "flat"; }
    let stance = "hold"; // 1 günden az geçmişle 30g aralığı anlamsız → bekle
    if (dataDays >= 1 && positionIn30d != null && positionIn30d >= 0.85 && trend !== "up") stance = "sell";
    else if (dataDays >= 1 && positionIn30d != null && positionIn30d <= 0.15 && trend !== "down") stance = "buy";
    const confidence = dataDays < 3 ? "low" : dataDays < 14 ? "med" : "high";
    const f = (x) => (x == null ? "—" : (x > 0 ? "+" : "") + x.toFixed(1) + "%");
    const posTR = positionIn30d == null ? "" : `, 30g aralığında %${Math.round(positionIn30d * 100)}`;
    const posEN = positionIn30d == null ? "" : `, at ${Math.round(positionIn30d * 100)}% of 30d range`;
    const trendTR = { up: "yükseliş", down: "düşüş", flat: "yatay" }[trend];
    const stanceTR = { sell: "sat (zirveye yakın)", buy: "al/bekle-tut (dibe yakın)", hold: "bekle" }[stance];
    const stanceEN = { sell: "sell (near 30d high)", buy: "buy/hold (near 30d low)", hold: "hold" }[stance];
    const confTR = { low: "az veri", med: "orta veri", high: "yeterli veri" }[confidence];
    const reasonTR = `24s ${f(change24h)}, 7g ${f(change7d)} → ${trendTR}${posTR}; ${stanceTR} (${confTR}, ${dataDays} gün)`;
    const reasonEN = `24h ${f(change24h)}, 7d ${f(change7d)} → ${trend}${posEN}; ${stanceEN} (${confidence} confidence, ${dataDays}d of data)`;

    out.servers[srv] = {
      bestBuy, bestSell,
      spreadPct: bestBuy && bestSell ? r2(((bestSell.price - bestBuy.price) / bestBuy.price) * 100) : null,
      current: cur, change1h, change24h, change7d, change30d,
      min7d: min7, max7d: max7, min30d: min30, max30d: max30, positionIn30d,
      sparkline7d, volatility7d, dataDays, points: s.length,
      signal: { trend, stance, confidence, reasonTR, reasonEN },
    };
  }
  writeJson("ko_trends.json", out, true);
  log("ko_trends yazıldı", Object.keys(out.servers).length, "sunucu");
  return out;
}
