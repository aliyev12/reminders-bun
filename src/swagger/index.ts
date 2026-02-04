import { swagger, type ElysiaSwaggerConfig } from "@elysiajs/swagger";

export const swaggerMainConfig: ElysiaSwaggerConfig = {
  documentation: {
    info: {
      title: "Reminders API",
      version: "1.0.0",
      description:
        "A comprehensive REST API for managing reminders with support for one-time and recurring alerts via email, SMS, push notifications, and iCalendar.",
    },
    tags: [
      {
        name: "Reminders",
        description: "Manage reminder operations",
      },
      {
        name: "Webhooks",
        description: "Webhook endpoints for reminder alerts",
      },
    ],
    servers: [
      {
        url: "http://localhost:8080",
        description: "Local development server",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description:
            "API Key authentication. Your API key is automatically available in Swagger UI - just start making requests!",
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
  },
};

export * from "./swaggerActiveReminders";
export * from "./swaggerAllReminders";
export * from "./swaggerGetReminderById";
export * from "./swaggerCreateReminder";
export * from "./swaggerUpdateReminder";
export * from "./swaggerDeleteReminder";
export * from "./swaggerDeleteRemindersBulk";
export * from "./swaggerWebhookAlert";
export * from "./swaggerWebhookCleanup";
