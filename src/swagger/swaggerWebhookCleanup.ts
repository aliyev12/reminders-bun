export const swaggerWebhookCleanup = {
  detail: {
    tags: ["Webhooks"],
    summary: "Monthly cleanup webhook for stale reminders",
    description:
      "Triggered monthly by a QStash cron job. Deactivates one-time reminders that have already alerted or are past due, " +
      "and recurring reminders whose next occurrence exceeds their end_date. Does not send any notifications.",
    responses: {
      200: {
        description: "Cleanup completed successfully. Returns { status, deactivated, checked }.",
      },
      401: {
        description: "Invalid QStash signature",
      },
    },
  },
};
