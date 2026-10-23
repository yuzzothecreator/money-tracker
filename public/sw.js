const CACHE = "moneyflow-shell-v2";
async function shell() {
  const cache = await caches.open(CACHE);
  const response = await fetch("/");
  if (!response.ok) throw Error("App shell unavailable");
  await cache.put("/", response.clone());
  const html = await response.text();
  const assets = [...html.matchAll(/(?:src|href)="([^"\s]+)"/g)]
    .map((m) => m[1].replaceAll("&amp;", "&"))
    .filter((url) => url.startsWith("/_next/static/"));
  await cache.addAll([
    ...new Set(["/icon.svg", "/manifest.webmanifest", ...assets]),
  ]);
}
self.addEventListener("install", (e) => {
  e.waitUntil(shell());
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (
    e.request.method !== "GET" ||
    u.origin !== location.origin ||
    u.pathname.startsWith("/api")
  )
    return;
  if (e.request.mode === "navigate")
    e.respondWith(
      fetch(e.request)
        .then(async (response) => {
          if (response.ok)
            (await caches.open(CACHE)).put("/", response.clone());
          return response;
        })
        .catch(() => caches.match("/")),
    );
  else if (
    u.pathname.startsWith("/_next/static/") ||
    ["/icon.svg", "/manifest.webmanifest"].includes(u.pathname)
  )
    e.respondWith(
      caches.match(e.request).then(
        (c) =>
          c ||
          fetch(e.request).then((r) => {
            if (r.ok)
              caches.open(CACHE).then((c) => c.put(e.request, r.clone()));
            return r;
          }),
      ),
    );
});
