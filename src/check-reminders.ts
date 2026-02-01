import cron_parse from "cron-parser";
import { sendEmail } from "./email-handlers";
import { getReminders } from "./route-handlers";
import { deactivateReminder, updateLastAlertTime } from "./utils";

const SCHEDULER_INTERVAL = Number(process.env.SCHEDULER_INTERVAL) || 3000;

export const checkReminders = async () => {
  const reminders = getReminders();
  const now = new Date();
  // console.log("reminders = ", reminders);

  for (const r of reminders) {
    // Only process reminders that are active
    if (!r.is_active) continue;

    if (!r.alerts || r.alerts.length === 0) continue;

    let eventTime: Date;

    if (r.is_recurring && r.recurrence) {
      // Calculate next occurrence time for recurring events
      try {
        const interval = cron_parse.parse(r.recurrence, { currentDate: now });
        eventTime = interval.next().toDate();

        // --- DEACTIVATION LOGIC FOR RECURRING EVENTS ---
        if (r.end_date) {
          const endDate = new Date(r.end_date);

          if (eventTime.getTime() > endDate.getTime()) {
            // If the *next* occurrence is past the end_date, deactivate the reminder.
            console.log(
              `DEACTIVATING RECURRING REMINDER: '${r.title}' as it passed end_date.`,
            );
            deactivateReminder(r.id!, r.title);
            continue; // Skip processing this reminder further in this cycle
          }
        }
        // --- END DEACTIVATION LOGIC ---
      } catch (err) {
        console.error(`Error parsing cron for ${r.title}`, err);
        continue;
      }
    } else {
      // Use the fixed date for one-time events
      eventTime = new Date(r.date);

      // If a one-time event has already alerted, deactivate it and skip.
      if (r.last_alert_time) {
        // --- DEACTIVATION LOGIC FOR ONE-TIME EVENTS ---
        console.log(
          `DEACTIVATING ONE-TIME REMINDER: '${r.title}' as it has already alerted.`,
        );
        deactivateReminder(r.id!, r.title);
        continue; // Skip processing this reminder further in this cycle
        // --- END DEACTIVATION LOGIC ---
      }

      // Stale one-time event check (passed due)
      // If the event time is more than an hour in the past and it has never alerted, consider it stale.
      if (eventTime.getTime() < now.getTime() - 60 * 60 * 1000) {
        // If event was missed by more than an hour and never alerted, deactivate to prevent stale check.
        deactivateReminder(r.id!, r.title);
        console.log(
          `DEACTIVATING STALE ONE-TIME REMINDER: '${r.title}' as it was missed an hour ago and never alerted.`,
        );
        continue;
      }
    }

    // Now, calculate the alert time based on the event time and offsets
    for (const offsetMs of r.alerts.map((alert) => alert.time)) {
      const alertDuration = offsetMs;
      const alertTime = new Date(eventTime.getTime() - alertDuration);

      const diff = now.getTime() - alertTime.getTime();

      // Check if the alert was triggered in the last cycle (0s <= diff < 3000ms based on 3s interval)
      if (diff >= 0 && diff < SCHEDULER_INTERVAL) {
        // Final check: If recurring, make sure we haven't alerted for this specific event time yet.
        if (r.is_recurring && r.last_alert_time) {
          const lastAlertTime = new Date(r.last_alert_time);

          if (lastAlertTime.getTime() >= alertTime.getTime()) {
            // Already alerted for this recurrence instance
            continue;
          }
        }

        console.log(
          `ALERT TRIGGERED for '${r.title}'! Sending notifications...`,
        );

        for (const contact of r.reminders) {
          if (contact.mode === "email") {
            await sendEmail(contact.address, r.title, r.description);
          }
        }

        // Acknowledge the alert by setting the last_alert_time to NOW
        updateLastAlertTime(r.id!, now);

        // Break out of the alerts loop to prevent multiple alerts for the same event in one run
        break;
      }
    }
  }
};
