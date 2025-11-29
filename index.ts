import { Elysia } from "elysia";
import { checkReminders } from "./src/check-reminders";
import { unprotectedRoutes } from "./src/constants";
import { routes } from "./src/route-handlers";

const API_KEY = process.env.APP_API_KEY;
const PORT = process.env.APP_PORT;
const SCHEDULER_INTERVAL = Number(process.env.SCHEDULER_INTERVAL) || 3000;

// Start Scheduler (runs every 3s)
setInterval(checkReminders, SCHEDULER_INTERVAL);
console.log("Scheduler started.");

const app = new Elysia()
  .onError(({ code, error, set }) => {
    console.error(error);
    set.status = 500;

    const errorMessage = (error as Error).message || "Unknown error occurred.";
    return { error: "Internal Server Error", details: errorMessage };
  })
  .onBeforeHandle(({ request, set }) => {
    const url = new URL(request.url);
    const routeIsUnprotected = unprotectedRoutes.some(
      (route) =>
        route.method === request.method && route.pathname === url.pathname
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
  .listen(PORT || 8080);

console.log(`Server is running at ${app.server?.hostname}:${app.server?.port}`);
