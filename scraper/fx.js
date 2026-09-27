import { getJson, get, writeJson, readJson, log } from "./lib.js";

/** USD/TRY: open.er-api (günlük) + TCMB (iş günü) — ikisi de anahtarsız. */
export async function scrapeFx() {
  const out = { ts: new Date().toISOString(), usdtry: null, source: null, tcmb: null };
  try {
    const j = await getJson("https://open.er-api.com/v6/latest/USD");
    if (j?.rates?.TRY) { out.usdtry = j.rates.TRY; out.usdeur = j.rates.EUR ?? null; out.source = "open.er-api.com"; out.updated = j.time_last_update_utc; }
  } catch (e) { log("fx er-api hata", e.message); }
  try {
    const x = await get("https://www.tcmb.gov.tr/kurlar/today.xml");
    const m = x.match(/CurrencyCode="USD"[\s\S]*?<ForexBuying>([\d.]+)<\/ForexBuying>[\s\S]*?<ForexSelling>([\d.]+)<\/ForexSelling>/);
    if (m) out.tcmb = { buying: Number(m[1]), selling: Number(m[2]) };
    if (!out.usdtry && out.tcmb) { out.usdtry = (out.tcmb.buying + out.tcmb.selling) / 2; out.source = "TCMB"; }
  } catch (e) { log("fx tcmb hata", e.message); }
  if (!out.usdtry) { const prev = readJson("fx.json", null); if (prev?.usdtry) { out.usdtry = prev.usdtry; out.source = prev.source + " (eski)"; } }
  writeJson("fx.json", out, true);
  log("fx", out.usdtry, out.source);
  return out;
}
