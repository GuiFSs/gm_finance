self.addEventListener("push", (event) => {
  const data = JSON.parse(event?.data?.text() || "{}");
  event.waitUntil(
    self.registration.showNotification(data.title || "G&M Finance", {
      body: data.message || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/movements" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/movements";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus().then((focused) => {
          if (focused && "navigate" in focused) {
            return focused.navigate(targetUrl);
          }
          return focused;
        });
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
