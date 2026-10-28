/* =========================================================
   ZongaElements · Service worker
   Solo para notificaciones (no guarda nada en caché, así la web
   siempre se ve en su última versión).
   ========================================================= */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: "ZongaElements", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "ZongaElements", {
    body: d.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: d.tag,
    data: { url: d.url || "/" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) if (w.url.split("#")[0] === url.split("#")[0] && "focus" in w) { w.navigate && w.navigate(url); return w.focus(); }
    return self.clients.openWindow(url);
  })());
});
