import { sendEmail } from "./email-handlers";
import { getReminders } from "./route-handlers";
import { deactivateReminder, updateLastAlertTime } from "./utils";
import {
  shouldDeactivateOneTime,
  shouldDeactivateRecurring,
  calculateNextEventTime,
  getAlertsToFire,
} from "./scheduler/helpers";

const SCHEDULER_INTERVAL = Number(process.env.SCHEDULER_INTERVAL) || 3000;

export const checkReminders = async () => {
  const reminders = getReminders();
  const now = new Date();

  for (const reminder of reminders) {
    // Only process reminders that are active
    if (!reminder.is_active) continue;

    if (!reminder.alerts || reminder.alerts.length === 0) continue;

    let eventTime: Date;

    if (reminder.is_recurring && reminder.recurrence) {
      // Calculate next occurrence time for recurring events
      const nextEventTime = calculateNextEventTime(reminder, now);

      if (!nextEventTime) {
        // Cron parsing failed, skip this reminder
        continue;
      }

      // Check if should deactivate using the already-calculated nextEventTime
      const { shouldDeactivate, reason } = shouldDeactivateRecurring(
        reminder,
        nextEventTime,
      );
      if (shouldDeactivate) {
        console.log(
          `DEACTIVATING RECURRING REMINDER: '${reminder.title}' - ${reason}`,
        );
        deactivateReminder(reminder.id!, reminder.title);
        continue;
      }

      eventTime = nextEventTime;
    } else {
      // Check if one-time reminder should be deactivated
      const { shouldDeactivate } = shouldDeactivateOneTime(reminder, now);
      if (shouldDeactivate) {
        deactivateReminder(reminder.id!, reminder.title);
        continue;
      }

      // Use the fixed date for one-time events
      eventTime = new Date(reminder.date);
    }

    // Check which alerts should fire right now
    const alertsToFire = getAlertsToFire(
      reminder,
      eventTime,
      now,
      SCHEDULER_INTERVAL,
    );

    // Process any alerts that should fire
    if (alertsToFire.length > 0) {
      console.log(
        `ALERT TRIGGERED for '${reminder.title}'! Sending notifications...`,
      );

      for (const contact of reminder.reminders) {
        if (contact.mode === "email") {
          await sendEmail(
            contact.address,
            reminder.title,
            reminder.description,
          );
        }
      }

      // Acknowledge the alert by setting the last_alert_time to NOW
      updateLastAlertTime(reminder.id!, now);
    }
  }
};
