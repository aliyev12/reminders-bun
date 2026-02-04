import { getReminderRepository } from "./repositories";
import { deactivateReminder } from "./utils";
import {
  shouldDeactivateOneTime,
  shouldDeactivateRecurring,
  calculateNextEventTime,
} from "./scheduler/helpers";

/**
 * Deactivates stale reminders without processing alerts or sending notifications.
 * - One-time: deactivated if already alerted or >1 hour past due.
 * - Recurring: deactivated if next occurrence exceeds end_date.
 */
export function cleanupStaleReminders(): { deactivated: number; checked: number } {
  const repo = getReminderRepository();
  const reminders = repo.findActive();
  const now = new Date();
  let deactivated = 0;

  for (const reminder of reminders) {
    let result: { shouldDeactivate: boolean; reason?: string };

    if (reminder.is_recurring && reminder.recurrence) {
      const nextEventTime = calculateNextEventTime(reminder, now);
      if (!nextEventTime) continue;
      result = shouldDeactivateRecurring(reminder, nextEventTime);
    } else {
      result = shouldDeactivateOneTime(reminder, now);
    }

    if (result.shouldDeactivate) {
      deactivateReminder(reminder.id!, reminder.title);
      console.log(`CLEANUP: Deactivated '${reminder.title}' - ${result.reason}`);
      deactivated++;
    }
  }

  console.log(`CLEANUP: Checked ${reminders.length} reminders, deactivated ${deactivated}`);
  return { deactivated, checked: reminders.length };
}
