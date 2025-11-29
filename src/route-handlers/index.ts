import { createReminderRoute } from "./create-reminder";
import { deleteReminderRoute } from "./delete-reminder";
import { getActiveRemindersRoute } from "./get-active-reminders";
import { getAllRemindersRoute } from "./get-all-reminders";
import { getReminderByIdRoute } from "./get-reminder";
import { updateReminderRoute } from "./update-reminder";

export const routes = {
  getReminderByIdRoute,
  createReminderRoute,
  updateReminderRoute,
  deleteReminderRoute,
  getActiveRemindersRoute,
  getAllRemindersRoute,
};

export * from "./route-helpers";
