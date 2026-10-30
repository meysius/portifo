// A new version takes over at once: a home-screen app may never fully close,
// and would otherwise stay on the old handlers.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("push", (event) => {
  let data = { title: "Portifo", body: "" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Non-JSON push payload — fall back to the defaults above.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/apple-touch-icon.png",
      badge: "/apple-touch-icon.png",
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (!existing) return self.clients.openWindow(url);
      // The app routes itself; navigating the window would reload it.
      if (url !== "/") existing.postMessage({ type: "open-url", url });
      return existing.focus();
    }),
  );
});
