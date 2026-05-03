// Stage 10 Service Worker Purpose
const CACHE_NAME = "studio-os-shell-v2";
const STATIC_ROUTES = [
  "/",
  "/studio",
  "/app-icon.svg",
  "/app-icon-maskable.svg",
  "/manifest.webmanifest",
];

const STATIC_ASSET_PREFIXES = ["/_next/static/", "/_next/image/"];
const STATIC_FILE_EXTENSIONS =
  /\.(?:css|js|mjs|png|jpg|jpeg|webp|svg|ico|woff2?)$/i;

const isSameOrigin = (url) => url.origin === self.location.origin;
const isStaticAssetRequest = (requestUrl) =>
  STATIC_ASSET_PREFIXES.some((prefix) => requestUrl.pathname.startsWith(prefix)) ||
  STATIC_FILE_EXTENSIONS.test(requestUrl.pathname);
const isShellNavigation = (request, requestUrl) =>
  request.mode === "navigate" &&
  (requestUrl.pathname === "/" || requestUrl.pathname === "/studio");

const cacheFirst = async (request) => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
};

const networkFirst = async (request) => {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    return caches.match("/");
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ROUTES)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);
  if (!isSameOrigin(requestUrl)) {
    return;
  }

  if (isStaticAssetRequest(requestUrl)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isShellNavigation(request, requestUrl)) {
    event.respondWith(networkFirst(request));
  }
});
