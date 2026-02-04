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

## Testing

**IMPORTANT: Tests must be run before committing any changes to ensure nothing is broken.**

**Run all tests:**
```bash
bun test
```

**Run tests in watch mode (during development):**
```bash
bun test --watch
```

**Run tests with coverage:**
```bash
bun test --coverage
```

**Run specific test file:**
```bash
bun test tests/integration/reminders.test.ts
```

### Test Organization

```
tests/
├── setup.ts              # Test setup, in-memory database
├── test-utils.ts         # Shared utilities and factories
├── integration/          # API endpoint tests
│   ├── reminders.test.ts # CRUD operations
│   ├── auth.test.ts      # Authentication tests
│   └── webhooks.test.ts  # Webhook handler tests
└── unit/                 # Unit tests
    ├── schemas.test.ts   # Zod validation
    ├── scheduler-helpers.test.ts
    └── repository.test.ts
```

### Testing Rules for Claude

1. **Always run tests after making code changes** - Before completing any task that modifies code, run `bun test` to ensure all tests pass
2. **Add tests for new functionality** - When adding new features or endpoints, add corresponding tests
3. **Fix broken tests immediately** - If tests fail after your changes, fix them before moving on
4. **Do not commit with failing tests** - All tests must pass before committing

## Architecture Overview

This is a **Bun-first TypeScript server** built with **Elysia.js** for managing reminder notifications. The architecture follows a clean, functional design with modular route handlers.

### Core Components

**Entry Point:** `index.ts`
- Initializes Elysia app with CORS, error handling, and API key authentication
- Starts background scheduler that runs `checkReminders()` every 3 seconds (configurable via `SCHEDULER_INTERVAL` env var)
- Defines REST API routes

**Database:** SQLite via `bun:sqlite`
- Single file database: `reminders.db`
- Schema defined in `src/db.ts`
- All queries are encapsulated in repositories (`src/repositories/`). Never import `db` directly outside of a repository implementation.

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

**Repository Pattern:**
- Every table has its own interface (`src/repositories/*-repository.interface.ts`) and SQLite implementation (`src/repositories/sqlite-*-repository.ts`).
- Concrete implementations are the **only** place that imports `db` from `src/db.ts`. All other code obtains a repository via the factory functions exported from `src/repositories/index.ts` (e.g. `getReminderRepository()`, `getAppSettingsRepository()`).
- Adding a new table means: (1) interface, (2) SQLite class, (3) factory in `index.ts`. Nothing else should touch the database directly.

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
- API Key is configured via `APP_API_KEY` environment variable

**API Documentation (Swagger/OpenAPI):**
- Automatic interactive API documentation generated with `@elysiajs/swagger`
- Available at `http://localhost:8080/swagger` (UI) and `http://localhost:8080/swagger/json` (OpenAPI spec)
- API key testing: You can paste your `APP_API_KEY` into the Swagger UI authorization button (lock icon) to test authenticated endpoints
- Includes detailed examples for all endpoints with realistic sample data
- **IMPORTANT:** When adding new routes or modifying existing endpoints, update the route details in `index.ts` (see swagger configuration section). Swagger must be kept in sync with API changes.

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
2. **No ORM, but use repositories** - Raw SQL lives only inside `src/repositories/sqlite-*.ts`. Every other file reaches the database through a repository factory (`getReminderRepository()`, `getAppSettingsRepository()`, etc.). Never import `db` outside a repository.
3. **Always transform DTOs** - Use `getReminders()` or `getReminderById()` to ensure proper type conversion from database
4. **Scheduler is independent** - Background reminder checking runs on its own interval, separate from HTTP requests
5. **Cron syntax for recurrence** - Standard cron expressions (e.g., `0 9 * * 1-5` for weekdays at 9am)
6. **UTC dates everywhere** - All dates stored and processed in UTC ISO format
7. **Type safety first** - TypeScript strict mode enabled, Zod provides runtime validation
8. **Modular handlers** - New routes should follow the pattern: create file in `route-handlers/`, export from `route-handlers/index.ts`, register in `index.ts`
9. **Keep Swagger in sync** - Whenever you add, remove, or modify API endpoints, update the corresponding route definition in `index.ts` (search for `.get`, `.post`, `.put`, `.delete` with the `detail:` property). Swagger documentation must stay current with actual API behavior. See the swagger configuration section at the top of `index.ts` for examples.
10. **Run tests before completing tasks** - After making any code changes, run `bun test` to ensure nothing is broken. Never leave a task incomplete with failing tests.

## Swagger/OpenAPI Integration

### Adding or Modifying Routes with Swagger Documentation

All routes in the Reminders API include Swagger documentation. When making changes:

1. **Adding a new route** - Add the route handler with a `detail` object containing:
   - `tags`: Array of tag names (e.g., `["Reminders"]`)
   - `summary`: Brief one-line description
   - `description`: Detailed explanation
   - `parameters`: Path/query parameters (if any)
   - `requestBody`: Body schema with example (if applicable)
   - `responses`: All possible response codes with examples

2. **Example route with full documentation:**
   ```typescript
   .post("/reminders", routes.createReminderRoute, {
     detail: {
       tags: ["Reminders"],
       summary: "Create a new reminder",
       description: "Creates a new reminder with support for alerts.",
       requestBody: { /* ... */ },
       responses: { /* ... */ },
     },
   })
   ```

3. **Testing the API** - Visit `http://localhost:8080/swagger` and:
   - Click the lock icon (top right) to authorize with your API key
   - Paste your `APP_API_KEY` value
   - Try out the endpoints directly from the Swagger UI

# Process Management Rules
- NEVER leave background services or servers running after a task is complete.
- If you start a dev server (e.g., `bun run dev`), ensure it is killed before finishing the task.
- Before starting a new server on a port (e.g., 8080), check if it is already in use using `lsof -i :8080`.
- If a port is blocked, kill the occupying process before proceeding.
- Use `trap 'kill %1' EXIT` in bash scripts to ensure children are cleaned up.
