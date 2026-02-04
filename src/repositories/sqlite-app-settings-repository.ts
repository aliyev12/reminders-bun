import { db } from "../db";
import type { IAppSettingsRepository } from "./app-settings-repository.interface";

export class SQLiteAppSettingsRepository implements IAppSettingsRepository {
  get(key: string): string | null {
    const row = db
      .query("SELECT value FROM app_settings WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    db
      .prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)")
      .run(key, value);
  }
}
