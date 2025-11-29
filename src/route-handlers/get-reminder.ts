import { type Context } from "elysia";
import { getReminderById } from "./route-helpers";

export const getReminderByIdRoute = ({ params: { id }, set }: Context) => {
  const r = getReminderById(Number(id));
  if (!r) {
    set.status = 404;
    return { error: "Reminder not found" };
  }
  return r;
};
