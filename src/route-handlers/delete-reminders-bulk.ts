import { type Context } from "elysia";
import { db } from "../db";
import type { TDeleteRemindersBulkOutput } from "../schemas";

export const deleteRemindersBulkRoute = ({
  request,
  set,
}: Context): TDeleteRemindersBulkOutput => {
  try {
    const url = new URL(request.url);
    const idsParam = url.searchParams.get("ids");
    if (!idsParam) {
      throw new Error(
        "Delete reminders in bulk endpoint required 'ids' search param which is equal to comma separated list of reminder IDs to delete, e.g. '/bulk?ids=12,13,14'. No 'ids' search param has been passed.",
      );
    }

    const ids = idsParam
      .split(",")
      .map((idStr) => Number(idStr.trim()))
      .filter((n) => !Number.isNaN(n));

    // // This is an alternative way of deleting in bulk.
    // // leaving it commented out just in case if WHERE id IN starts giving hard time
    // const stmt = db.prepare("DELETE FROM reminders WHERE id = ?");
    // for (const id of ids){
    //   stmt.run(id);
    // }

    const placeholders = ids.map(() => "?").join(",");
    const sql = `DELETE FROM reminders WHERE id IN (${placeholders})`;
    const stmt = db.prepare(sql);
    stmt.run(...ids);

    return {
      status: "success",
    };
  } catch (error) {
    set.status = 500;
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      status: "fail",
      error: `Failed to delete reminders in bulk. Error: ${errorMessage}`,
    };
  }
};
