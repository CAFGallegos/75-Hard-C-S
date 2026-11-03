// 75 Hard service worker: offline shell + Web Push.
// No start_url in the manifest on purpose: the installed app keeps the private
// ?k= link it was added from.
const VERSION = "v2";
const CACHE = `75hard-${VERSION}`;
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/app.js", "js/store.js", "js/api.js", "js/config.js", "js/rules.js", "js/util.js", "js/icons.js",
  "js/theme.js", "js/photo.js", "js/push.js", "js/voice.js",
  "js/views/today.js", "js/views/board.js", "js/views/photos.js", "js/views/settings.js", "js/views/welcome.js",
  "fonts/archivo.woff2", "fonts/archivo-italic.woff2", "fonts/geist.woff2",
  "icons/icon-192.png", "icons/apple-touch-icon.png", "icons/favicon-32.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return; // API calls go straight to the network

  const isStatic = /\.(woff2|png|svg)$/.test(url.pathname);
  if (isStatic) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
    return;
  }
  // Network first (fresh code), fall back to cache when offline.
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: "no-cache" });
      if (res.ok) {
        const c = await caches.open(CACHE);
        c.put(req.mode === "navigate" ? "index.html" : req, res.clone()).catch(() => {});
      }
      return res;
    } catch (_) {
      const hit = req.mode === "navigate"
        ? await caches.match("index.html")
        : await caches.match(req, { ignoreSearch: true });
      return hit || Response.error();
    }
  })());
});

self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) { data = { title: "75 Hard", body: e.data?.text() }; }
  const title = data.title || "75 Hard";
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    tag: data.tag || undefined,
    icon: "icons/icon-192.png",
    badge: "icons/badge-96.png",
    data: { tab: data.person ? "board" : "today" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const tab = e.notification.data?.tab || "today";
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) {
        await c.focus();
        c.postMessage({ type: "nav", tab });
        return;
      }
    }
    await self.clients.openWindow(`./?tab=${tab}`);
  })());
});
