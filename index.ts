import { Elysia } from "elysia";
import { checkReminders } from "./src/check-reminders";
import { unprotectedRoutes } from "./src/constants";
import { routes } from "./src/route-handlers";
import { cors } from "@elysiajs/cors";

const API_KEY = process.env.APP_API_KEY;
const PORT = process.env.APP_PORT;
const SCHEDULER_INTERVAL = Number(process.env.SCHEDULER_INTERVAL) || 3000;

// Start Scheduler (runs every 3s)
setInterval(checkReminders, SCHEDULER_INTERVAL);
console.log("Scheduler started.");

const app = new Elysia()
  .use(
    cors({
      origin: "http://localhost:3000", // Allow your React app
      allowedHeaders: ["Content-Type", "x-api-key"], // 2. Must include your custom header!
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    }),
  )
  .onError(({ code, error, set }) => {
    console.error(error);
    set.status = 500;

    const errorMessage = (error as Error).message || "Unknown error occurred.";
    return { error: "Internal Server Error", details: errorMessage };
  })
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
  .get("/reminders", routes.getActiveRemindersRoute)
  .get("/reminders/all", routes.getAllRemindersRoute)
  .get("/reminders/:id", routes.getReminderByIdRoute)
  .post("/reminders", routes.createReminderRoute)
  .put("/reminders/:id", routes.updateReminderRoute)
  .delete("/reminders/:id", routes.deleteReminderRoute)
  .delete("/reminders/bulk", routes.deleteRemindersBulkRoute)
  .listen(PORT || 8080);

console.log(`Server is running at ${app.server?.hostname}:${app.server?.port}`);
