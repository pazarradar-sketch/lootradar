import { useStore } from "../lib/store.jsx";
import { useT } from "../i18n.js";
import { Section } from "../components/ui.jsx";

export function Alerts() {
  const { lang } = useStore(); const t = useT(lang);
  return (
    <Section title={t.alerts.title} sub={t.alerts.sub}>
      <div className="card p-6">
        <div className="chip-brand">{t.pricing.cta}</div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{t.alerts.soon}</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">{t.alerts.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm"><span className="mt-0.5 text-emerald-500">✓</span>{f}</li>)}</ul>
      </div>
    </Section>
  );
}
export function Pricing() {
  const { lang, currency, fx } = useStore(); const t = useT(lang);
  const proUsd = 4.99; const price = currency === "TRY" ? `₺${Math.round(proUsd * fx.usdtry)}` : currency === "EUR" ? `€${(proUsd * (fx.usdeur || 0.92)).toFixed(2)}` : `$${proUsd}`;
  return (
    <Section title={t.pricing.title} sub={t.pricing.sub}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-6"><div className="text-sm font-bold uppercase tracking-wider text-slate-500">{t.pricing.free}</div><div className="mt-2 text-3xl font-extrabold">0</div><ul className="mt-4 space-y-2 text-sm">{t.pricing.freeF.map((f) => <li key={f} className="flex gap-2"><span className="text-emerald-500">✓</span>{f}</li>)}</ul></div>
        <div className="card relative overflow-hidden p-6 ring-2 ring-indigo-500/40"><div className="absolute right-4 top-4 chip-brand">Pro</div><div className="text-sm font-bold uppercase tracking-wider text-slate-500">{t.pricing.pro}</div><div className="mt-2 text-3xl font-extrabold num">{price}<span className="text-base font-semibold text-slate-500">{t.pricing.mo}</span></div><ul className="mt-4 space-y-2 text-sm">{t.pricing.proF.map((f) => <li key={f} className="flex gap-2"><span className="text-emerald-500">✓</span>{f}</li>)}</ul><button className="btn-primary mt-6 w-full" disabled>{t.pricing.cta}</button><p className="mt-3 text-xs text-slate-500">{t.pricing.note}</p></div>
      </div>
    </Section>
  );
}
export function About({ meta }) {
  const { lang } = useStore(); const t = useT(lang); const tr = lang === "tr";
  const P = ({ children }) => <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{children}</p>;
  return (
    <Section title={t.about.title}>
      <div className="card p-6">
        <h3 className="font-bold">Knight Online</h3>
        <P>{tr ? "ByNoGame, GameSatış, Kopazar ve Oyunfor sayfaları doğrudan; BursaGB ve Oyunfor'un alış tarafı KO Rehberi toplayıcısından. Saatte bir çekilir; 90 gün saatlik, sonrası günlük saklanır. Kopazar ve Oyunfor 10M başına fiyat yayınlar, 1 GB = 100M'ye çevrilir. Sinyal: fiyatın 30 günlük aralıktaki konumu (≥%85 → SAT, ≤%15 → AL) ve 24 saat / 7 gün yönü; güven, biriken veri gününe göre." : "ByNoGame, GameSatış, Kopazar and Oyunfor are scraped directly; BursaGB and Oyunfor's buyback side come from the KO Rehberi aggregator. Hourly; 90 days hourly then daily. Kopazar and Oyunfor quote per 10M; converted to 1 GB = 100M. Signal: position within the 30-day range (≥85% → SELL, ≤15% → BUY) plus the 24h / 7d direction; confidence grows with days of data."}</P>
        <h3 className="mt-5 font-bold">CS2</h3>
        <P>{tr ? "CSFloat fiyat listesi ve Skinport ürün listesi saatlik; Steam'in en popüler 300 ürünü + en likit ürünlerde dönüşümlü sipariş defteri. itemsatis ve ByNoGame ilanları ürün adına eşleştirilir (yalnızca güvenli eşleşmeler). Rotalar: CSFloat %2 komisyon + %0,5–2,5 çekim + kur; itemsatis %7 + 20 TL; ByNoGame anında alım Steam'in %65'i; Steam %13 ve nakit değil; Skinport Türkiye'ye ödeme yapmaz." : "CSFloat price list and Skinport item list hourly; Steam's 300 most popular items plus a rotating order-book refresh of the most liquid ones. itemsatis and ByNoGame listings are matched to item names (confident matches only). Routes: CSFloat 2% + 0.5–2.5% withdrawal + FX; itemsatis 7% + 20 TL; ByNoGame instant buy 65% of Steam; Steam 13% and not cash; Skinport does not pay out to Türkiye."}</P>
        <h3 className="mt-5 font-bold">{tr ? "Kur ve vergi" : "FX and tax"}</h3>
        <P>{tr ? "open.er-api.com günlük USD/TRY ve USD/EUR; TCMB varsa ayrıca. GİB özelgesi (3 Mart 2026): oyun içi varlık satışı sosyal içerik istisnasının dışında; sürekli al-sat ticari kazanç sayılabilir." : "open.er-api.com daily USD/TRY and USD/EUR; TCMB when available. Turkish Revenue Administration ruling (3 Mar 2026): in-game asset sales fall outside the social-content exemption; habitual trading may count as commercial income."}</P>
        <p className="mt-5 text-xs text-slate-500">{meta ? `${tr ? "Son toplama" : "Last run"}: ${meta.lastRun ? new Date(meta.lastRun).toLocaleString(tr ? "tr-TR" : "en-GB") : "—"} · Steam ${meta.cs2Counts?.steam ?? "—"} · CSFloat ${meta.cs2Counts?.csfloat ?? "—"} · Skinport ${meta.cs2Counts?.skinport ?? "—"}` : ""}</p>
      </div>
    </Section>
  );
}
