// 75 Hard service worker: offline shell + Web Push.
// No start_url in the manifest on purpose: the installed app keeps the private
// ?k= link it was added from.
const VERSION = "v9";
const CACHE = `75hard-${VERSION}`;
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/app.js", "js/store.js", "js/api.js", "js/config.js", "js/rules.js", "js/util.js", "js/icons.js",
  "js/theme.js", "js/photo.js", "js/push.js", "js/voice.js", "js/daily.js", "js/daily-lines.js", "js/nudges.js", "js/widget-setup.js",
  "js/views/today.js", "js/views/board.js", "js/views/photos.js", "js/views/settings.js", "js/views/welcome.js",
  "js/lift-focus.js", "js/lift-rest.js", "js/lift-catalog.js", "js/exercise-catalog.json", "js/exercise-catalog.source.json", "icons/exercises/LICENSE.txt", "icons/exercises/SOURCE.md", "js/lift-domain.js", "js/lift-routine.js", "js/lift-generator.js", "js/lift-programs.js", "js/lift-backup.js", "js/lift-analytics.js", "supabase/functions/_shared/lift-schema.js",
  "js/lift-library.js", "js/lift-timer.js", "js/exercise-data.json", "js/lift-rules.js", "js/lift-store.js", "js/views/lift.js",
  "fonts/archivo.woff2", "fonts/archivo-italic.woff2", "fonts/geist.woff2",
  "icons/icon-192.png", "icons/apple-touch-icon.png", "icons/favicon-32.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(SHELL);
    // Catalog text is required offline; media is fetched only when opened.
  }).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k !== `${CACHE}-media`) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if(req.method === "GET" && (url.href.startsWith("https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/") || (url.origin===location.origin && url.pathname.includes('/icons/exercises/') && url.pathname.endsWith('.jpg')))) {
    e.respondWith((async()=>{
      const cache=await caches.open(`${CACHE}-media`);
      const hit=await cache.match(req);if(hit)return hit;
      const response=await fetch(req);
      if(response.ok){
        try{
          const bytes=(await response.clone().blob()).size;
          // At most 40 viewed photos, each <=1 MiB; cache failures never block logging.
          if(bytes<=1024*1024){await cache.put(req,response.clone());const keys=await cache.keys();while(keys.length>40)await cache.delete(keys.shift());}
        }catch{/* Storage pressure: return the fetched photo without caching. */}
      }
      return response;
    })().catch(()=>Response.error()));
    return;
  }
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
