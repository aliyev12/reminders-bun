import { getReminders } from "./route-helpers";

export const getActiveRemindersRoute = () =>
  getReminders().filter((r) => r.is_active);
