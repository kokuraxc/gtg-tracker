/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Inject Workbox precache manifest
precacheAndRoute(self.__WB_MANIFEST);

// ── Notification click → focus/open the app ───────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        const appClient = clients.find(c => c.url.includes('/gtg-tracker/'));
        if (appClient) return appClient.focus();
        return self.clients.openWindow('/gtg-tracker/');
      })
  );
});

// ── GTG notification scheduler ────────────────────────────
// Map: exerciseId (string) → timer handle
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

self.addEventListener('message', event => {
  const data = event.data as Record<string, unknown> | null;
  if (!data) return;

  if (data.type === 'SCHEDULE_GTG_NOTIFICATION') {
    const id       = String(data.exerciseId);
    const name     = String(data.exerciseName);
    const delayMs  = Number(data.delayMs);

    // Cancel any existing timer for this exercise
    if (pendingTimers.has(id)) clearTimeout(pendingTimers.get(id));

    const tid = setTimeout(() => {
      pendingTimers.delete(id);
      self.registration.showNotification(`${name} · ready! 💪`, {
        body: 'Time for your next GTG set.',
        icon: '/gtg-tracker/icons/icon-192.png',
        badge: '/gtg-tracker/icons/icon-192.png',
        tag: `gtg-${id}`,
        renotify: true,
        silent: false,
      } as NotificationOptions);
    }, delayMs);

    pendingTimers.set(id, tid);
  }

  if (data.type === 'CANCEL_GTG_NOTIFICATION') {
    const id = String(data.exerciseId);
    if (pendingTimers.has(id)) {
      clearTimeout(pendingTimers.get(id));
      pendingTimers.delete(id);
    }
  }
});
