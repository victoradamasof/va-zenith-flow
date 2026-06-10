const CACHE_NAME = "va-manager-pwa-v3";
const APP_SHELL = [
  "/",
  "/dashboard",
  "/site.webmanifest",
  "/favicon.ico",
  "/app-icon-192.png",
  "/app-icon-512.png",
  "/apple-touch-icon.png",
  "/va-consultoria-mark.png",
  "/va-consultoria-logo-cropped.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match("/dashboard")) ||
            (await caches.match("/"))
          );
        })
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".webmanifest");

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});

async function getLatestPushPayload(event) {
  if (event.data) {
    try {
      return event.data.json();
    } catch {
      return { body: event.data.text() };
    }
  }

  try {
    const response = await fetch("/api/push/events?limit=1", {
      headers: { accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) return null;

    const payload = await response.json();
    return Array.isArray(payload.events) ? payload.events[0] : null;
  } catch {
    return null;
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    getLatestPushPayload(event).then((payload) => {
      const title = payload?.title || "VA Consultoria Manager";
      const options = {
        body: payload?.body || "Novo evento sincronizado no sistema.",
        icon: "/app-icon-192.png",
        badge: "/app-icon-192.png",
        tag: payload?.tag || payload?.id || `va-${Date.now()}`,
        renotify: true,
        data: { url: payload?.url || "/dashboard" }
      };

      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  const url = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url === url);
      if (existingClient) return existingClient.focus();
      return self.clients.openWindow(url);
    })
  );
});
