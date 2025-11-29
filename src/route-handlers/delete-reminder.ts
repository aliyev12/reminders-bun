import { type Context } from "elysia";
import { db } from "../db";

export const deleteReminderRoute = ({ params: { id } }: Context) => {
  db.run("DELETE FROM reminders WHERE id = ?", [id]);
  return { message: "Deleted" };
};
