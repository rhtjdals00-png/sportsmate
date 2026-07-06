// public/sw.js

const CACHE_NAME = "sportsmate-v5";
const STATIC_ASSETS = ["/", "/manifest.json", "/images/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => null)
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isNavigation = request.mode === "navigate";

  /*
    외부 요청은 서비스워커가 건드리지 않습니다.
    Render API, Supabase, Google 프로필 이미지 등은 브라우저 기본 fetch에 맡깁니다.
  */
  if (!isSameOrigin) return;

  /*
    Vercel/Vite 빌드 산출물은 네트워크 우선입니다.
    새 배포 후 예전 JS/CSS를 오래 물고 있는 문제를 줄이기 위함입니다.
  */
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch(() => null);
          });

          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || new Response("", { status: 504, statusText: "Network unavailable" });
        })
    );
    return;
  }

  /*
    페이지 이동은 네트워크 우선입니다.
    오프라인일 때만 "/" 캐시로 fallback합니다.
  */
  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put("/", responseClone).catch(() => null);
          });

          return response;
        })
        .catch(async () => {
          const cached = await caches.match("/");
          return cached || new Response("", { status: 504, statusText: "Network unavailable" });
        })
    );
    return;
  }

  /*
    manifest, logo 같은 같은-origin 정적 파일은 캐시 우선입니다.
    없으면 네트워크에서 가져오고 캐시에 저장합니다.
  */
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          const responseClone = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch(() => null);
          });

          return response;
        })
        .catch(() => {
          return new Response("", {
            status: 504,
            statusText: "Network unavailable"
          });
        });
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {
      title: "SportsMate",
      body: event.data?.text() || "새 알림이 도착했습니다."
    };
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

  const targetUrl = new URL(
    event.notification.data?.url || "/notifications",
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true
      })
      .then((clientList) => {
        const exactClient = clientList.find((client) => client.url === targetUrl);

        if (exactClient) {
          exactClient.focus();
          return exactClient.navigate(targetUrl);
        }

        const sameOriginClient = clientList.find((client) =>
          client.url.startsWith(self.location.origin)
        );

        if (sameOriginClient) {
          sameOriginClient.focus();
          return sameOriginClient.navigate(targetUrl);
        }

        return self.clients.openWindow(targetUrl);
      })
  );
});