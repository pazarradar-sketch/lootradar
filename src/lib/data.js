const cache = new Map();
export async function loadJson(name, { fresh = false } = {}) {
  const key = name;
  if (!fresh && cache.has(key)) return cache.get(key);
  const p = fetch(`${import.meta.env.BASE_URL}data/${name}?t=${Math.floor(Date.now() / 300000)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  cache.set(key, p);
  return p;
}
/** USD tutarını seçili para birimine çevir. TL kaynaklı değer için fromTL=true. */
export function makeMoney(currency, fx, lang) {
  const loc = lang === "tr" ? "tr-TR" : "en-US";
  const sym = { TRY: "₺", USD: "$", EUR: "€" }[currency] || currency;
  const conv = (usd) => (currency === "TRY" ? usd * fx.usdtry : currency === "EUR" ? usd * (fx.usdeur || 0.92) : usd);
  const fmt = (usd, d) => {
    if (usd == null || !Number.isFinite(usd)) return "—";
    const v = conv(usd);
    const digits = d ?? (Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 1 : 2);
    return `${sym}${v.toLocaleString(loc, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  };
  const fromTL = (tl, d) => fmt(tl == null ? null : tl / fx.usdtry, d);
  return { fmt, fromTL, conv, sym, currency };
}
export const pct = (v, d = 1) => (v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)}%`);
export const ago = (iso, lang) => {
  if (!iso) return "—";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (lang === "tr") return m < 1 ? "az önce" : m < 60 ? `${m} dk önce` : m < 2880 ? `${Math.round(m / 60)} sa önce` : `${Math.round(m / 1440)} gün önce`;
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
export const n = (v, lang) => (v == null ? "—" : Number(v).toLocaleString(lang === "tr" ? "tr-TR" : "en-US"));
