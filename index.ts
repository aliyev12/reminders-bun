import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { checkReminders } from "./src/check-reminders";
import { unprotectedRoutes } from "./src/constants";
import { routes } from "./src/route-handlers";
import { cors } from "@elysiajs/cors";
import { webhookReminderAlertRoute } from "./src/route-handlers/webhook-reminder-alert";
import { webhookCleanupRoute } from "./src/route-handlers/webhook-cleanup";
import { ensureCleanupSchedule } from "./src/qstash/scheduler";
import * as s from "./src/swagger";

const API_KEY = process.env.APP_API_KEY;
const PORT = process.env.APP_PORT;
const SCHEDULER_INTERVAL = Number(process.env.SCHEDULER_INTERVAL) || 3000;
const USE_POLLING = process.env.USE_POLLING === "true";

if (USE_POLLING || !process.env.QSTASH_TOKEN) {
  // Local dev: poll checkReminders on an interval so alerts fire without QStash.
  setInterval(checkReminders, SCHEDULER_INTERVAL);
  console.log(`Polling scheduler started (interval: ${SCHEDULER_INTERVAL}ms)`);
} else {
  // Production: QStash fires alerts via /webhooks/reminder-alert.
  // Register (or update) the monthly cleanup cron so stale reminders get deactivated.
  ensureCleanupSchedule();
  console.log("QStash scheduler active - daily cleanup scheduled");
}

const app = new Elysia()
  .use(swagger(s.swaggerMainConfig))
  .use(
    cors({
      origin: "http://localhost:3000", // Allow your React app
      allowedHeaders: ["Content-Type", "x-api-key"], // 2. Must include your custom header!
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    }),
  )
  .onError(({ error, set }) => {
    console.error(error);
    set.status = 500;

    const errorMessage = (error as Error).message || "Unknown error occurred.";
    return { error: "Internal Server Error", details: errorMessage };
  })

  .onBeforeHandle(({ request, set }) => {
    // 1. ADD THIS LINE: Ignore preflight requests
    if (request.method === "OPTIONS") return;

    const url = new URL(request.url);
    const routeIsUnprotected = unprotectedRoutes.some(
      (route) =>
        route.method === request.method && route.pathname === url.pathname,
    );

    if (routeIsUnprotected) return;

    const apiKey = request.headers.get("x-api-key");

    if (apiKey !== API_KEY) {
      set.status = 401;
      return { error: "Invalid or missing API Key" };
    }
  })
  .get("/reminders", routes.getActiveRemindersRoute, s.swaggerActiveReminders)
  .get("/reminders/all", routes.getAllRemindersRoute, s.swaggerAllReminders)
  .get("/reminders/:id", routes.getReminderByIdRoute, s.swaggerGetReminderById)
  .post("/reminders", routes.createReminderRoute, s.swaggerCreateReminder)
  .put("/reminders/:id", routes.updateReminderRoute, s.swaggerUpdateReminder)
  .delete("/reminders/:id", routes.deleteReminderRoute, s.swaggerDeleteReminder)
  .delete(
    "/reminders/bulk",
    routes.deleteRemindersBulkRoute,
    s.swaggerDeleteRemindersBulk,
  )
  .post(
    "/webhooks/reminder-alert",
    webhookReminderAlertRoute,
    s.swaggerWebhookAlert,
  )
  .post("/webhooks/cleanup", webhookCleanupRoute, s.swaggerWebhookCleanup)
  .listen(PORT || 8080);

console.log(`Server is running at ${app.server?.hostname}:${app.server?.port}`);

// .onBeforeHandle(({ request, set }) => {
//   const url = new URL(request.url);
//   const routeIsUnprotected = unprotectedRoutes.some(
//     (route) =>
//       route.method === request.method && route.pathname === url.pathname,
//   );

//   if (routeIsUnprotected) return;

//   const apiKey = request.headers.get("x-api-key");

//   if (apiKey !== API_KEY) {
//     set.status = 401;
//     return { error: "Invalid or missing API Key" };
//   }
// })
