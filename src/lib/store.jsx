import { createContext, useContext, useEffect, useMemo, useState } from "react";
const Ctx = createContext(null);
const get = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
export function StoreProvider({ children }) {
  const [lang, setLang] = useState(() => get("pr-lang", (navigator.language || "tr").startsWith("tr") ? "tr" : "en"));
  const [currency, setCurrency] = useState(() => get("pr-cur", "TRY"));
  const [theme, setTheme] = useState(() => get("pr-theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  const [fx, setFx] = useState({ usdtry: 48.9, usdeur: 0.92 });
  useEffect(() => { set("pr-lang", lang); document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { set("pr-cur", currency); }, [currency]);
  useEffect(() => { set("pr-theme", theme); document.documentElement.classList.toggle("dark", theme === "dark"); }, [theme]);
  const v = useMemo(() => ({ lang, setLang, currency, setCurrency, theme, setTheme, fx, setFx }), [lang, currency, theme, fx]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
export const useStore = () => useContext(Ctx);
