import { getJson, get, writeJson, readJson, sleep, log } from "./lib.js";

/**
 * CS2 nakit pazar verisi: CSFloat fiyat listesi (anahtarsız) + Skinport ürün listesi (anahtarsız, br zorunlu)
 * + Steam en popüler N sayfa (anonim, sayfa başı 10, 4 sn aralık; 429'da dur).
 * Çıktı docs/data/cs2.json: { ts, items: { name: [csfloatMin, csfloatQty, skMin, skMedian, skQty, steamAsk, steamListings] } }
 */
export async function scrapeCs2({ steamPages = 30 } = {}) {
  const prev = readJson("cs2.json", { items: {} });
  const items = {};
  const put = (name, i, v) => { (items[name] ||= [null, null, null, null, null, null, null])[i] = v; };

  try {
    const cf = await getJson("https://csfloat.com/api/v1/listings/price-list");
    const arr = Array.isArray(cf) ? cf : cf.data || [];
    for (const r of arr) { if (r.min_price != null) { put(r.market_hash_name, 0, r.min_price / 100); put(r.market_hash_name, 1, r.quantity ?? null); } }
    log("csfloat", arr.length);
  } catch (e) { log("csfloat hata", e.message); }

  try {
    const sp = JSON.parse(await get("https://api.skinport.com/v1/items?app_id=730&currency=USD", { brotli: true }));
    for (const r of sp) { if (r.min_price != null) { put(r.market_hash_name, 2, r.min_price); put(r.market_hash_name, 3, r.median_price ?? null); put(r.market_hash_name, 4, r.quantity ?? null); } }
    log("skinport", sp.length);
  } catch (e) { log("skinport hata", e.message); }

  // Steam: popülerlik sırası, anonim 10/sayfa. Eski değerleri koru, yenileri üzerine yaz.
  for (const [name, v] of Object.entries(prev.items || {})) { if (v[5] != null) { put(name, 5, v[5]); put(name, 6, v[6]); } }
  let steamOk = 0, steamStop = null;
  for (let p = 0; p < steamPages; p++) {
    try {
      const r = await getJson(`https://steamcommunity.com/market/search/render/?query=&start=${p * 10}&count=10&search_descriptions=0&sort_column=popular&sort_dir=desc&appid=730&norender=1`, { retries: 0 });
      for (const x of r.results || []) { put(x.hash_name, 5, x.sell_price / 100); put(x.hash_name, 6, x.sell_listings); steamOk++; }
    } catch (e) { steamStop = e.message; log("steam dur:", e.message); break; }
    await sleep(4200);
  }
  const out = { ts: new Date().toISOString(), counts: { csfloat: Object.values(items).filter((v) => v[0] != null).length, skinport: Object.values(items).filter((v) => v[2] != null).length, steam: Object.values(items).filter((v) => v[5] != null).length, steamFresh: steamOk }, steamStop, items };
  writeJson("cs2.json", out);
  log("cs2 yazıldı", out.counts);
  return out;
}
