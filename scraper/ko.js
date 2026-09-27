import { get, writeJson, readJson, numTL, log } from "./lib.js";

/** Sunucu adını normalize et: "Knight Online Zero Gold Bar GB" → "Zero" */
const SERVERS = ["Zero", "Felis", "Pandora", "Agartha", "Dryads", "Destan", "Minark", "Oreads", "Zion"];
const norm = (s) => { const t = String(s).toLowerCase(); for (const x of SERVERS) if (t.includes(x.toLowerCase())) return x; return null; };
const strip = (h) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

// Her kaynak: { server: { buy, sell } }  — buy = siteye SATARKEN aldığın (farmcı tarafı), sell = siteden ALIRKEN ödediğin. TL / 1 GB.
const SOURCES = {
  bynogame: {
    url: "https://www.bynogame.com/tr/oyunlar/knight-online/gold-bar", label: "ByNoGame", kind: "direct",
    parse(h) {
      const out = {};
      for (const m of h.matchAll(/<article[^>]*ins-product-id=(\d+)[^>]*>([\s\S]*?)<\/article>/g)) {
        const a = m[2];
        const name = a.match(/alt="?([^">]*Gold Bar[^">]*)/)?.[1] || strip(a).slice(0, 80);
        const srv = norm(name); if (!srv) continue;
        const sell = numTL(a.match(/ins-product-price=([\d.]+)/)?.[1]);
        const buy = numTL(a.match(/([\d.,]+)\s*TL'den B[İI]ZE SAT/)?.[1]);
        out[srv] = { buy, sell };
      }
      return out;
    },
  },
  gamesatis: {
    url: "https://www.gamesatis.com/knight-online-goldbar", label: "GameSatış", kind: "direct",
    parse(h) {
      const out = {};
      for (const m of h.matchAll(/goldbar-row-name"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)goldbar-row-(?:actions|qty|buttons|form|footer)|goldbar-row-name"[^>]*>([\s\S]*?)<\/a>([\s\S]{0,1200})/g)) {
        const name = strip(m[1] || m[3] || ""); const body = m[2] || m[4] || "";
        const srv = norm(name); if (!srv) continue;
        const prices = [...body.matchAll(/<label>(Al[ıi]ş|Sat[ıi]ş) Fiyat[ıi]<\/label>\s*<div[^>]*data-unit-price="([\d.]+)"/g)];
        const buy = numTL(prices.find((p) => /Al/.test(p[1]))?.[2]);
        const sell = numTL(prices.find((p) => /Sat/.test(p[1]))?.[2]);
        if (buy != null || sell != null) out[srv] = { buy, sell };
      }
      return out;
    },
  },
  kopazar: {
    url: "https://www.kopazar.com/knight-online-gold-bar", label: "Kopazar", kind: "direct",
    parse(h) {
      const out = {};
      for (const m of h.matchAll(/<input[^>]*data-maxbuy="(\d+)"[^>]*data-maxsell="(\d+)"[^>]*data-buyprice="([\d.]+)"[^>]*data-goldname="([^"]+)"[^>]*data-sellprice="([\d.]+)"/g)) {
        const srv = norm(m[4]); if (!srv) continue; // fiyatlar 10M başına → ×10; maxbuy/maxsell 0 ise o taraf kapalı
        out[srv] = { buy: Number(m[1]) > 0 ? Math.round(Number(m[3]) * 1000) / 100 : null, sell: Number(m[2]) > 0 ? Math.round(Number(m[5]) * 1000) / 100 : null };
      }
      return out;
    },
  },
  oyunfor: {
    url: "https://www.oyunfor.com/knight-online/gb-gold-bar", label: "Oyunfor", kind: "direct", sellOnly: true,
    parse(h) {
      const out = {};
      for (const m of h.matchAll(/"name":"Knight Online ([A-Za-zİı]+) GB"[^}]*?"price":"([\d.]+)"/g)) {
        const srv = norm(m[1]); if (!srv || out[srv]) continue; // 10M başına
        out[srv] = { buy: null, sell: Math.round(Number(m[2]) * 1000) / 100 };
      }
      return out;
    },
  },
  korehberi: {
    url: "https://korehberi.com/en-ucuz-gb", label: "KO Rehberi (toplayıcı)", kind: "aggregator",
    // Toplayıcı tablo: satır = satıcı (img alt), sütun = sunucu (Satış, Alış). Sadece doğrudan çekemediğimiz satıcılar için.
    parse(h) {
      const rows = [...h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
      const head = rows[0] ? [...rows[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => strip(c[1])) : [];
      const servers = head.slice(1).map(norm);
      const out = {};
      for (const r of rows.slice(2)) {
        const cells = [...r.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1]);
        const seller = cells[0]?.match(/alt="?([a-z0-9]+)/i)?.[1]?.toLowerCase(); if (!seller) continue;
        const vals = cells.slice(1).map((c) => numTL(strip(c)));
        const per = {};
        servers.forEach((srv, i) => { if (!srv) return; const sell = vals[i * 2], buy = vals[i * 2 + 1]; if (sell != null || buy != null) per[srv] = { buy, sell }; });
        out[seller] = per;
      }
      return out; // { seller: { server: {buy,sell} } }
    },
  },
};

export async function scrapeKo() {
  const ts = new Date().toISOString();
  const bySource = {}; const status = {};
  for (const [key, src] of Object.entries(SOURCES)) {
    try {
      const h = await get(src.url);
      const p = src.parse(h);
      if (key === "korehberi") {
        // Doğrudan çekilemeyen satıcılar: bursagb (alış+satış), oyunfor alış tarafı
        if (p.bursagb) { bySource.bursagb = p.bursagb; status.bursagb = { ok: true, ts, via: "korehberi" }; }
        if (p.oyunfor && bySource.oyunfor) for (const [srv, v] of Object.entries(p.oyunfor)) { if (bySource.oyunfor[srv] && bySource.oyunfor[srv].buy == null && v.buy != null) { bySource.oyunfor[srv].buy = v.buy; bySource.oyunfor[srv].buyVia = "korehberi"; } }
        status[key] = { ok: true, ts, sellers: Object.keys(p) };
      } else {
        bySource[key] = p; status[key] = { ok: Object.keys(p).length > 0, ts, n: Object.keys(p).length };
      }
      log("ko", key, Object.keys(p).length);
    } catch (e) { status[key] = { ok: false, ts, error: e.message }; log("ko hata", key, e.message); if (e.fatal) break; }
  }
  // Kaynak başarısızsa önceki değeri koru (bayat işaretiyle)
  const prev = readJson("ko_latest.json", null);
  for (const key of Object.keys(SOURCES).concat("bursagb")) { if (!bySource[key] && prev?.bySource?.[key]) { bySource[key] = prev.bySource[key]; status[key] = { ...(status[key] || {}), ok: false, stale: true, ts: prev.status?.[key]?.ts }; } }

  const labels = { ...Object.fromEntries(Object.entries(SOURCES).map(([k, v]) => [k, { label: v.label, kind: v.kind, url: v.url }])), bursagb: { label: "BursaGB", kind: "aggregator", url: "https://www.bursagb.com" } };
  const latest = { ts, bySource, status, labels, servers: SERVERS.filter((s) => Object.values(bySource).some((src) => src[s])) };
  writeJson("ko_latest.json", latest, true);

  // Geçmiş: saatlik anlık görüntü [ts, [[source, server, buy, sell], ...]]; 90 gün saatlik + günlük özet
  const hist = readJson("ko_history.json", { snapshots: [] });
  const rows = [];
  for (const [src, per] of Object.entries(bySource)) { if (status[src]?.stale) continue; for (const [srv, v] of Object.entries(per)) rows.push([src, srv, v.buy, v.sell]); }
  if (rows.length) hist.snapshots.push([ts, rows]);
  const cutoff = Date.now() - 90 * 86400e3;
  const old = hist.snapshots.filter((s) => Date.parse(s[0]) < cutoff);
  hist.snapshots = hist.snapshots.filter((s) => Date.parse(s[0]) >= cutoff);
  if (old.length) {
    const daily = readJson("ko_daily.json", { days: {} });
    for (const [t, rs] of old) { const d = t.slice(0, 10); daily.days[d] ||= {}; for (const [src, srv, buy, sell] of rs) daily.days[d][`${src}|${srv}`] = [buy, sell]; }
    writeJson("ko_daily.json", daily);
  }
  writeJson("ko_history.json", hist);
  log("ko yazıldı", rows.length, "satır,", hist.snapshots.length, "anlık görüntü");
  return latest;
}
