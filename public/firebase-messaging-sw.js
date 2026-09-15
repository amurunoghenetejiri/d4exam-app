/* D4EXAM Firebase Messaging + offline-first app shell */
/* global importScripts, firebase */
importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAuezyy29nHrBdwMaVV8q__xLwWB9K2ieQ",
  authDomain: "d4exam-6506a.firebaseapp.com",
  projectId: "d4exam-6506a",
  storageBucket: "d4exam-6506a.firebasestorage.app",
  messagingSenderId: "719974201137",
  appId: "1:719974201137:web:c172a34706249f0046e210",
  measurementId: "G-0GNB3TGQBG",
});

var messaging = firebase.messaging();

var SHELL_CACHE = "d4exam-shell-v6";
var RUNTIME_CACHE = "d4exam-runtime-v6";
var SHELL_URLS = [
  "/",
  "/index.html",
  "/offline.html",
  "/icon-192.png",
  "/icon-512.png",
  "/logo.png",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/site.webmanifest",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(SHELL_URLS).catch(function () {});
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          if (
            k !== SHELL_CACHE &&
            k !== RUNTIME_CACHE &&
            (k.indexOf("d4exam-shell-") === 0 || k.indexOf("d4exam-runtime-") === 0)
          ) {
            return caches.delete(k);
          }
          return null;
        }),
      );
    }).then(function () {
      return self.clients.claim();
    }),
  );
});

messaging.onBackgroundMessage(function (payload) {
  var title = (payload.notification && payload.notification.title) || "D4EXAM";
  var body = (payload.notification && payload.notification.body) || "";
  var data = payload.data || {};
  self.registration.showNotification(title, {
    body: body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: data,
  });
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = "/";
  try {
    if (event.notification && event.notification.data && event.notification.data.url) {
      url = event.notification.data.url;
    }
  } catch (e) {}
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var c = clientList[i];
        if (c.url && "focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Navigation: network-first, fall back to cache / offline.html
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          try {
            var copy = res.clone();
            caches.open(RUNTIME_CACHE).then(function (c) {
              c.put(req, copy);
            });
          } catch (e) {}
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (cached) {
            if (cached) return cached;
            return caches.match("/index.html").then(function (idx) {
              if (idx) return idx;
              return caches.match("/").then(function (root) {
                if (root) return root;
                return caches.match("/offline.html");
              });
            });
          });
        }),
    );
    return;
  }

  // Static assets: cache-first
  if (
    url.pathname.indexOf("/assets/") === 0 ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|ico)$/)
  ) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req)
          .then(function (res) {
            try {
              var copy = res.clone();
              caches.open(RUNTIME_CACHE).then(function (c) {
                c.put(req, copy);
              });
            } catch (e) {}
            return res;
          })
          .catch(function () {
            return caches.match(req);
          });
      }),
    );
    return;
  }

  // Other same-origin: network with offline.html fallback for HTML-ish fails
  event.respondWith(
    fetch(req).catch(function () {
      return caches.match(req).then(function (cached) {
        if (cached) return cached;
        return caches.match("/offline.html");
      });
    }),
  );
});
