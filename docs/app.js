(() => {
  const $ = (s) => document.querySelector(s);
  const fmtTL = (n, d = 0) => n == null ? "—" : n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " TL";
  const fmtUSD = (n, d = 2) => n == null ? "—" : "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtN = (n) => n == null ? "—" : n.toLocaleString("tr-TR");
  const ago = (iso) => { if (!iso) return "—"; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${m} dk önce` : m < 2880 ? `${Math.round(m / 60)} sa önce` : `${Math.round(m / 1440)} gün önce`; };
  const load = (f) => fetch(`data/${f}?t=${Math.floor(Date.now() / 300000)}`).then((r) => r.ok ? r.json() : null).catch(() => null);
  const state = { fx: 48.9 };

  // Sekmeler
  document.querySelectorAll("nav button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach((x) => x.classList.toggle("on", x === b));
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.id === "tab-" + b.dataset.tab));
    try { localStorage.setItem("pr-tab", b.dataset.tab); } catch {}
    if (b.dataset.tab === "cs2" && !state.cs2) initCs2();
  }));
  try { const t = localStorage.getItem("pr-tab"); if (t) document.querySelector(`nav button[data-tab="${t}"]`)?.click(); } catch {}

  // ---------- KO ----------
  async function initKo() {
    const [fx, latest, hist, meta] = await Promise.all([load("fx.json"), load("ko_latest.json"), load("ko_history.json"), load("meta.json")]);
    if (fx?.usdtry) state.fx = fx.usdtry;
    $("#hdr-meta").textContent = `USD/TRY ${state.fx.toFixed(2)} · güncelleme ${ago(latest?.ts)}`;
    $("#ft-meta").textContent = `son çalışma ${meta?.lastRun ? new Date(meta.lastRun).toLocaleString("tr-TR") : "—"}`;
    $("#about-meta").textContent = `Son toplama: KO ${ago(meta?.ko)}, CS2 ${ago(meta?.cs2)} (Steam ${meta?.cs2Counts?.steam ?? "—"} ürün, CSFloat ${fmtN(meta?.cs2Counts?.csfloat)}, Skinport ${fmtN(meta?.cs2Counts?.skinport)}).`;
    if (!latest) { $("#ko-table").innerHTML = `<tr><td class="empty">Veri yok</td></tr>`; return; }
    state.ko = latest; state.hist = hist;
    const sources = Object.keys(latest.bySource);
    const servers = latest.servers;
    // En iyi alış / sunucu
    const best = {};
    for (const s of servers) { let b = null; for (const src of sources) { const v = latest.bySource[src]?.[s]; if (v?.buy != null && (!b || v.buy > b.buy)) b = { src, buy: v.buy }; } best[s] = b; }
    // Kartlar
    const top = servers.filter((s) => best[s]).sort((a, b) => best[b].buy - best[a].buy);
    $("#ko-stats").innerHTML = [
      `<div class="card stat"><div class="k">USD / TRY</div><div class="v">${state.fx.toFixed(2)}</div><div class="s">${fx?.source || ""}${fx?.tcmb ? ` · TCMB ${fx.tcmb.buying}` : ""}</div></div>`,
      `<div class="card stat"><div class="k">En pahalı GB</div><div class="v">${top[0]}</div><div class="s">${fmtTL(best[top[0]].buy)} · ${fmtUSD(best[top[0]].buy / state.fx)} · ${latest.labels[best[top[0]].src].label}</div></div>`,
      `<div class="card stat"><div class="k">En ucuz GB</div><div class="v">${top[top.length - 1]}</div><div class="s">${fmtTL(best[top[top.length - 1]].buy)} · ${fmtUSD(best[top[top.length - 1]].buy / state.fx)}</div></div>`,
      `<div class="card stat"><div class="k">Kaynak</div><div class="v">${sources.filter((s) => latest.status[s]?.ok).length}/${sources.length}</div><div class="s">pazar yeri canlı · ${ago(latest.ts)}</div></div>`,
    ].join("");
    // Tablo
    let h = `<tr><th>Sunucu</th>${sources.map((s) => `<th>${latest.labels[s]?.label || s}<span class="sub">alış / satış</span></th>`).join("")}<th>En iyi alış</th><th>USD</th><th>Makas</th></tr>`;
    for (const s of servers) {
      h += `<tr><td><b>${s}</b></td>`;
      let minSell = null;
      for (const src of sources) {
        const v = latest.bySource[src]?.[s];
        if (v?.sell != null && (minSell == null || v.sell < minSell)) minSell = v.sell;
        const isBest = best[s]?.src === src;
        h += `<td class="${isBest ? "best" : ""}">${v ? `${v.buy != null ? fmtTL(v.buy) : "<span class=dim>—</span>"} <span class="dim">/ ${v.sell != null ? fmtTL(v.sell) : "—"}</span>${v.buyVia ? `<span class="sub">alış: toplayıcı</span>` : ""}` : "<span class=dim>—</span>"}</td>`;
      }
      const b = best[s];
      const spread = b && minSell ? ((minSell - b.buy) / minSell * 100) : null;
      h += `<td><b>${b ? fmtTL(b.buy) : "—"}</b><span class="sub">${b ? latest.labels[b.src].label : ""}</span></td><td>${b ? fmtUSD(b.buy / state.fx) : "—"}</td><td>${spread != null ? spread.toFixed(1) + "%" : "—"}</td></tr>`;
    }
    $("#ko-table").innerHTML = h;
    $("#ko-status").innerHTML = sources.map((s) => { const st = latest.status[s] || {}; const cls = st.ok ? "good" : st.stale ? "warn" : "bad"; return `<span class="chip ${cls}">${latest.labels[s]?.label || s}: ${st.ok ? "canlı" : st.stale ? "bayat (" + ago(st.ts) + ")" : "hata"}</span>`; }).join("") + ` <span class="note">Makas = (en düşük satış − en iyi alış) / en düşük satış.</span>`;
    // Seçiciler
    for (const id of ["#h-server", "#c-server"]) $(id).innerHTML = servers.map((s) => `<option${s === (servers.includes("Zero") ? "Zero" : top[0]) ? " selected" : ""}>${s}</option>`).join("");
    ["#h-server", "#h-side", "#h-range"].forEach((id) => $(id).addEventListener("change", drawHist));
    ["#c-server", "#c-gb", "#c-fee"].forEach((id) => $(id).addEventListener("input", calcKo));
    drawHist(); calcKo();
  }

  let chart;
  function drawHist() {
    const s = $("#h-server").value, side = $("#h-side").value === "buy" ? 2 : 3, days = Number($("#h-range").value);
    const snaps = (state.hist?.snapshots || []).filter((x) => Date.parse(x[0]) > Date.now() - days * 86400e3);
    const series = {};
    for (const [ts, rows] of snaps) for (const [src, srv, buy, sell] of rows) { if (srv !== s) continue; const v = [null, null, buy, sell][side]; if (v == null) continue; (series[src] ||= []).push({ x: ts, y: v }); }
    const colors = ["#2f5bea", "#0f8a4b", "#b7791f", "#c0392b", "#7b3fe4", "#0a9aa8"];
    const labels = state.ko?.labels || {};
    const datasets = Object.entries(series).map(([src, pts], i) => ({ label: labels[src]?.label || src, data: pts, borderColor: colors[i % colors.length], backgroundColor: colors[i % colors.length], tension: .2, pointRadius: snaps.length > 60 ? 0 : 3, borderWidth: 2 }));
    $("#h-note").textContent = snaps.length ? `${snaps.length} anlık görüntü · ilk kayıt ${new Date(snaps[0][0]).toLocaleString("tr-TR")}` : "Henüz geçmiş yok; her saat bir nokta eklenir.";
    if (!window.Chart) return;
    const cfg = { type: "line", data: { datasets }, options: { responsive: true, animation: false, parsing: true, scales: { x: { type: "category", ticks: { maxTicksLimit: 8, callback: (v, i) => { const d = datasets[0]?.data[i]?.x; return d ? new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }) + " " + new Date(d).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : ""; } } }, y: { ticks: { callback: (v) => fmtTL(v) } } }, plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { title: (it) => new Date(it[0].raw.x).toLocaleString("tr-TR"), label: (it) => `${it.dataset.label}: ${fmtTL(it.raw.y, 2)}` } } } } };
    if (chart) { chart.destroy(); }
    chart = new Chart($("#h-chart"), cfg);
  }

  function calcKo() {
    const s = $("#c-server").value, gb = Number($("#c-gb").value) || 0, fee = Number($("#c-fee").value) || 0;
    const rows = Object.entries(state.ko.bySource).map(([src, per]) => ({ src, v: per[s] })).filter((r) => r.v?.buy != null).sort((a, b) => b.v.buy - a.v.buy);
    $("#c-out").innerHTML = rows.length ? `<table style="min-width:0">${rows.map((r, i) => { const net = r.v.buy * gb - fee; return `<tr><td>${i === 0 ? "🥇 " : ""}${state.ko.labels[r.src].label}${state.ko.labels[r.src].kind === "aggregator" ? " <span class=dim>(toplayıcı)</span>" : ""}</td><td>${fmtTL(r.v.buy)}/GB</td><td><b>${fmtTL(net)}</b><span class="sub">${fmtUSD(net / state.fx)}</span></td></tr>`; }).join("")}</table>` : "<span class=dim>Bu sunucu için alış fiyatı yok.</span>";
  }

  // ---------- CS2 ----------
  async function initCs2() {
    state.cs2 = { loading: true };
    $("#s-empty").textContent = "Fiyat listesi yükleniyor…";
    const d = await load("cs2.json");
    if (!d) { $("#s-empty").textContent = "CS2 verisi henüz yok."; return; }
    state.cs2 = d; state.names = Object.keys(d.items);
    $("#s-empty").innerHTML = `${fmtN(state.names.length)} ürün yüklendi (${ago(d.ts)}). Bir ürün adı yazmaya başla.`;
    const q = $("#s-q"), sg = $("#s-sugg"); let cur = -1, list = [];
    const score = (n, t) => { const l = n.toLowerCase(); return l.startsWith(t) ? 0 : l.includes(t) ? 1 : t.split(" ").every((w) => l.includes(w)) ? 2 : -1; };
    const render = () => { sg.innerHTML = list.map((n, i) => { const v = d.items[n]; return `<div class="${i === cur ? "on" : ""}" data-n="${n.replace(/"/g, "&quot;")}">${n}<small>${v[0] != null ? fmtUSD(v[0]) : v[2] != null ? fmtUSD(v[2]) : ""}</small></div>`; }).join(""); sg.style.display = list.length ? "block" : "none"; };
    q.addEventListener("input", () => { const t = q.value.trim().toLowerCase(); cur = -1; if (t.length < 2) { list = []; return render(); } const sc = []; for (const n of state.names) { const s = score(n, t); if (s >= 0) { sc.push([s, n]); if (sc.length > 400) break; } } sc.sort((a, b) => a[0] - b[0] || (d.items[b[1]][4] || 0) - (d.items[a[1]][4] || 0)); list = sc.slice(0, 30).map((x) => x[1]); render(); });
    q.addEventListener("keydown", (e) => { if (e.key === "ArrowDown") { cur = Math.min(cur + 1, list.length - 1); render(); e.preventDefault(); } else if (e.key === "ArrowUp") { cur = Math.max(cur - 1, 0); render(); e.preventDefault(); } else if (e.key === "Enter" && list[cur >= 0 ? cur : 0]) { pick(list[cur >= 0 ? cur : 0]); } else if (e.key === "Escape") { list = []; render(); } });
    sg.addEventListener("mousedown", (e) => { const n = e.target.closest("[data-n]")?.dataset.n; if (n) pick(n); });
    document.addEventListener("click", (e) => { if (!e.target.closest(".search")) { list = []; render(); } });
    ["#s-qty", "#s-price", "#s-tl", "#f-cfw", "#f-fx"].forEach((id) => $(id).addEventListener("input", routes));
    const u = new URLSearchParams(location.search).get("item"); if (u && d.items[u]) pick(u);
  }
  function pick(n) {
    const v = state.cs2.items[n]; state.item = { n, v };
    $("#s-q").value = n; $("#s-sugg").style.display = "none"; $("#s-empty").style.display = "none"; $("#s-item").style.display = "block";
    $("#s-name").textContent = n;
    const [cf, cfq, sk, skm, skq, st, stl] = v;
    const card = (k, val, s) => `<div class="card stat"><div class="k">${k}</div><div class="v">${val}</div><div class="s">${s}</div></div>`;
    $("#s-prices").innerHTML = [
      card("CSFloat en düşük", fmtUSD(cf), cf != null ? `${fmtTL(cf * state.fx)} · ${fmtN(cfq)} ilan` : "listede yok"),
      card("Skinport en düşük / medyan", `${fmtUSD(sk)} <span class="dim">/ ${fmtUSD(skm)}</span>`, sk != null ? `${fmtN(skq)} ilan · TR'ye ödeme yok` : "listede yok"),
      card("Steam en düşük ilan", fmtUSD(st), st != null ? `${fmtN(stl)} ilan · yalnızca cüzdan` : "ilk 300 popülerde değil"),
      card("Nakit / Steam oranı", st && (cf || sk) ? ((cf ?? sk) / st).toFixed(2) : "—", "nakit pazar en düşük ÷ Steam en düşük"),
    ].join("");
    const base = cf ?? sk ?? st;
    $("#s-price").value = base != null ? base.toFixed(2) : "";
    const refSteam = st ?? (base != null ? base / 0.75 : null);
    $("#s-tl").value = refSteam != null ? Math.round(refSteam * state.fx * 0.88) : "";
    routes();
    try { history.replaceState(null, "", "?item=" + encodeURIComponent(n)); } catch {}
  }
  function routes() {
    const { v } = state.item; const [cf, , sk, , , st] = v;
    const qty = Math.max(1, Number($("#s-qty").value) || 1), p = (Number($("#s-price").value) || 0) * qty, tl = (Number($("#s-tl").value) || 0) * qty, cfw = Number($("#f-cfw").value) / 100, fxl = Number($("#f-fx").value) / 100, fx = state.fx;
    const rows = [];
    const cfNet = p * 0.98 * (1 - cfw) * fx * (1 - fxl);
    rows.push(["CSFloat ilan → Stripe → TL IBAN", `${fmtUSD(p)} satış${qty > 1 ? ` (${qty} adet)` : ""}`, "%2 komisyon + %" + (cfw * 100).toFixed(1) + " çekim + %" + (fxl * 100).toFixed(1) + " kur", cfNet, "1–4 iş günü; 7 gün Trade Protection sonrası listelenebilir", "good"]);
    rows.push(["itemsatis ilan → IBAN", `${fmtTL(tl)} ilan`, "%7 komisyon + 20 TL çekim", tl * 0.93 - 20, "alıcı bulmak gerek; 7 gün Steam kilidi; T.C. kimlik", "good"]);
    if (st != null) rows.push(["ByNoGame Bize Sat (anında)", `${fmtUSD(st * qty)} Steam ref.`, "Steam değerinin %65'i, komisyon yok", st * qty * 0.65 * fx, "8 gün Steam koruması sonrası cüzdana; ≥50 TL ürün", "warn"]);
    else rows.push(["ByNoGame Bize Sat (anında)", "—", "Steam referans fiyatı yok", null, "Steam ilk 300 popüler ürün dışında ölçülmüyor", "dim"]);
    if (st != null) rows.push(["Steam Topluluk Pazarı", `${fmtUSD(st * qty)} ilan`, "%13 kesinti", st * qty * 0.87 * fx, "NAKİT DEĞİL: yalnızca Steam cüzdanı", "dim"]);
    rows.push(["Skinport", sk != null ? `${fmtUSD(sk)} en düşük` : "—", "%8 komisyon", null, "Türkiye'ye ödeme yapmıyor (SEPA/Adyen)", "bad"]);
    const bestNet = Math.max(...rows.map((r) => r[3] ?? -1));
    $("#s-routes").innerHTML = `<tr><th>Rota</th><th>Fiyat</th><th>Kesintiler</th><th>Eline geçen (TL)</th><th>Not</th></tr>` + rows.map((r) => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td class="dim">${r[2]}</td><td class="${r[3] != null && r[3] === bestNet && r[5] === "good" ? "best" : r[5] === "dim" || r[5] === "bad" ? "dim" : ""}">${r[3] != null ? fmtTL(r[3]) + `<span class="sub">${fmtUSD(r[3] / fx)}</span>` : "—"}</td><td class="dim" style="white-space:normal;min-width:200px;text-align:left">${r[4]}</td></tr>`).join("");
    $("#s-note").innerHTML = `Nakit rotalarında <b>en iyi net</b>: ${fmtTL(bestNet)}. Steam satırı karşılaştırma için; o para banka hesabına geçmez. itemsatis ilan fiyatı varsayılanı Steam referansının %88'i (Steam yoksa nakit fiyat ÷ 0,75).`;
  }

  initKo();
})();
