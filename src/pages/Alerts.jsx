import { useEffect, useState } from "react";
import { useStore } from "../lib/store.jsx";
import { useT } from "../i18n.js";
import { supabase, TG_BOT, VAPID_PUBLIC } from "../lib/supabase.js";
import { makeMoney } from "../lib/data.js";
import { Section, Input, Select, Empty } from "../components/ui.jsx";

const T = {
  tr: { signin: "Giriş yap", email: "E-posta", sendLink: "Giriş bağlantısı gönder", sent: "Bağlantı gönderildi; e-postandaki linke tıkla (spam klasörüne bak).", signout: "Çıkış", plan: "Plan", free: "Ücretsiz", pro: "Pro", rules: "Kurallarım", newRule: "Yeni kural", kind: "Tür", target: "Hedef", field: "Alan", op: "Koşul", threshold: "Eşik", save: "Kaydet", del: "Sil", active: "Aktif", paused: "Duraklat", last: "Son değer", fired: "Son tetik", none: "Henüz kural yok.", push: "Bildirimler", pushOn: "Bu cihazda bildirimler açık ✓", pushBtn: "Bu cihazda bildirimleri aç", pushHow: "Fiyat eşiği aşıldığında bildirim bu tarayıcıya düşer (telefonda Chrome/Android doğrudan; iPhone'da Safari → Paylaş → Ana Ekrana Ekle sonrası). Kontrol saatte bir yapılır.", pushDenied: "Tarayıcı bildirim iznini reddetti; site ayarlarından açabilirsin.", pushUnsup: "Bu tarayıcı bildirimi desteklemiyor.", events: "Son uyarılar", noEvents: "Henüz tetiklenen uyarı yok.", tg: "Telegram (isteğe bağlı)", tgLinked: "Telegram bağlı ✓", tgHow: "Botu aç ve şu mesajı gönder:", tgCode: "Kod üret", tgWait: "Kodu gönderdikten sonra en geç 1 saat içinde bağlanır.", limit: "Ücretsiz planda 2 aktif kural. Sınırsız için Pro.", ko: "Knight Online", cs2: "CS2", buy: "Alış (siteye satış)", sell: "Satış (siteden alış)", csfloat: "CSFloat en düşük", skinport: "Skinport en düşük", steam: "Steam en düşük", bynogame: "ByNoGame anlık alım", gte: "≥ (üstüne çıkınca)", lte: "≤ (altına inince)", unitKo: "TL / GB", unitCs: "USD", noSb: "Üyelik altyapısı henüz bağlanmadı.", err: "Hata" },
  en: { signin: "Sign in", email: "E-mail", sendLink: "Send sign-in link", sent: "Link sent; click it in your inbox (check spam).", signout: "Sign out", plan: "Plan", free: "Free", pro: "Pro", rules: "My rules", newRule: "New rule", kind: "Type", target: "Target", field: "Field", op: "Condition", threshold: "Threshold", save: "Save", del: "Delete", active: "Active", paused: "Pause", last: "Last value", fired: "Last fired", none: "No rules yet.", push: "Notifications", pushOn: "Notifications enabled on this device ✓", pushBtn: "Enable notifications on this device", pushHow: "When a threshold is crossed the notification lands in this browser (Android Chrome directly; iPhone after Safari → Share → Add to Home Screen). Checked hourly.", pushDenied: "Notification permission was denied; enable it in site settings.", pushUnsup: "This browser does not support notifications.", events: "Recent alerts", noEvents: "No alerts fired yet.", tg: "Telegram (optional)", tgLinked: "Telegram linked ✓", tgHow: "Open the bot and send this message:", tgCode: "Generate code", tgWait: "After sending the code it links within an hour.", limit: "Free plan allows 2 active rules. Pro is unlimited.", ko: "Knight Online", cs2: "CS2", buy: "Buyback (sell to site)", sell: "Retail (buy from site)", csfloat: "CSFloat lowest", skinport: "Skinport lowest", steam: "Steam lowest", bynogame: "ByNoGame instant buy", gte: "≥ (rises above)", lte: "≤ (falls below)", unitKo: "TL / GB", unitCs: "USD", noSb: "Accounts are not connected yet.", err: "Error" },
};

export default function Alerts({ ko, cs2names }) {
  const { lang, currency, fx } = useStore(); const t = useT(lang); const s = T[lang] || T.tr; const M = makeMoney(currency, fx, lang);
  const [user, setUser] = useState(null); const [email, setEmail] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState(null); const [sub, setSub] = useState(null); const [rules, setRules] = useState([]);
  const [form, setForm] = useState({ kind: "ko", target: "Zero", field: "buy", op: ">=", threshold: "" });
  const [pushState, setPushState] = useState("idle"); const [events, setEvents] = useState([]);
  useEffect(() => { if (!supabase) return; supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null)); const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setUser(sess?.user || null)); return () => sub.subscription.unsubscribe(); }, []);
  const load = async () => { if (!user) return; const [{ data: p }, { data: sb }, { data: r }, { data: ev }] = await Promise.all([supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(), supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle(), supabase.from("alert_rules").select("*").order("created_at", { ascending: false }), supabase.from("alert_events").select("*").order("fired_at", { ascending: false }).limit(20)]); setProfile(p); setSub(sb); setRules(r || []); setEvents(ev || []); checkPush(); };
  const b64 = (str) => { const pad = "=".repeat((4 - (str.length % 4)) % 4); const raw = atob((str + pad).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };
  const checkPush = async () => { if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setPushState("unsupported"); if (Notification.permission === "denied") return setPushState("denied"); try { const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription(); setPushState(sub ? "on" : "off"); } catch { setPushState("off"); } };
  const enablePush = async () => { try { const reg = await navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js"); const perm = await Notification.requestPermission(); if (perm !== "granted") return setPushState("denied"); const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC) }); const j = sub.toJSON(); const { error } = await supabase.from("push_subscriptions").upsert({ user_id: user.id, endpoint: j.endpoint, keys: j.keys, ua: navigator.userAgent.slice(0, 120) }); if (error) setMsg(error.message); else setPushState("on"); } catch (e) { setMsg(`${s.err}: ${e.message}`); } };
  useEffect(() => { load(); }, [user]);
  if (!supabase) return <Section title={t.alerts.title} sub={t.alerts.sub}><Empty>{s.noSb}</Empty></Section>;
  const signIn = async (e) => { e.preventDefault(); setBusy(true); setMsg(""); const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname + "#/alerts" } }); setBusy(false); setMsg(error ? `${s.err}: ${error.message}` : s.sent); };
  const addRule = async (e) => { e.preventDefault(); setMsg(""); const { error } = await supabase.from("alert_rules").insert({ user_id: user.id, kind: form.kind, target: form.target, field: form.field, op: form.op, threshold: Number(form.threshold), channel: "push" }); if (error) setMsg(error.message.includes("FREE_LIMIT") ? s.limit : `${s.err}: ${error.message}`); else { setForm({ ...form, threshold: "" }); load(); } };
  const toggle = async (r) => { const { error } = await supabase.from("alert_rules").update({ active: !r.active }).eq("id", r.id); if (error) setMsg(error.message.includes("FREE_LIMIT") ? s.limit : error.message); load(); };
  const del = async (r) => { await supabase.from("alert_rules").delete().eq("id", r.id); load(); };
  const genCode = async () => { const code = Math.random().toString(36).slice(2, 10).toUpperCase(); await supabase.from("profiles").update({ telegram_link_code: code }).eq("id", user.id); load(); };
  const plan = sub && sub.plan === "pro" && (!sub.valid_until || Date.parse(sub.valid_until) > Date.now()) ? "pro" : "free";
  const fields = form.kind === "ko" ? ["buy", "sell"] : ["csfloat", "skinport", "steam", "bynogame"];
  return (
    <Section title={t.alerts.title} sub={t.alerts.sub}>
      {!user ? (
        <form onSubmit={signIn} className="card mx-auto max-w-md p-6"><h3 className="font-bold">{s.signin}</h3><Input label={s.email} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-3" /><button className="btn-primary mt-4 w-full" disabled={busy}>{s.sendLink}</button>{msg && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{msg}</p>}</form>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-1">
            <div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">{user.email}</div><div className="mt-1"><span className={plan === "pro" ? "chip-brand" : "chip-flat"}>{s.plan}: {plan === "pro" ? s.pro : s.free}</span></div></div><button className="btn-ghost !py-1.5" onClick={() => supabase.auth.signOut()}>{s.signout}</button></div>
            <h3 className="mt-5 text-sm font-bold">{s.push}</h3>
            <div className="mt-2 text-sm">
              {pushState === "on" ? <p className="chip-up">{s.pushOn}</p> : pushState === "denied" ? <p className="text-rose-600">{s.pushDenied}</p> : pushState === "unsupported" ? <p className="text-slate-500">{s.pushUnsup}</p> : <button className="btn-primary" onClick={enablePush}>{s.pushBtn}</button>}
              <p className="mt-2 text-xs text-slate-500">{s.pushHow}</p>
            </div>
            {TG_BOT && (<>
            <h3 className="mt-5 text-sm font-bold">{s.tg}</h3>
            {profile?.telegram_chat_id ? <p className="mt-2 chip-up">{s.tgLinked}</p> : (
              <div className="mt-2 text-sm">
                {profile?.telegram_link_code ? <><p className="text-slate-600 dark:text-slate-300">{s.tgHow}</p><code className="mt-2 block rounded-lg bg-slate-100 p-2 text-sm dark:bg-slate-800">/start {profile.telegram_link_code}</code><a className="btn-primary mt-2" target="_blank" rel="noreferrer" href={`https://t.me/${TG_BOT}?start=${profile.telegram_link_code}`}>t.me/{TG_BOT}</a><p className="mt-2 text-xs text-slate-500">{s.tgWait}</p></> : <button className="btn-ghost" onClick={genCode}>{s.tgCode}</button>}
              </div>)}
            </>)}
            {plan === "free" && <p className="mt-4 text-xs text-slate-500">{s.limit} <a href="#/pricing" className="underline">Pro →</a></p>}
          </div>
          <div className="lg:col-span-2">
            <form onSubmit={addRule} className="card grid grid-cols-2 gap-3 p-5 md:grid-cols-6">
              <Select label={s.kind} value={form.kind} onChange={(v) => setForm({ ...form, kind: v, target: v === "ko" ? "Zero" : "", field: v === "ko" ? "buy" : "csfloat" })} options={[{ value: "ko", label: s.ko }, { value: "cs2", label: s.cs2 }]} />
              {form.kind === "ko" ? <Select label={s.target} value={form.target} onChange={(v) => setForm({ ...form, target: v })} options={ko?.servers || ["Zero"]} /> : <label className="block col-span-2"><span className="label">{s.target}</span><input className="input" list="cs2names" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="AK-47 | Redline (Field-Tested)" required /><datalist id="cs2names">{(cs2names || []).filter((n) => form.target.length >= 3 && n.toLowerCase().includes(form.target.toLowerCase())).slice(0, 20).map((n) => <option key={n} value={n} />)}</datalist></label>}
              <Select label={s.field} value={form.field} onChange={(v) => setForm({ ...form, field: v })} options={fields.map((f) => ({ value: f, label: s[f] }))} />
              <Select label={s.op} value={form.op} onChange={(v) => setForm({ ...form, op: v })} options={[{ value: ">=", label: s.gte }, { value: "<=", label: s.lte }]} />
              <Input label={`${s.threshold} (${form.kind === "ko" ? s.unitKo : s.unitCs})`} type="number" step="0.01" required value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
              <div className="flex items-end"><button className="btn-primary w-full">{s.save}</button></div>
            </form>
            {msg && <p className="mt-2 text-sm text-rose-600">{msg}</p>}
            <div className="card mt-4 overflow-x-auto">
              {rules.length ? <table className="w-full"><thead><tr><th className="th">{s.kind}</th><th className="th">{s.target}</th><th className="th">{s.field}</th><th className="th text-right">{s.threshold}</th><th className="th text-right">{s.last}</th><th className="th">{s.fired}</th><th className="th"></th></tr></thead>
                <tbody>{rules.map((r) => <tr key={r.id} className={r.active ? "" : "opacity-50"}><td className="td">{r.kind === "ko" ? s.ko : s.cs2}</td><td className="td">{r.target}</td><td className="td">{s[r.field] || r.field}</td><td className="td text-right num">{r.op} {r.kind === "ko" ? M.fromTL(r.threshold) : M.fmt(r.threshold)}</td><td className="td text-right num">{r.last_value != null ? (r.kind === "ko" ? M.fromTL(r.last_value) : M.fmt(r.last_value)) : "—"}</td><td className="td text-xs text-slate-500">{r.last_fired_at ? new Date(r.last_fired_at).toLocaleString(lang === "tr" ? "tr-TR" : "en-GB") : "—"}</td><td className="td text-right"><button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => toggle(r)}>{r.active ? s.paused : s.active}</button> <button className="btn-ghost !px-2 !py-1 text-xs text-rose-600" onClick={() => del(r)}>{s.del}</button></td></tr>)}</tbody></table> : <div className="p-6 text-sm text-slate-500">{s.none}</div>}
            </div>
            <h3 className="mt-6 text-sm font-bold">{s.events}</h3>
            <div className="card mt-2 divide-y divide-slate-100 dark:divide-slate-800">{events.length ? events.map((e) => <div key={e.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm"><span className="whitespace-pre-line">{e.message?.split("\n").slice(0, 2).join(" — ")}</span><span className="shrink-0 text-xs text-slate-500">{new Date(e.fired_at).toLocaleString(lang === "tr" ? "tr-TR" : "en-GB")}</span></div>) : <div className="p-4 text-sm text-slate-500">{s.noEvents}</div>}</div>
          </div>
        </div>
      )}
    </Section>
  );
}
