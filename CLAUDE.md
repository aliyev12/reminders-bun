# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Install dependencies:**
```bash
bun install
```

**Run the server:**
```bash
bun run index.ts
```

**Run with Docker:**
```bash
docker build -t reminders-server .
docker run -p 8080:8080 reminders-server
```

## Architecture Overview

This is a **Bun-first TypeScript server** built with **Elysia.js** for managing reminder notifications. The architecture follows a clean, functional design with modular route handlers.

### Core Components

**Entry Point:** `index.ts`
- Initializes Elysia app with CORS, error handling, and API key authentication
- Starts background scheduler that runs `checkReminders()` every 3 seconds (configurable via `SCHEDULER_INTERVAL` env var)
- Defines REST API routes

**Database:** SQLite via `bun:sqlite`
- Single file database: `reminders.db`
- No ORM - uses direct SQL with prepared statements
- Schema defined in `src/db.ts`

**Scheduler:** `src/check-reminders.ts`
- Background process that checks for due reminders
- Handles both one-time and recurring (cron-based) reminders
- Multi-alert support with offset-based triggering
- Auto-deactivates reminders based on rules (missed by >1hr, past end_date, one-time after alert)

**Route Handlers:** `src/route-handlers/`
- Each route in its own file following the pattern: `{action}-{resource}.ts`
- All handlers exported via `src/route-handlers/index.ts`
- Shared logic in `route-helpers.ts` (getReminders, getReminderById)

### Key Architectural Patterns

**DTO Transformation Pattern:**
- Database stores arrays/objects as JSON strings, booleans as integers (0/1)
- `route-helpers.ts` transforms database records to proper TypeScript types
- Always use `getReminders()` or `getReminderById()` for data retrieval to ensure proper transformation

**Validation Pattern:**
- Zod schemas in `src/schemas.ts` define all data structures and validation rules
- Two schema types: Regular schemas (with typed arrays/objects) and DTO schemas (JSON strings)
- Use `ReminderSchema` for application logic, `ReminderDTOSchema` for database operations

**Email Flexibility:**
- Supports SendGrid (production) or Mailtrap (development) via `MAIL_SERVICE` env var
- Email handlers in `src/email-handlers.ts`

**Authentication:**
- API key middleware checks `x-api-key` header for all routes
- Unprotected routes configurable in `src/constants.ts` (currently none)

### Data Model

**Reminders Table:**
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
title           TEXT
date            TEXT (ISO format: 2025-11-29T03:03:53Z)
location        TEXT (nullable)
description     TEXT
reminders       TEXT (JSON array: [{id, mode, address}])
alerts          TEXT (JSON array: [{id, time}])
is_recurring    BOOLEAN
recurrence      TEXT (cron expression, nullable)
start_date      TEXT (ISO format, nullable)
end_date        TEXT (ISO format, nullable)
last_alert_time TEXT (ISO format, nullable)
is_active       INTEGER (0 or 1)
```

**Alert System:**
- Alerts are offsets in milliseconds before the reminder date
- Minimum alert time: 3000ms
- Scheduler compares current time against `(reminder_date - alert_offset)`

**Recurring Reminders:**
- Uses cron expressions in `recurrence` field (via `cron-parser` library)
- Scheduler calculates next occurrence after each alert
- Deactivated when current time exceeds `end_date`

### Route Structure

| Method | Route | Handler | Purpose |
|--------|-------|---------|---------|
| GET | /reminders | get-active-reminders.ts | Active reminders only (is_active=1) |
| GET | /reminders/all | get-all-reminders.ts | All reminders |
| GET | /reminders/:id | get-reminder.ts | Single reminder by ID |
| POST | /reminders | create-reminder.ts | Create new reminder |
| PUT | /reminders/:id | update-reminder.ts | Update existing reminder |
| DELETE | /reminders/:id | delete-reminder.ts | Delete single reminder |
| DELETE | /reminders/bulk | delete-reminders-bulk.ts | Bulk delete via query params |

### Environment Variables

Required:
- `API_KEY` - Authentication key for API access
- `DEFAULT_EMAIL` - Default email address for reminders

Optional:
- `PORT` - Server port (default: 8080)
- `SCHEDULER_INTERVAL` - Reminder check interval in ms (default: 3000)
- `MAIL_SERVICE` - Email provider: "sendgrid" or "mailtrap"
- SendGrid: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
- Mailtrap: `MAILTRAP_HOST`, `MAILTRAP_PORT`, `MAILTRAP_USER`, `MAILTRAP_PASS`

## Important Implementation Notes

1. **This is Bun, not Node.js** - Use `bun run` commands, leverage Bun's native SQLite bindings
2. **No ORM** - Write SQL directly, use prepared statements for security
3. **Always transform DTOs** - Use `getReminders()` or `getReminderById()` to ensure proper type conversion from database
4. **Scheduler is independent** - Background reminder checking runs on its own interval, separate from HTTP requests
5. **Cron syntax for recurrence** - Standard cron expressions (e.g., `0 9 * * 1-5` for weekdays at 9am)
6. **UTC dates everywhere** - All dates stored and processed in UTC ISO format
7. **Type safety first** - TypeScript strict mode enabled, Zod provides runtime validation
8. **Modular handlers** - New routes should follow the pattern: create file in `route-handlers/`, export from `route-handlers/index.ts`, register in `index.ts`

# Process Management Rules
- NEVER leave background services or servers running after a task is complete.
- If you start a dev server (e.g., `bun run dev`), ensure it is killed before finishing the task.
- Before starting a new server on a port (e.g., 8080), check if it is already in use using `lsof -i :8080`.
- If a port is blocked, kill the occupying process before proceeding.
- Use `trap 'kill %1' EXIT` in bash scripts to ensure children are cleaned up.
