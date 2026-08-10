/** Fire-and-forget nudge to process the notification outbox right after a
 * mutation that enqueued a row, so delivery feels immediate. Not awaited —
 * if this call is dropped, the outbox row persists as 'pending' and is
 * still processed the next time anything calls this (self-healing, no
 * separate retry sweep needed for this app's scale). */
export function triggerNotificationProcessing() {
  fetch("/api/notifications/process", { method: "POST" }).catch(() => {});
}
