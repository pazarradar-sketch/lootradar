import { useStore } from "../lib/store.jsx";
import { useT } from "../i18n.js";

const Logo = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2563eb" /><stop offset="1" stopColor="#7c3aed" /></linearGradient></defs><circle cx="16" cy="16" r="14" fill="url(#lg)" /><circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="2" /><circle cx="16" cy="16" r="3.5" fill="#fff" /></svg>
);

export default function Layout({ route, children, meta }) {
  const { lang, setLang, currency, setCurrency, theme, setTheme } = useStore();
  const t = useT(lang);
  const items = [["home", "#/"], ["ko", "#/ko"], ["cs2", "#/cs2"], ["scan", "#/scan"], ["alerts", "#/alerts"], ["pricing", "#/pricing"], ["about", "#/about"]];
  const sel = "rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <a href="#/" className="flex items-center gap-2 font-extrabold tracking-tight"><Logo /><span>Loot<span className="brand-text">Radar</span></span></a>
          <nav className="ml-2 hidden items-center gap-0.5 md:flex">
            {items.map(([k, h]) => <a key={k} href={h} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${route === k ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"}`}>{t.nav[k]}</a>)}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            {meta && <span className="hidden text-xs text-slate-500 lg:inline dark:text-slate-400">{meta}</span>}
            <select aria-label={t.common.currency} className={sel} value={currency} onChange={(e) => setCurrency(e.target.value)}><option>TRY</option><option>USD</option><option>EUR</option></select>
            <select aria-label={t.common.lang} className={sel} value={lang} onChange={(e) => setLang(e.target.value)}><option value="tr">TR</option><option value="en">EN</option></select>
            <button aria-label={t.common.theme} className={sel} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "☀︎" : "☾"}</button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
          {items.map(([k, h]) => <a key={k} href={h} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold ${route === k ? "bg-slate-100 dark:bg-slate-800" : "text-slate-600 dark:text-slate-300"}`}>{t.nav[k]}</a>)}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 sm:px-6">{children}</main>
      <footer className="border-t border-slate-200 py-6 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6"><p className="max-w-4xl">{t.common.disclaimer}</p><p className="mt-2">© {new Date().getFullYear()} LootRadar · <a className="underline" href="https://github.com/pazarradar-sketch/lootradar">GitHub</a></p></div>
      </footer>
    </div>
  );
}
