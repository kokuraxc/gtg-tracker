/** Returns true if the user has granted notification permission. */
export function notificationsGranted(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

/** Returns true if notifications are enabled in the app (user opted in AND permission granted). */
export function notificationsEnabled(): boolean {
  return notificationsGranted() && localStorage.getItem('gtg-notifications') === '1';
}

/**
 * Request permission and, if granted, persist the opt-in flag.
 * Returns the final permission state.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') {
    localStorage.setItem('gtg-notifications', '1');
    return 'granted';
  }
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  if (result === 'granted') localStorage.setItem('gtg-notifications', '1');
  return result;
}

/** Disable notifications (clear opt-in flag; does not revoke browser permission). */
export function disableNotifications() {
  localStorage.removeItem('gtg-notifications');
}

/**
 * Ask the SW to fire a notification for exerciseId after delayMs milliseconds.
 * Replaces any existing pending notification for the same exercise.
 */
export function scheduleGtgNotification(
  exerciseId: number,
  exerciseName: string,
  delayMs: number
): void {
  if (!notificationsEnabled()) return;
  navigator.serviceWorker.ready.then(reg => {
    reg.active?.postMessage({
      type: 'SCHEDULE_GTG_NOTIFICATION',
      exerciseId: String(exerciseId),
      exerciseName,
      delayMs,
    });
  });
}

/** Cancel a pending GTG notification for exerciseId (e.g. when max sets reached). */
export function cancelGtgNotification(exerciseId: number): void {
  navigator.serviceWorker.ready.then(reg => {
    reg.active?.postMessage({
      type: 'CANCEL_GTG_NOTIFICATION',
      exerciseId: String(exerciseId),
    });
  });
}
