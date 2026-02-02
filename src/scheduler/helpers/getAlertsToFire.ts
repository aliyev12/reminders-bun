import type { TReminder } from "../../schemas";

type Alert = {
  id: string;
  time: number;
};

/**
 * Determines which alerts should fire right now for a given reminder.
 *
 * @param reminder - The reminder to check alerts for
 * @param eventTime - The calculated event time (next occurrence for recurring, fixed date for one-time)
 * @param now - The current time
 * @param intervalMs - The scheduler interval in milliseconds
 * @returns Array of alerts that should fire (typically 0 or 1 alert)
 */
export function getAlertsToFire(
  reminder: TReminder,
  eventTime: Date,
  now: Date,
  intervalMs: number,
): Alert[] {
  const alertsToFire: Alert[] = [];

  // Loop through all alerts and check if any should fire
  for (const alert of reminder.alerts) {
    const alertDuration = alert.time;
    const alertTime = new Date(eventTime.getTime() - alertDuration);

    const diff = now.getTime() - alertTime.getTime();

    // Check if the alert was triggered in the last cycle (0s <= diff < intervalMs)
    if (diff >= 0 && diff < intervalMs) {
      // Final check: If recurring, make sure we haven't alerted for this specific event time yet
      if (reminder.is_recurring && reminder.last_alert_time) {
        const lastAlertTime = new Date(reminder.last_alert_time);

        if (lastAlertTime.getTime() >= alertTime.getTime()) {
          // Already alerted for this recurrence instance
          continue;
        }
      }

      // This alert should fire
      alertsToFire.push(alert);

      // Only return the first alert that should fire per cycle
      break;
    }
  }

  return alertsToFire;
}
