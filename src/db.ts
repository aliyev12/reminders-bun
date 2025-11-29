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

// try {
//   db.run("ALTER TABLE reminders ADD COLUMN last_alert_time TEXT");
//   console.log("Migration: Added column 'last_alert_time'.");
// } catch (e) {}

// try {
//   db.run("ALTER TABLE reminders ADD COLUMN is_active INTEGER DEFAULT 1");
//   console.log("Migration: Added column 'is_active'.");
// } catch (e) {}
