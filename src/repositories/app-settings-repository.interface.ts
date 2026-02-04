export interface IAppSettingsRepository {
  get(key: string): string | null;
  set(key: string, value: string): void;
}
