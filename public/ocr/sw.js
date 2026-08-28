/* Cache the phone shell only. API POSTs are never cached. */
const CACHE = "toast-ocr-shell-v8";
const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const prefix = scopePath === "" || scopePath === "/" ? "" : scopePath;
const ASSETS = prefix
  ? [
      `${prefix}/`,
      `${prefix}/index.html`,
      `${prefix}/shell.html`,
      `${prefix}/styles.css`,
      `${prefix}/app.js`,
      `${prefix}/pipeline.js`,
      `${prefix}/lexicon.js`,
      `${prefix}/guide.js`,
      `${prefix}/merge.js`,
      `${prefix}/format.js`,
      `${prefix}/manifest.json`,
      `${prefix}/icon.svg`,
    ]
  : [
      "/",
      "/static/styles.css",
      "/static/app.js",
      "/static/pipeline.js",
      "/static/lexicon.js",
      "/static/guide.js",
      "/static/merge.js",
      "/static/format.js",
      "/static/manifest.json",
    ];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS).catch(() => undefined)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.pathname.includes("/api/")) return;
  event.respondWith(
    fetch(event.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return res;
    }).catch(() => caches.match(event.request))
  );
});
