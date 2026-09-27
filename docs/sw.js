// Web push service worker: bildirimi göster, tıklayınca ilgili sayfayı aç.
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: "LootRadar", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "LootRadar", { body: d.body || "", icon: d.icon || "/icon.svg", badge: d.icon || "/icon.svg", data: { url: d.url || "/" }, tag: d.tag }));
});
self.addEventListener("notificationclick", (e) => { e.notification.close(); const url = e.notification.data?.url || "/"; e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => { for (const c of cs) { if ("focus" in c) { c.navigate(url); return c.focus(); } } return clients.openWindow(url); })); });
