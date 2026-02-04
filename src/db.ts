import { Database } from "bun:sqlite";

export const db = new Database("reminders.db");

db.run(`
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    date TEXT,
    location TEXT,
    description TEXT,
    reminders TEXT,
    alerts TEXT,
    is_recurring BOOLEAN,
    recurrence TEXT,
    start_date TEXT,
    end_date TEXT,
    last_alert_time TEXT,
    is_active INTEGER DEFAULT 1
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// db.run(`
//   CREATE TABLE IF NOT EXISTS reminder_mode (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     mode TEXT NOT NULL,
//     address TEXT NOT NULL,
//     -- Ensure the combination of mode and address is unique
//     UNIQUE (mode, address)
//   )
// `);

// db.run(`
//   CREATE TABLE IF NOT EXISTS reminder_mode_link (
//     reminder_id INTEGER NOT NULL,
//     mode_id INTEGER NOT NULL,
//     PRIMARY KEY (reminder_id, mode_id),
//     FOREIGN KEY (reminder_id)
//       REFERENCES reminders (id)
//       ON DELETE CASCADE,
//     FOREIGN KEY (mode_id)
//       REFERENCES reminder_mode (id)
//       ON DELETE CASCADE
//   )
// `);
