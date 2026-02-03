import { qstash, getWebhookBaseUrl } from "./client";

interface ScheduleReminderOptions {
  reminderId: number;
  alertTime: Date; // When to trigger the alert
  title: string; // For logging
}

interface ScheduleResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Schedule a reminder alert using QStash.
 * QStash will call our webhook at the specified time.
 */
export async function scheduleReminderAlert(
  options: ScheduleReminderOptions,
): Promise<ScheduleResult> {
  const { reminderId, alertTime, title } = options;

  if (!qstash) {
    console.log(
      `[DEV] Would schedule reminder ${reminderId} for ${alertTime.toISOString()}`,
    );
    return { success: true, messageId: "dev-mode" };
  }

  const webhookUrl = `${getWebhookBaseUrl()}/webhooks/reminder-alert`;
  const delaySeconds = Math.max(
    0,
    Math.floor((alertTime.getTime() - Date.now()) / 1000),
  );

  // If the alert time is in the past or very soon, trigger immediately
  if (delaySeconds <= 0) {
    console.log(
      `Alert time for '${title}' is now or past, triggering immediately`,
    );
  }

  try {
    const response = await qstash.publishJSON({
      url: webhookUrl,
      body: { reminderId, alertTime: alertTime.toISOString() },
      delay: delaySeconds > 0 ? delaySeconds : undefined,
      retries: 3,
      headers: {
        "x-api-key": process.env.APP_API_KEY || "", // ADDED: Forwards key to your Elysia app
      },
    });

    console.log(
      `Scheduled alert for '${title}' at ${alertTime.toISOString()} (in ${delaySeconds}s)`,
    );

    return { success: true, messageId: response.messageId };
  } catch (error) {
    console.error(`Failed to schedule alert for '${title}':`, error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Schedule a recurring reminder using QStash cron schedules.
 * Used for reminders with cron expressions.
 */
export async function scheduleRecurringReminder(
  reminderId: number,
  cronExpression: string,
): Promise<ScheduleResult> {
  if (!qstash) {
    console.log(
      `[DEV] Would schedule recurring reminder ${reminderId} with cron: ${cronExpression}`,
    );
    return { success: true, messageId: "dev-mode" };
  }

  const webhookUrl = `${getWebhookBaseUrl()}/webhooks/reminder-alert`;

  try {
    const response = await qstash.schedules.create({
      destination: webhookUrl,
      cron: cronExpression,
      body: JSON.stringify({ reminderId, isRecurring: true }),
      headers: {
        "x-api-key": process.env.APP_API_KEY || "", // ADDED: Forwards key to your Elysia app
      },
      retries: 3,
    });

    console.log(
      `Created recurring schedule for reminder ${reminderId}: ${cronExpression}`,
    );

    return { success: true, messageId: response.scheduleId };
  } catch (error) {
    console.error(
      `Failed to create recurring schedule for ${reminderId}:`,
      error,
    );
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Cancel a scheduled message or recurring schedule.
 */
export async function cancelScheduledReminder(
  messageId: string,
): Promise<boolean> {
  if (!qstash) {
    console.log(`[DEV] Would cancel scheduled message: ${messageId}`);
    return true;
  }

  try {
    // Try to cancel as a message first
    await qstash.messages.delete(messageId);
    return true;
  } catch {
    try {
      // If that fails, try as a schedule
      await qstash.schedules.delete(messageId);
      return true;
    } catch (error) {
      console.error(`Failed to cancel scheduled reminder ${messageId}:`, error);
      return false;
    }
  }
}
