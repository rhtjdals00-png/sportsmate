const CACHE_NAME = "sportsmate-v2";
const STATIC_ASSETS = ["/", "/manifest.json", "/images/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const request = event.request;
  const isNavigation = request.mode === "navigate";

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).catch(() => {
        if (isNavigation) {
          return caches.match("/");
        }
        throw new Error("Network request failed.");
      });
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { title: "SportsMate", body: event.data?.text() || "새 알림이 도착했습니다." };
  }

  const title = payload.title || "SportsMate";
  const options = {
    body: payload.body || "새 알림이 도착했습니다.",
    icon: "/images/logo.png",
    badge: "/images/logo.png",
    data: {
      url: payload.url || "/notifications"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/notifications", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const client = clientList.find((item) => item.url === targetUrl || item.url.startsWith(self.location.origin));
      if (client) {
        client.focus();
        return client.navigate(targetUrl);
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
