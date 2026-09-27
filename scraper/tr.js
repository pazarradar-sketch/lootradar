import { get, getJson, readJson, writeJson, sleep, numTL, log } from "./lib.js";

/**
 * Türk pazarlarında CS2 skin TL ilan fiyatları (en iyi çaba) → docs/data/cs2_tr.json
 *  - itemsatis.com: /ilanlar/cs-2-skins.html + ?page=2..N (HTML kartlar; başlıklar çoğunlukla Türkçe Steam adı)
 *  - ByNoGame: sayfa Vue ile çizildiğinden HTML'de ürün yok; sitenin açık JSON ucu gw.bynogame.com/steam-products/v2/products
 *    (marketHashName + priceMin TL + listingCount + Türkçe ad). Türkçe adlar itemsatis eşleştirmesi için sözlük olarak da kullanılır.
 * Eşleştirme: başlık normalize (küçük harf, aksan/İ katlama, "|"/parantez/emoji temizliği, aşınma kısaltmaları+Türkçe aşınma
 * sözcükleri, birkaç Türkçe→İngilizce kelime) → (1) Türkçe tam ad sözlüğü, (2) Türkçe kısa ad + aşınma, (3) token kapsama:
 * başlığın tüm token'ları aday market_hash_name içinde, aşınma/StatTrak/Souvenir eşit, tek aday → güvenli eşleşme.
 * Nazik: sayfa istekleri arası 1,5 sn.
 */
const POLITE_MS = 1500;
/** itemsatis "15,629.29 ₺" (ABD biçimi) veya "569,99 TL" → sayı. */
const priceTL = (s) => { const t = String(s).replace(/[\s₺]|TL/g, ""); if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(t) || /^\d+\.\d{1,2}$/.test(t)) return Number(t.replace(/,/g, "")); return numTL(t); };
const WEARS = { "factory new": "Factory New", "minimal wear": "Minimal Wear", "field-tested": "Field-Tested", "field tested": "Field-Tested", "well-worn": "Well-Worn", "well worn": "Well-Worn", "battle-scarred": "Battle-Scarred", "battle scarred": "Battle-Scarred" };
const WEAR_ABBR = { fn: "Factory New", mw: "Minimal Wear", ft: "Field-Tested", ww: "Well-Worn", bs: "Battle-Scarred" };
const WEAR_TR = { "fabrikadan yeni cikmis": "Factory New", "fabrikadan yeni": "Factory New", "az asinmis": "Minimal Wear", "gorevde kullanilmis": "Field-Tested", "eskimis": "Well-Worn", "savas gormus": "Battle-Scarred" };
// Küçük statik Türkçe→İngilizce sözlük (ByNoGame sözlüğü boşsa da bir şeyler eşleşsin diye)
const TR_WORDS = [
  ["ruyalar ve kabuslar kasasi", "dreams & nightmares case"], ["ruyalar ve kabuslar", "dreams & nightmares"], ["devrim kasasi", "revolution case"],
  ["kelebek bicagi", "butterfly knife"], ["kelebek bicak", "butterfly knife"], ["talon bicagi", "talon knife"], ["golge hancerler", "shadow daggers"],
  ["hayatta kalma bicagi", "survival knife"], ["av bicagi", "huntsman knife"], ["susturucu bicagi", "bayonet"], ["kasap bicagi", "bowie knife"],
  ["pala bicagi", "falchion knife"], ["kirik dis eldivenleri", "broken fang gloves"], ["surucu eldivenleri", "driver gloves"], ["uzman eldivenleri", "specialist gloves"],
  ["spor eldivenleri", "sport gloves"], ["el sargilari", "hand wraps"], ["moto eldivenleri", "moto gloves"], ["hidra eldivenleri", "hydra gloves"],
  ["kizil ag", "crimson web"], ["safari agi", "safari mesh"], ["morotesi", "ultraviolet"], ["kaplan disi", "tiger tooth"], ["katliam", "slaughter"],
  ["muzik kiti", "music kit"], ["cikartma kapsulu", "sticker capsule"], ["cikartma", "sticker"], ["kapsulu", "capsule"], ["kapsul", "capsule"],
  ["kasasi", "case"], ["kasa", "case"], ["anahtari", "key"], ["anahtar", "key"], ["bicagi", "knife"], ["bicak", "knife"], ["eldivenleri", "gloves"], ["eldiven", "gloves"],
  ["parlak", "holo"], ["altin", "gold"], ["gumus", "silver"], ["ajan", "agent"], ["grafiti", "graffiti"], ["hatira", "souvenir"],
];
const NOISE = new Set(["cs2", "csgo", "cs", "go", "skin", "skins", "hizli", "teslimat", "aninda", "otomatik", "ucuz", "en", "ve", "ile", "the", "x", "adet", "etiketli", "isim", "stickerli", "cikartmali"]);

const fold = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[™®]/g, "");
/** Başlıktan {base, wear, stattrak, souvenir} çıkar; base: küçük harf, aksansız, tokenlenmeye hazır. */
export function parseTitle(title) {
  let t = fold(title);
  t = t.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{3000}-\u{303F}\u{3130}-\u{318F}\u{FE00}-\u{FE0F}\u{2000}-\u{206F}\u{2500}-\u{25FF}\u{2190}-\u{21FF}]/gu, " ").replace(/[★☆【】「」\[\]{}]/g, " ");
  let wear = null;
  for (const [k, v] of Object.entries(WEAR_TR)) if (t.includes(k)) { wear = v; t = t.replace(k, " "); }
  for (const [k, v] of Object.entries(WEARS)) if (!wear && t.includes(k)) { wear = v; t = t.replace(k, " "); }
  t = t.replace(/\(([^)]*)\)/g, " $1 ");
  const stattrak = /stat\s*-?\s*trak/.test(t); t = t.replace(/stat\s*-?\s*trak/g, " ");
  const souvenir = /\b(souvenir|hatira)\b/.test(t); t = t.replace(/\b(souvenir|hatira)\b/g, " ");
  t = t.replace(/\b\d+\s*x?\s*(sticker|cikartma)\w*/g, " "); // "5x sticker" = üstündeki çıkartmalar, ürün adı değil
  const tokenize = (str) => { const words = str.split(/[^a-z0-9&]+/).filter(Boolean); const kept = []; for (const w of words) { if (WEAR_ABBR[w]) { wear ||= WEAR_ABBR[w]; continue; } if (w === "st" && words.length > 2) continue; if (NOISE.has(w) || /^\$?\d+(x|\$)?$/.test(w) || /^\d+x$/.test(w)) continue; kept.push(w); } return kept; };
  const rawTokens = tokenize(t);
  for (const [a, b] of TR_WORDS) t = t.replace(new RegExp(`\\b${a}\\b`, "g"), b);
  const kept = tokenize(t);
  return { base: kept.join(" "), tokens: kept, rawKey: rawTokens.join(" "), wear, stattrak, souvenir, fake: /\bfake\b/.test(t) };
}

const wearOf = (name) => { const m = name.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/); return m ? m[1] : null; };
const tokensOf = (name) => fold(name).replace(/\(([^)]*)\)\s*$/, "").split(/[^a-z0-9&]+/).filter(Boolean);

/** Eşleştirici: cs2.json adları + ByNoGame Türkçe sözlüğü. */
export function makeMatcher(names, trDict = {}) {
  const idx = new Map(); // token → Set(name)
  const info = new Map();
  for (const n of names) {
    const toks = tokensOf(n).filter((t) => t !== "stattrak" && t !== "souvenir");
    info.set(n, { toks: new Set(toks), wear: wearOf(n), stattrak: /StatTrak/.test(n), souvenir: /^Souvenir /.test(n) });
    for (const t of toks) { if (!idx.has(t)) idx.set(t, new Set()); idx.get(t).add(n); }
  }
  const nameSet = new Set(names);
  const trFull = new Map(), trShort = new Map();
  for (const [tr, en] of Object.entries(trDict.full || {})) trFull.set(fold(tr).replace(/[^a-z0-9&]+/g, " ").trim(), en);
  for (const [tr, en] of Object.entries(trDict.short || {})) trShort.set(fold(tr).replace(/[^a-z0-9&]+/g, " ").trim(), en);
  const compose = (short, p) => { const st = p.stattrak ? "StatTrak™ " : ""; const star = short.startsWith("★ ") ? "★ " : ""; const body = short.replace(/^★ /, ""); const w = p.wear ? ` (${p.wear})` : ""; const cands = [`${star}${st}${body}${w}`, `${p.souvenir ? "Souvenir " : ""}${body}${w}`]; return cands.find((c) => nameSet.has(c)) || null; };
  return function match(title) {
    const p = parseTitle(title);
    if (p.fake || !p.tokens.length) return null;
    // 1) Türkçe tam ad (aşınma ile) → hash
    const full = fold(title).replace(/[★☆™®]/g, " ").replace(/[^a-z0-9&]+/g, " ").trim();
    if (trFull.has(full) && nameSet.has(trFull.get(full))) return trFull.get(full);
    // 2) Türkçe kısa ad + aşınma
    for (const key of [p.rawKey, p.tokens.join(" ")]) if (trShort.has(key)) { const c = compose(trShort.get(key), p); if (c) return c; }
    // 3) token kapsama
    let cand = null;
    for (const t of p.tokens) { const s = idx.get(t); if (!s) return null; cand = cand ? [...cand].filter((n) => s.has(n)) : [...s]; if (!cand.length) return null; }
    cand = cand.filter((n) => { const i = info.get(n); return i.wear === p.wear && i.stattrak === p.stattrak && i.souvenir === p.souvenir; });
    if (cand.length === 1) return cand[0];
    if (cand.length > 1) { cand.sort((a, b) => info.get(a).toks.size - info.get(b).toks.size); if (info.get(cand[0]).toks.size < info.get(cand[1]).toks.size) return cand[0]; }
    return null;
  };
}

async function scrapeItemsatis(pages) {
  const rows = []; let ok = false, err = null, fetched = 0;
  for (let p = 1; p <= pages; p++) {
    const url = "https://www.itemsatis.com/ilanlar/cs-2-skins.html" + (p > 1 ? `?page=${p}` : "");
    try {
      const h = await get(url); fetched++; ok = true;
      const cards = h.split(/post-card-v2__title/).slice(1);
      for (const c of cards) {
        const title = c.match(/^[^>]*>([^<]*)</)?.[1]?.replace(/&amp;/g, "&").trim(); if (!title) continue;
        const priceHtml = c.match(/class="AdvertPriceText[^"]*"[^>]*>([\s\S]{0,120}?)<\/div>/)?.[1];
        const price = priceHtml ? priceTL(priceHtml.replace(/<[^>]+>/g, "")) : null;
        const href = c.match(/postPriceGroup[\s\S]{0,300}?<a href="([^"]+)"/)?.[1];
        if (price != null) rows.push({ title, price, url: href ? "https://www.itemsatis.com" + href : null });
      }
      if (!new RegExp(`\\?page=${p + 1}"`).test(h)) break; // sonraki sayfa bağlantısı yoksa dur
    } catch (e) { err = e.message; log("itemsatis hata", p, e.message); if (e.fatal) break; }
    await sleep(POLITE_MS);
  }
  return { ok, err, pages: fetched, rows };
}

async function scrapeBynogame(pages) {
  const rows = []; let ok = false, err = null, fetched = 0, count = null;
  for (let p = 1; p <= pages; p++) {
    try {
      const j = await getJson(`https://gw.bynogame.com/steam-products/v2/products?limit=100&page=${p}&sort=ListingCount:-1&filters=`, { headers: { Accept: "application/json", Origin: "https://www.bynogame.com", Referer: "https://www.bynogame.com/tr/oyunlar/cs2-skin" } });
      const res = j?.data?.result; if (!Array.isArray(res)) throw new Error("beklenmeyen yanıt");
      fetched++; ok = true; count ??= j.data.count ?? null;
      let anyListing = false;
      for (const r of res) {
        const tr = r.hashData?.find?.((x) => x.langCode === "tr");
        rows.push({ name: r.marketHashName, price: r.listingCount > 0 && r.priceMin > 0 ? r.priceMin : null, n: r.listingCount || 0, sellUs: r.sellUsPrice > 0 ? r.sellUsPrice : null, trFull: tr?.full || null, trShort: tr?.short || null, short: r.marketHashNameShort || null });
        if (r.listingCount > 0) anyListing = true;
      }
      if (!anyListing || res.length < 100) break; // stok azalan sırada: ilansızlara gelince dur
    } catch (e) { err = e.message; log("bynogame hata", p, e.message); if (e.fatal) break; }
    await sleep(POLITE_MS);
  }
  return { ok, err, pages: fetched, count, rows };
}

export async function scrapeTr({ itemsatisPages = Number(process.env.ITEMSATIS_PAGES ?? 10), bynogamePages = Number(process.env.BNG_PAGES ?? 10) } = {}) {
  const cs2 = readJson("cs2.json", { items: {} });
  const names = Object.keys(cs2.items || {});
  const out = { ts: new Date().toISOString(), sources: {}, items: {}, unmatched: [] };
  const item = (n) => (out.items[n] ||= { itemsatisMinTL: null, itemsatisN: 0, bynogameMinTL: null, bynogameN: 0 });

  // ByNoGame önce: hem fiyat hem Türkçe ad sözlüğü
  const bng = await scrapeBynogame(bynogamePages);
  const trDict = { full: {}, short: {} };
  let bngMatched = 0;
  for (const r of bng.rows) {
    if (r.trFull && r.name) trDict.full[r.trFull] = r.name;
    if (r.trShort && r.short) trDict.short[r.trShort] = r.short;
    if (r.price == null) continue;
    if (!names.length || cs2.items[r.name]) { const it = item(r.name); if (it.bynogameMinTL == null || r.price < it.bynogameMinTL) it.bynogameMinTL = r.price; it.bynogameN = r.n; if (r.sellUs) it.bynogameSellUsTL = r.sellUs; bngMatched++; }
  }
  out.sources.bynogame = { ok: bng.ok, error: bng.err, pages: bng.pages, totalProducts: bng.count, n: bng.rows.filter((r) => r.price != null).length, matched: bngMatched, note: "HTML Vue ile çizildiği için sitenin JSON ucu (gw.bynogame.com/steam-products/v2/products) kullanıldı" };
  log("tr bynogame", out.sources.bynogame.n, "ilanlı ürün,", bngMatched, "eşleşti, sözlük", Object.keys(trDict.full).length);

  const match = makeMatcher(names, trDict);
  const its = await scrapeItemsatis(itemsatisPages);
  let itsMatched = 0; const seenUnmatched = new Set();
  for (const r of its.rows) {
    const n = match(r.title);
    if (!n) { if (!seenUnmatched.has(r.title) && out.unmatched.length < 50) { out.unmatched.push(r.title); seenUnmatched.add(r.title); } continue; }
    const it = item(n); itsMatched++;
    if (it.itemsatisMinTL == null || r.price < it.itemsatisMinTL) { it.itemsatisMinTL = r.price; it.itemsatisUrl = r.url; }
    it.itemsatisN++;
  }
  out.sources.itemsatis = { ok: its.ok, error: its.err, pages: its.pages, n: its.rows.length, matched: itsMatched, unmatched: its.rows.length - itsMatched };
  log("tr itemsatis", its.rows.length, "ilan,", itsMatched, "eşleşti");
  out.counts = { items: Object.keys(out.items).length };
  writeJson("cs2_tr.json", out);
  log("cs2_tr yazıldı", out.counts.items, "ürün");
  return out;
}
