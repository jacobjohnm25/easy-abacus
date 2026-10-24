// Offline support: the app shell is cached on install; Google Fonts are cached the first time they load.
const VERSION = "v2";
const PREFIX = "jobsite-";
const SHELL = `${PREFIX}shell-${VERSION}`;
const FONTS = `${PREFIX}fonts-${VERSION}`;
const ASSETS = [
  "./", "index.html", "styles.css", "app.js", "theme-config.js", "manifest.webmanifest",
  "../shared/storage.js", "../shared/theme.js", "../shared/theme.css",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== SHELL && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONTS).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((res) => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // Pages: network first so updates show up, cache when offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => { caches.open(SHELL).then((c) => c.put("index.html", res.clone())); return res; })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  // Everything else: cache first, refresh in the background.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
