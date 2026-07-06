// src/main.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.update().catch(() => {});

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;

          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            const hasExistingController = Boolean(navigator.serviceWorker.controller);

            if (newWorker.state === "installed" && hasExistingController) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(() => {});
  });

  let isRefreshing = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (isRefreshing) return;

    isRefreshing = true;
    window.location.reload();
  });
}

function unregisterServiceWorkersInDev() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.getRegistrations?.().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister().catch(() => {});
    });
  });

  caches?.keys?.().then((keys) => {
    keys.forEach((key) => {
      caches.delete(key).catch(() => {});
    });
  });
}

if (import.meta.env.PROD) {
  registerServiceWorker();
} else {
  unregisterServiceWorkersInDev();
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);