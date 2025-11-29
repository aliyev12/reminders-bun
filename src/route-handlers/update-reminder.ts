import { type Context } from "elysia";
import { db } from "../db";
import { getReminderById } from "./route-helpers";
import type { TCreateReminderInput } from "../schemas";

export const updateReminderRoute = ({ params: { id }, body, set }: Context) => {
  const r = body as TCreateReminderInput;
  const existing = getReminderById(Number(id));

  if (!existing) {
    set.status = 404;
    return { error: "Reminder not found" };
  }

  const stmt = db.prepare(`
      UPDATE reminders SET 
        title = $title, date = $date, location = $location, description = $description, 
        reminders = $reminders, alerts = $alerts, is_recurring = $is_recurring, 
        recurrence = $recurrence, start_date = $start_date, end_date = $end_date,
        is_active = $is_active
      WHERE id = $id
    `);

  const bindings = {
    $id: Number(id),
    $title: r.title,
    $date: r.date,
    $location: r.location ? JSON.stringify(r.location) : null,
    $description: r.description,
    $reminders: JSON.stringify(r.reminders ?? []),
    $alerts: JSON.stringify(r.alerts ?? []),
    $is_recurring: r.is_recurring ? 1 : 0,
    $recurrence: r.recurrence ?? null,
    $start_date: r.start_date ?? null,
    $end_date: r.end_date ?? null,
    $is_active: r.is_active === false ? 0 : 1,
  };

  try {
    stmt.run(bindings as any);
  } catch (dbError) {
    console.error("Database Update Error:", dbError);
    set.status = 500;
    return {
      error: "Failed to update reminder due to database error.",
      details: (dbError as Error).message,
    };
  }

  return { id, ...r };
};
