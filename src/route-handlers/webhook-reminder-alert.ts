import type { Context } from "elysia";
import { verifyQStashSignature } from "../qstash/verify";
import { getReminderById } from "./route-helpers";
import { sendNotifications } from "../scheduler/notification-service";
import { deactivateReminder, updateLastAlertTime } from "../utils";

interface WebhookPayload {
  reminderId: number;
  alertTime?: string;
  isRecurring?: boolean;
}

export const webhookReminderAlertRoute = async ({
  request,
  body,
  set,
}: Context) => {
  // Verify the request came from QStash
  const signature = request.headers.get("upstash-signature");
  const rawBody = JSON.stringify(body);

  const isValid = await verifyQStashSignature(signature, rawBody);
  if (!isValid) {
    console.log("Invalid QStash signature on reminder alert webhook");
    set.status = 401;
    return { error: "Invalid signature" };
  }

  const payload = body as WebhookPayload;
  const { reminderId, isRecurring } = payload;

  console.log(`Webhook received for reminder ${reminderId}`);

  // Get the reminder
  const reminder = getReminderById(reminderId);

  if (!reminder) {
    console.log(`Reminder ${reminderId} not found - may have been deleted`);
    return { status: "skipped", reason: "reminder_not_found" };
  }

  if (!reminder.is_active) {
    console.log(`Reminder ${reminderId} is inactive - skipping`);
    return { status: "skipped", reason: "inactive" };
  }

  // Send notifications
  console.log(`Sending notifications for '${reminder.title}'`);
  await sendNotifications(reminder, reminder.reminders);

  // Update last alert time
  updateLastAlertTime(reminder.id!, new Date());

  // Deactivate one-time reminders after sending
  if (!isRecurring && !reminder.is_recurring) {
    deactivateReminder(reminder.id!, reminder.title);
    console.log(`One-time reminder '${reminder.title}' deactivated`);
  }

  return { status: "ok", reminderTitle: reminder.title };
};
