// Uyarı motoru: Supabase (service_role) kurallarını okur, son verilerle karşılaştırır, Telegram'a yazar.
// Ayrıca Telegram getUpdates ile "/start KOD" mesajlarını profil ile eşler. GitHub Actions'ta toplama sonrası çalışır.
import { readJson, log } from "./lib.js";

const SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_SERVICE_KEY, TG = process.env.TELEGRAM_BOT_TOKEN;
const sb = async (path, { method = "GET", body, prefer } = {}) => {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { method, headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`supabase ${method} ${path} ${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
};
const tg = async (method, body) => { const r = await fetch(`https://api.telegram.org/bot${TG}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return r.json(); };
const fmtTL = (v) => `${Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL`;
const fmtUSD = (v) => `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** Kural için güncel değer. KO: TL (en iyi alış / en düşük satış). CS2: USD (bynogame: TL→USD). */
function currentValue(rule, ko, cs2, tr, fx) {
  if (rule.kind === "ko") {
    let best = null;
    for (const per of Object.values(ko?.bySource || {})) { const v = per[rule.target]; if (!v) continue; const x = rule.field === "sell" ? v.sell : v.buy; if (x == null) continue; if (best == null || (rule.field === "sell" ? x < best : x > best)) best = x; }
    return best;
  }
  const it = cs2?.items?.[rule.target]; if (!it) return null;
  if (rule.field === "csfloat") return it[0]; if (rule.field === "skinport") return it[2]; if (rule.field === "steam") return it[5];
  if (rule.field === "bynogame") { const t = tr?.items?.[rule.target]; return t?.bynogameSellUsTL != null && fx?.usdtry ? t.bynogameSellUsTL / fx.usdtry : null; }
  return null;
}

export async function runAlerts() {
  if (!SB_URL || !SB_KEY) { log("alerts: SUPABASE_URL/SERVICE_KEY yok, atlandı"); return; }
  const ko = readJson("ko_latest.json", null), cs2 = readJson("cs2.json", null), tr = readJson("cs2_tr.json", null), fx = readJson("fx.json", null);
  // 1) Telegram bağlama: /start KOD
  if (TG) {
    try {
      const state = readJson("_tg_state.json", { offset: 0 });
      const u = await tg("getUpdates", { offset: state.offset, timeout: 0, allowed_updates: ["message"] });
      for (const up of u.result || []) {
        state.offset = up.update_id + 1;
        const m = up.message; const text = m?.text || ""; const code = text.match(/^\/start\s+([A-Za-z0-9-]{6,})/)?.[1];
        if (code && m.chat?.id) {
          const rows = await sb(`profiles?telegram_link_code=eq.${encodeURIComponent(code)}&select=id`);
          if (rows?.length) { await sb(`profiles?id=eq.${rows[0].id}`, { method: "PATCH", body: { telegram_chat_id: m.chat.id, telegram_link_code: null } }); await tg("sendMessage", { chat_id: m.chat.id, text: "✅ Pazar Radar bağlandı. Uyarıların buraya gelecek." }); log("tg linked", rows[0].id); }
          else await tg("sendMessage", { chat_id: m.chat.id, text: "Kod bulunamadı. Sitedeki Uyarılar sayfasından yeni kod al." });
        } else if (text.startsWith("/start") && m.chat?.id) await tg("sendMessage", { chat_id: m.chat.id, text: "Merhaba! Bağlamak için sitedeki Uyarılar sayfasındaki kodu /start KOD şeklinde gönder." });
      }
      const { writeJson } = await import("./lib.js"); writeJson("_tg_state.json", state);
    } catch (e) { log("tg updates hata", e.message); }
  }
  // 2) Kuralları değerlendir
  const rulesRaw = await sb("alert_rules?active=eq.true&select=*");
  const profs = Object.fromEntries((await sb("profiles?select=id,telegram_chat_id,email,lang")).map((p) => [p.id, p]));
  const rules = rulesRaw.map((r) => ({ ...r, profiles: profs[r.user_id] || null }));
  const subs = Object.fromEntries((await sb("subscriptions?select=user_id,plan,valid_until")).map((s) => [s.user_id, s]));
  let fired = 0;
  for (const r of rules) {
    const val = currentValue(r, ko, cs2, tr, fx); if (val == null) continue;
    const hit = r.op === ">=" ? val >= Number(r.threshold) : val <= Number(r.threshold);
    const cooled = !r.last_fired_at || Date.now() - Date.parse(r.last_fired_at) > (r.cooldown_min || 360) * 60e3;
    const patch = { last_value: val };
    if (hit && cooled) {
      const lang = r.profiles?.lang || "tr"; const isKo = r.kind === "ko";
      const vTxt = isKo ? fmtTL(val) : fmtUSD(val), thr = isKo ? fmtTL(r.threshold) : fmtUSD(r.threshold);
      const msg = lang === "tr" ? `🔔 ${isKo ? "Knight Online" : "CS2"} · ${r.target}\n${r.field} ${r.op} ${thr} → şu an ${vTxt}\nhttps://pazar-radar-two.vercel.app/#/${isKo ? "ko?server=" + encodeURIComponent(r.target) : "cs2?item=" + encodeURIComponent(r.target)}`
        : `🔔 ${isKo ? "Knight Online" : "CS2"} · ${r.target}\n${r.field} ${r.op} ${thr} → now ${vTxt}\nhttps://pazar-radar-two.vercel.app/#/${isKo ? "ko?server=" + encodeURIComponent(r.target) : "cs2?item=" + encodeURIComponent(r.target)}`;
      let delivered = false;
      if (r.channel === "telegram" && TG && r.profiles?.telegram_chat_id) { const res = await tg("sendMessage", { chat_id: r.profiles.telegram_chat_id, text: msg }); delivered = !!res.ok; }
      await sb("alert_events", { method: "POST", body: { rule_id: r.id, user_id: r.user_id, value: val, message: msg, delivered }, prefer: "return=minimal" });
      patch.last_fired_at = new Date().toISOString(); fired++;
    }
    await sb(`alert_rules?id=eq.${r.id}`, { method: "PATCH", body: patch, prefer: "return=minimal" });
  }
  log("alerts", rules.length, "kural,", fired, "tetiklendi");
}
