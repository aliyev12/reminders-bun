import type { IReminderRepository } from "./reminder-repository.interface";
import { SQLiteReminderRepository } from "./sqlite-reminder-repository";
import type { IAppSettingsRepository } from "./app-settings-repository.interface";
import { SQLiteAppSettingsRepository } from "./sqlite-app-settings-repository";

let repository: IReminderRepository | null = null;
let appSettingsRepository: IAppSettingsRepository | null = null;

export function getReminderRepository(): IReminderRepository {
  if (!repository) {
    repository = new SQLiteReminderRepository();
  }
  return repository;
}

export function getAppSettingsRepository(): IAppSettingsRepository {
  if (!appSettingsRepository) {
    appSettingsRepository = new SQLiteAppSettingsRepository();
  }
  return appSettingsRepository;
}

export type { IReminderRepository };
export type { IAppSettingsRepository };
