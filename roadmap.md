# Reminders Server - Improvement Roadmap

This document outlines a phased approach to deploying the reminders server **for free** on Render.com.

---

## Executive Summary

**Goal**: Deploy a working reminder app for free on Render.com for personal use (1-2 reminders/week).

**Key Strategy**: Replace `setInterval` polling with **Upstash QStash** - a free serverless scheduler that wakes up your sleeping Render server exactly when reminders are due.

**Why This Works**:
- Render free tier sleeps after 15 minutes → That's fine, we don't poll anymore
- QStash calls your webhook at the scheduled time → Wakes up Render
- Server sends notification → Goes back to sleep
- 1,000 free messages/day → You need ~2/week

---

## Architecture Comparison

### Before: Polling (Problematic for Free Tier)

```
┌─────────────────────────────────────────────┐
│  Render Server (needs to stay awake)        │
│  ┌────────────────────────────────────────┐ │
│  │  setInterval(checkReminders, 3000)     │ │
│  │  ↓                                     │ │
│  │  Query DB → Check times → Send emails  │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
Problem: Server sleeps after 15 min on free tier!
```

### After: Event-Driven with QStash (Works with Free Tier)

```
┌─────────────┐     1. Create reminder      ┌─────────────┐
│   Client    │ ─────────────────────────→  │   Render    │
└─────────────┘                             │   Server    │
                                            └──────┬──────┘
                                                   │ 2. Schedule callback
                                                   ↓
                                            ┌─────────────┐
                                            │   QStash    │
                                            │  (stores)   │
                                            └──────┬──────┘
                                                   │ 3. At reminder time,
                                                   │    call webhook
                                                   ↓
┌─────────────┐     4. Send notification    ┌─────────────┐
│    Email    │ ←─────────────────────────  │   Render    │
│   Service   │                             │  (woken up) │
└─────────────┘                             └─────────────┘

Server can sleep! QStash wakes it when needed.
```

---

## Phase 1: Refactor checkReminders() Function ✅ COMPLETE

**Status: DONE** - Clean, maintainable code with clear separation of concerns.

---

## Phase 2: QStash Integration (Replace setInterval) ✅ COMPLETE

**Priority: HIGH** | **Risk: LOW** | **Complexity: LOW**

### Why QStash?

| Feature | QStash Free Tier | Your Needs |
|---------|------------------|------------|
| Messages/day | 1,000 | ~2/week |
| Max delay | 7 days | Enough for most reminders |
| Active schedules | 10 | For recurring reminders |
| Max retries | 3 | Handles failures |
| Cost | **$0** | Perfect |

### Step 2.1: Create Upstash Account and Get Credentials

1. Go to [console.upstash.com](https://console.upstash.com)
2. Sign up (free)
3. Go to QStash tab
4. Copy your `QSTASH_TOKEN` and `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`

### Step 2.2: Install QStash SDK

```bash
bun add @upstash/qstash
```

### Step 2.3: Create QStash Client

**File:** `src/qstash/client.ts`

```typescript
import { Client } from "@upstash/qstash";

if (!process.env.QSTASH_TOKEN) {
  console.warn("QSTASH_TOKEN not set - QStash scheduling disabled");
}

export const qstash = process.env.QSTASH_TOKEN
  ? new Client({ token: process.env.QSTASH_TOKEN })
  : null;

/**
 * Get the base URL for webhook callbacks.
 * In production, this is your Render URL.
 * In development, you'll need a tunnel (ngrok, localtunnel, etc.)
 */
export function getWebhookBaseUrl(): string {
  if (process.env.WEBHOOK_BASE_URL) {
    return process.env.WEBHOOK_BASE_URL;
  }

  // Default for local development
  return `http://localhost:${process.env.PORT || 8080}`;
}
```

### Step 2.4: Create Webhook Signature Verification

**File:** `src/qstash/verify.ts`

```typescript
import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
});

/**
 * Verify that a webhook request came from QStash.
 * Returns true if valid, false if invalid or verification disabled.
 */
export async function verifyQStashSignature(
  signature: string | null,
  body: string
): Promise<boolean> {
  // Skip verification in development or if keys not set
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  if (!signature || !process.env.QSTASH_CURRENT_SIGNING_KEY) {
    console.warn("QStash signature verification skipped - keys not configured");
    return true;
  }

  try {
    await receiver.verify({ signature, body });
    return true;
  } catch (error) {
    console.error("QStash signature verification failed:", error);
    return false;
  }
}
```

### Step 2.5: Create Scheduler Service

**File:** `src/qstash/scheduler.ts`

```typescript
import { qstash, getWebhookBaseUrl } from "./client";

interface ScheduleReminderOptions {
  reminderId: number;
  alertTime: Date; // When to trigger the alert
  title: string; // For logging
}

interface ScheduleResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Schedule a reminder alert using QStash.
 * QStash will call our webhook at the specified time.
 */
export async function scheduleReminderAlert(
  options: ScheduleReminderOptions
): Promise<ScheduleResult> {
  const { reminderId, alertTime, title } = options;

  if (!qstash) {
    console.log(`[DEV] Would schedule reminder ${reminderId} for ${alertTime.toISOString()}`);
    return { success: true, messageId: "dev-mode" };
  }

  const webhookUrl = `${getWebhookBaseUrl()}/webhooks/reminder-alert`;
  const delaySeconds = Math.max(0, Math.floor((alertTime.getTime() - Date.now()) / 1000));

  // If the alert time is in the past or very soon, trigger immediately
  if (delaySeconds <= 0) {
    console.log(`Alert time for '${title}' is now or past, triggering immediately`);
  }

  try {
    const response = await qstash.publishJSON({
      url: webhookUrl,
      body: { reminderId, alertTime: alertTime.toISOString() },
      delay: delaySeconds > 0 ? delaySeconds : undefined,
      retries: 3,
    });

    console.log(`Scheduled alert for '${title}' at ${alertTime.toISOString()} (in ${delaySeconds}s)`);

    return { success: true, messageId: response.messageId };
  } catch (error) {
    console.error(`Failed to schedule alert for '${title}':`, error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Schedule a recurring reminder using QStash cron schedules.
 * Used for reminders with cron expressions.
 */
export async function scheduleRecurringReminder(
  reminderId: number,
  cronExpression: string
): Promise<ScheduleResult> {
  if (!qstash) {
    console.log(`[DEV] Would schedule recurring reminder ${reminderId} with cron: ${cronExpression}`);
    return { success: true, messageId: "dev-mode" };
  }

  const webhookUrl = `${getWebhookBaseUrl()}/webhooks/reminder-alert`;

  try {
    const response = await qstash.schedules.create({
      destination: webhookUrl,
      cron: cronExpression,
      body: JSON.stringify({ reminderId, isRecurring: true }),
      retries: 3,
    });

    console.log(`Created recurring schedule for reminder ${reminderId}: ${cronExpression}`);

    return { success: true, messageId: response.scheduleId };
  } catch (error) {
    console.error(`Failed to create recurring schedule for ${reminderId}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Cancel a scheduled message or recurring schedule.
 */
export async function cancelScheduledReminder(
  messageId: string
): Promise<boolean> {
  if (!qstash) {
    console.log(`[DEV] Would cancel scheduled message: ${messageId}`);
    return true;
  }

  try {
    // Try to cancel as a message first
    await qstash.messages.delete(messageId);
    return true;
  } catch {
    try {
      // If that fails, try as a schedule
      await qstash.schedules.delete(messageId);
      return true;
    } catch (error) {
      console.error(`Failed to cancel scheduled reminder ${messageId}:`, error);
      return false;
    }
  }
}
```

### Step 2.6: Create Webhook Endpoint

**File:** `src/route-handlers/webhook-reminder-alert.ts`

```typescript
import type { Context } from "elysia";
import { verifyQStashSignature } from "../qstash/verify";
import { getReminderById } from "./route-helpers";
import { sendNotifications } from "../scheduler/notification-service";
import { deactivateReminder, updateLastAlertTime } from "../utils";

interface WebhookPayload {
  reminderId: number;
  alertTime?: string;
  isRecurring?: boolean;
}

export const webhookReminderAlertRoute = async ({ request, body, set }: Context) => {
  // Verify the request came from QStash
  const signature = request.headers.get("upstash-signature");
  const rawBody = JSON.stringify(body);

  const isValid = await verifyQStashSignature(signature, rawBody);
  if (!isValid) {
    set.status = 401;
    return { error: "Invalid signature" };
  }

  const payload = body as WebhookPayload;
  const { reminderId, isRecurring } = payload;

  console.log(`Webhook received for reminder ${reminderId}`);

  // Get the reminder
  const reminder = getReminderById(reminderId);

  if (!reminder) {
    console.log(`Reminder ${reminderId} not found - may have been deleted`);
    return { status: "skipped", reason: "reminder_not_found" };
  }

  if (!reminder.is_active) {
    console.log(`Reminder ${reminderId} is inactive - skipping`);
    return { status: "skipped", reason: "inactive" };
  }

  // Send notifications
  console.log(`Sending notifications for '${reminder.title}'`);
  await sendNotifications(reminder, reminder.reminders);

  // Update last alert time
  updateLastAlertTime(reminder.id!, new Date());

  // Deactivate one-time reminders after sending
  if (!isRecurring && !reminder.is_recurring) {
    deactivateReminder(reminder.id!, reminder.title);
    console.log(`One-time reminder '${reminder.title}' deactivated`);
  }

  return { status: "ok", reminderTitle: reminder.title };
};
```

### Step 2.7: Update Create Reminder to Schedule with QStash

**File:** `src/route-handlers/create-reminder.ts` (update)

Add QStash scheduling after creating the reminder:

```typescript
import { scheduleReminderAlert, scheduleRecurringReminder } from "../qstash/scheduler";

// After successfully inserting the reminder, schedule the alerts:

// For recurring reminders
if (r.is_recurring && r.recurrence) {
  await scheduleRecurringReminder(insertedId, r.recurrence);
}

// For one-time reminders or first alert of recurring
if (r.alerts && r.alerts.length > 0) {
  const reminderDate = new Date(r.date);

  for (const alert of r.alerts) {
    const alertTime = new Date(reminderDate.getTime() - alert.time);

    // Only schedule if alert time is in the future
    if (alertTime > new Date()) {
      await scheduleReminderAlert({
        reminderId: insertedId,
        alertTime,
        title: r.title,
      });
    }
  }
}
```

### Step 2.8: Register Webhook Route

**File:** `index.ts` (update)

```typescript
import { webhookReminderAlertRoute } from "./src/route-handlers/webhook-reminder-alert";

// Add webhook route (no auth required - QStash signature verification handles security)
.post("/webhooks/reminder-alert", webhookReminderAlertRoute)
```

### Step 2.9: Update Environment Variables

**File:** `.env.example` (add)

```bash
# QStash (Upstash) - For scheduling reminders
# Get these from console.upstash.com -> QStash
QSTASH_TOKEN=your-qstash-token
QSTASH_CURRENT_SIGNING_KEY=your-current-signing-key
QSTASH_NEXT_SIGNING_KEY=your-next-signing-key

# Webhook URL (your Render.com URL in production)
# Not needed locally if using dev mode
WEBHOOK_BASE_URL=https://your-app.onrender.com
```

### Step 2.10: Remove setInterval (Production) / Keep for Dev

**File:** `index.ts` (update)

```typescript
import { checkReminders } from "./src/check-reminders";

const SCHEDULER_INTERVAL = Number(process.env.SCHEDULER_INTERVAL) || 3000;
const USE_POLLING = process.env.USE_POLLING === "true";

// Only use polling in development when QStash isn't configured
if (USE_POLLING || !process.env.QSTASH_TOKEN) {
  setInterval(checkReminders, SCHEDULER_INTERVAL);
  console.log(`Polling scheduler started (interval: ${SCHEDULER_INTERVAL}ms)`);
  console.log("Note: In production, use QStash instead of polling");
} else {
  console.log("QStash scheduler active - polling disabled");
}
```

### Step 2.11: Local Development with QStash (Optional)

For testing QStash locally, you need a public URL. Options:

**Option A: Use polling locally (recommended for simplicity)**
```bash
USE_POLLING=true bun run index.ts
```

**Option B: Use localtunnel for QStash testing**
```bash
# Terminal 1: Start your server
bun run index.ts

# Terminal 2: Create tunnel
npx localtunnel --port 8080

# Set WEBHOOK_BASE_URL to the tunnel URL
```

### Testing Phase 2

1. Create Upstash account and get QStash credentials
2. Set environment variables
3. Create a reminder with an alert 1 minute in the future
4. Check QStash dashboard - should see scheduled message
5. Wait for the callback - should receive notification
6. Check that one-time reminder is deactivated

---

## Phase 3: Repository Pattern (Simplified)

**Priority: MEDIUM** | **Risk: LOW** | **Complexity: LOW**

### Goal
Decouple database operations for future flexibility (PostgreSQL, etc.).

### Step 3.1: Create Repository Interface

**File:** `src/repositories/reminder-repository.interface.ts`

```typescript
import type { TReminder, TCreateReminderInput } from "../schemas";

export interface IReminderRepository {
  findAll(): TReminder[];
  findActive(): TReminder[];
  findById(id: number): TReminder | null;
  create(data: TCreateReminderInput): { id: number };
  update(id: number, data: Partial<TCreateReminderInput>): boolean;
  delete(id: number): boolean;
  deleteBulk(ids: number[]): number;
  deactivate(id: number): boolean;
  updateLastAlertTime(id: number, time: Date): boolean;
}
```

### Step 3.2: Create SQLite Implementation

**File:** `src/repositories/sqlite-reminder-repository.ts`

```typescript
import { db } from "../db";
import type { IReminderRepository } from "./reminder-repository.interface";
import type { TReminder, TReminderDTO, TCreateReminderInput } from "../schemas";

export class SQLiteReminderRepository implements IReminderRepository {

  private transformRow(row: TReminderDTO): TReminder {
    return {
      ...row,
      location: row.location ? JSON.parse(row.location) : null,
      reminders: row.reminders ? JSON.parse(row.reminders) : [],
      alerts: row.alerts ? JSON.parse(row.alerts) : [],
      is_recurring: !!row.is_recurring,
      is_active: !!row.is_active,
    };
  }

  findAll(): TReminder[] {
    const results = db.query("SELECT * FROM reminders").all() as TReminderDTO[];
    return results.map(this.transformRow);
  }

  findActive(): TReminder[] {
    const results = db
      .query("SELECT * FROM reminders WHERE is_active = 1")
      .all() as TReminderDTO[];
    return results.map(this.transformRow);
  }

  findById(id: number): TReminder | null {
    const row = db
      .query("SELECT * FROM reminders WHERE id = $id")
      .get({ $id: id }) as TReminderDTO | null;
    return row ? this.transformRow(row) : null;
  }

  create(data: TCreateReminderInput): { id: number } {
    const stmt = db.prepare(`
      INSERT INTO reminders (
        title, date, location, description, reminders, alerts,
        is_recurring, recurrence, start_date, end_date, is_active
      ) VALUES (
        $title, $date, $location, $description, $reminders, $alerts,
        $is_recurring, $recurrence, $start_date, $end_date, $is_active
      )
    `);

    stmt.run({
      $title: data.title,
      $date: data.date,
      $location: data.location ? JSON.stringify(data.location) : null,
      $description: data.description,
      $reminders: JSON.stringify(data.reminders ?? []),
      $alerts: JSON.stringify(data.alerts ?? []),
      $is_recurring: data.is_recurring ? 1 : 0,
      $recurrence: data.recurrence ?? null,
      $start_date: data.start_date ?? null,
      $end_date: data.end_date ?? null,
      $is_active: data.is_active !== false ? 1 : 0,
    });

    const result = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
    return { id: result.id };
  }

  update(id: number, data: Partial<TCreateReminderInput>): boolean {
    const fields: string[] = [];
    const values: Record<string, unknown> = { $id: id };

    if (data.title !== undefined) {
      fields.push("title = $title");
      values.$title = data.title;
    }
    if (data.date !== undefined) {
      fields.push("date = $date");
      values.$date = data.date;
    }
    if (data.location !== undefined) {
      fields.push("location = $location");
      values.$location = JSON.stringify(data.location);
    }
    if (data.description !== undefined) {
      fields.push("description = $description");
      values.$description = data.description;
    }
    if (data.reminders !== undefined) {
      fields.push("reminders = $reminders");
      values.$reminders = JSON.stringify(data.reminders);
    }
    if (data.alerts !== undefined) {
      fields.push("alerts = $alerts");
      values.$alerts = JSON.stringify(data.alerts);
    }
    if (data.is_recurring !== undefined) {
      fields.push("is_recurring = $is_recurring");
      values.$is_recurring = data.is_recurring ? 1 : 0;
    }
    if (data.recurrence !== undefined) {
      fields.push("recurrence = $recurrence");
      values.$recurrence = data.recurrence;
    }
    if (data.start_date !== undefined) {
      fields.push("start_date = $start_date");
      values.$start_date = data.start_date;
    }
    if (data.end_date !== undefined) {
      fields.push("end_date = $end_date");
      values.$end_date = data.end_date;
    }
    if (data.is_active !== undefined) {
      fields.push("is_active = $is_active");
      values.$is_active = data.is_active ? 1 : 0;
    }

    if (fields.length === 0) return false;

    const sql = `UPDATE reminders SET ${fields.join(", ")} WHERE id = $id`;
    const result = db.run(sql, values);
    return result.changes > 0;
  }

  delete(id: number): boolean {
    const result = db.run("DELETE FROM reminders WHERE id = ?", [id]);
    return result.changes > 0;
  }

  deleteBulk(ids: number[]): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => "?").join(",");
    const result = db.run(`DELETE FROM reminders WHERE id IN (${placeholders})`, ids);
    return result.changes;
  }

  deactivate(id: number): boolean {
    const result = db.run("UPDATE reminders SET is_active = 0 WHERE id = ?", [id]);
    return result.changes > 0;
  }

  updateLastAlertTime(id: number, time: Date): boolean {
    const result = db.run(
      "UPDATE reminders SET last_alert_time = ? WHERE id = ?",
      [time.toISOString(), id]
    );
    return result.changes > 0;
  }
}
```

### Step 3.3: Create Repository Factory

**File:** `src/repositories/index.ts`

```typescript
import type { IReminderRepository } from "./reminder-repository.interface";
import { SQLiteReminderRepository } from "./sqlite-reminder-repository";

let repository: IReminderRepository | null = null;

export function getReminderRepository(): IReminderRepository {
  if (!repository) {
    repository = new SQLiteReminderRepository();
  }
  return repository;
}

export type { IReminderRepository };
```

### Step 3.4: Update All Route Handlers

Replace direct DB calls with repository calls. Example:

```typescript
// Before
import { db } from "../db";
const results = db.query("SELECT * FROM reminders").all();

// After
import { getReminderRepository } from "../repositories";
const repo = getReminderRepository();
const results = repo.findAll();
```

### Step 3.5: App Settings Repository

A second repository was added for the `app_settings` key/value table, following the same three-file pattern as the reminder repository. It stores internal state that needs to survive server restarts (e.g. the QStash cleanup schedule ID).

- **Interface:** `src/repositories/app-settings-repository.interface.ts` — `get(key): string | null`, `set(key, value): void`
- **Implementation:** `src/repositories/sqlite-app-settings-repository.ts`
- **Factory:** `getAppSettingsRepository()` exported from `src/repositories/index.ts`

### Repository Pattern Rule

> **All database reads and writes must go through a repository.** Never import `db` from `src/db.ts` outside of a repository implementation class. This keeps the SQLite dependency contained so the backing store can be swapped (e.g. to PostgreSQL) without touching business logic.
>
> Adding a new table requires exactly three things: an interface file, an SQLite implementation class, and a factory function in `src/repositories/index.ts`.

---

## Phase 4: Authentication with Better Auth

**Priority: HIGH** | **Risk: MEDIUM** | **Complexity: MEDIUM**

### Goal
Secure the API with proper session-based authentication. No credentials exposed in browser network tab.

### Why Better Auth?

| Feature | API Key | Better Auth |
|---------|---------|-------------|
| Visible in browser DevTools | **Yes** (insecure) | No (cookies are httpOnly) |
| Session management | Manual | Built-in |
| Password hashing | N/A | Built-in (bcrypt) |
| Future multi-user support | Difficult | Easy |
| CSRF protection | None | Built-in |

### Step 4.1: Install Better Auth

```bash
bun add better-auth
```

### Step 4.2: Create Auth Configuration

**File:** `src/auth/index.ts`

```typescript
import { betterAuth } from "better-auth";
import Database from "bun:sqlite";

// Use the same database as reminders
const DB_PATH = process.env.DATABASE_PATH || "reminders.db";

export const auth = betterAuth({
  database: new Database(DB_PATH),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Keep simple for personal use
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  trustedOrigins: [
    process.env.CORS_ORIGIN || "http://localhost:3000",
  ],
});

// Export type for client
export type Auth = typeof auth;
```

### Step 4.3: Create Auth Handler for Elysia

**File:** `src/auth/handler.ts`

```typescript
import { auth } from "./index";

/**
 * Handle all /api/auth/* requests
 * Better Auth handles routing internally
 */
export async function handleAuthRequest(request: Request): Promise<Response> {
  return auth.handler(request);
}
```

### Step 4.4: Create Auth Middleware

**File:** `src/auth/middleware.ts`

```typescript
import type { Context } from "elysia";
import { auth } from "./index";

/**
 * Middleware to require authentication.
 * Returns user info if authenticated, 401 if not.
 */
export async function requireAuth({ request, set }: Context) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    set.status = 401;
    return { error: "Unauthorized - Please sign in" };
  }

  // Attach user to request for later use
  return { user: session.user };
}

/**
 * Get current user (optional - doesn't require auth)
 */
export async function getCurrentUser(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  return session?.user || null;
}
```

### Step 4.5: Create Admin Seeding Script

Since registration is disabled by default, create your admin account via script:

**File:** `scripts/create-admin.ts`

```typescript
import { auth } from "../src/auth";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables required");
  console.error("Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret bun run scripts/create-admin.ts");
  process.exit(1);
}

async function createAdmin() {
  try {
    const result = await auth.api.signUpEmail({
      body: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        name: ADMIN_NAME,
      },
    });

    console.log("✅ Admin account created successfully!");
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Name: ${ADMIN_NAME}`);
    console.log("\nYou can now sign in at your app's login page.");
  } catch (error: any) {
    if (error.message?.includes("already exists")) {
      console.log("ℹ️  Admin account already exists");
    } else {
      console.error("❌ Error creating admin:", error.message || error);
      process.exit(1);
    }
  }
}

createAdmin();
```

### Step 4.6: Update index.ts with Auth Routes

**File:** `index.ts` (updated)

```typescript
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { handleAuthRequest } from "./src/auth/handler";
import { requireAuth } from "./src/auth/middleware";
import { routes } from "./src/route-handlers";
import { webhookReminderAlertRoute } from "./src/route-handlers/webhook-reminder-alert";
import { scheduler } from "./src/scheduler/scheduler-service";

const PORT = process.env.PORT || 8080;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

const app = new Elysia()
  .use(
    cors({
      origin: CORS_ORIGIN,
      allowedHeaders: ["Content-Type", "Cookie"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true, // Important for cookies!
    })
  )
  .onError(({ error, set }) => {
    console.error(error);
    set.status = 500;
    return { error: "Internal Server Error" };
  })

  // ============ PUBLIC ROUTES ============

  // Health check (for Render)
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))

  // Better Auth handles all /api/auth/* routes
  .all("/api/auth/*", ({ request }) => handleAuthRequest(request))

  // QStash webhook (secured by signature verification)
  .post("/webhooks/reminder-alert", webhookReminderAlertRoute)

  // ============ PROTECTED ROUTES ============

  // All /reminders routes require authentication
  .group("/reminders", (app) =>
    app
      .onBeforeHandle(requireAuth)
      .get("/", routes.getActiveRemindersRoute)
      .get("/all", routes.getAllRemindersRoute)
      .get("/:id", routes.getReminderByIdRoute)
      .post("/", routes.createReminderRoute)
      .put("/:id", routes.updateReminderRoute)
      .delete("/:id", routes.deleteReminderRoute)
      .delete("/bulk", routes.deleteRemindersBulkRoute)
  )

  .listen(PORT);

console.log(`Server running at http://localhost:${PORT}`);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down...");
  process.exit(0);
});
```

### Step 4.7: Update CORS Origin in Environment

**File:** `.env.example` (update)

```bash
# CORS - Your frontend URL
# Local development
CORS_ORIGIN=http://localhost:3000
# Production (update with your actual frontend URL)
# CORS_ORIGIN=https://your-frontend.vercel.app
```

### Step 4.8: Frontend Auth Integration

In your React/frontend app, use Better Auth's client:

```bash
# In your frontend project
bun add better-auth
```

**File:** (frontend) `src/lib/auth-client.ts`

```typescript
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
});

// Helper functions
export const signIn = authClient.signIn.email;
export const signUp = authClient.signUp.email;
export const signOut = authClient.signOut;
export const getSession = authClient.getSession;
```

**Example login page:**

```typescript
import { signIn } from "@/lib/auth-client";

async function handleLogin(email: string, password: string) {
  const result = await signIn({
    email,
    password,
  });

  if (result.error) {
    alert(result.error.message);
  } else {
    // Redirect to dashboard
    window.location.href = "/dashboard";
  }
}
```

**Making authenticated API calls:**

```typescript
// Cookies are automatically sent with credentials: "include"
const response = await fetch("https://your-api.onrender.com/reminders", {
  credentials: "include", // This sends the session cookie
});
```

### Step 4.9: Disable Public Registration (Security)

For personal use, you don't want random people creating accounts. Better Auth doesn't have a built-in "disable registration" flag, so we handle it at the route level:

**File:** `src/auth/index.ts` (update)

```typescript
import { betterAuth } from "better-auth";
import Database from "bun:sqlite";

const DB_PATH = process.env.DATABASE_PATH || "reminders.db";
const ALLOW_REGISTRATION = process.env.ALLOW_REGISTRATION === "true";

export const auth = betterAuth({
  database: new Database(DB_PATH),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    // Block sign-ups unless explicitly allowed
    async onSignUp({ email }) {
      if (!ALLOW_REGISTRATION) {
        throw new Error("Registration is disabled. Contact admin.");
      }
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  trustedOrigins: [
    process.env.CORS_ORIGIN || "http://localhost:3000",
  ],
});
```

**To create new users:**
1. Temporarily set `ALLOW_REGISTRATION=true`
2. Or use the `scripts/create-admin.ts` script directly

### Step 4.10: Environment Variables Update

Add to `.env.example`:

```bash
# Auth
ALLOW_REGISTRATION=false  # Set to true temporarily to create new accounts

# For create-admin script
ADMIN_EMAIL=your-email@example.com
ADMIN_PASSWORD=your-secure-password
ADMIN_NAME=Your Name
```

### Step 4.11: Database Schema (Auto-created)

Better Auth automatically creates these tables on first run:
- `user` - User accounts
- `session` - Active sessions
- `account` - OAuth accounts (not used for email/password)

No manual migration needed!

### Testing Phase 4

1. **Start server:**
   ```bash
   bun run index.ts
   ```

2. **Create admin account:**
   ```bash
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret123 bun run scripts/create-admin.ts
   ```

3. **Test sign in (via curl or frontend):**
   ```bash
   curl -X POST http://localhost:8080/api/auth/sign-in/email \
     -H "Content-Type: application/json" \
     -d '{"email": "you@example.com", "password": "secret123"}' \
     -c cookies.txt

   # Use the session cookie
   curl http://localhost:8080/reminders \
     -b cookies.txt
   ```

4. **Test unauthorized access:**
   ```bash
   curl http://localhost:8080/reminders
   # Should return 401 Unauthorized
   ```

### Security Checklist

- [x] Passwords hashed with bcrypt (Better Auth default)
- [x] Session stored in httpOnly cookie (not accessible via JavaScript)
- [x] CORS restricted to your frontend domain
- [x] Registration disabled by default
- [x] QStash webhook secured by signature verification
- [x] No credentials exposed in browser network tab

---

## Phase 5: Dockerization and Render Deployment

**Priority: HIGH** | **Risk: LOW** | **Complexity: LOW**

### Step 5.1: Create Dockerfile

**File:** `Dockerfile`

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Final image
FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["bun", "run", "index.ts"]
```

### Step 5.2: Create .dockerignore

**File:** `.dockerignore`

```
node_modules
.git
.gitignore
*.md
.env
.env.*
reminders.db
reminders.db-*
*.log
.DS_Store
```

### Step 5.3: Update Database Path for Persistence

**File:** `src/db.ts` (update)

```typescript
import { Database } from "bun:sqlite";

const DB_PATH = process.env.DATABASE_PATH || "reminders.db";
export const db = new Database(DB_PATH);

// ... rest of schema creation
```

### Step 5.4: Add Health Check

**File:** `index.ts` (update)

```typescript
.get("/health", () => ({
  status: "ok",
  timestamp: new Date().toISOString(),
}))
```

### Step 5.5: Create render.yaml

**File:** `render.yaml`

```yaml
services:
  - type: web
    name: reminders-server
    runtime: docker
    plan: free
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 8080
      # Auth
      - key: CORS_ORIGIN
        sync: false  # Your frontend URL
      - key: ALLOW_REGISTRATION
        value: "false"
      # QStash
      - key: QSTASH_TOKEN
        sync: false
      - key: QSTASH_CURRENT_SIGNING_KEY
        sync: false
      - key: QSTASH_NEXT_SIGNING_KEY
        sync: false
      - key: WEBHOOK_BASE_URL
        sync: false
      # Database
      - key: DATABASE_PATH
        value: /app/data/reminders.db
      # Email
      - key: SENDGRID_API_KEY
        sync: false
      - key: SENDGRID_FROM_EMAIL
        sync: false
      - key: MAIL_SERVICE
        value: sendgrid
    disk:
      name: reminders-data
      mountPath: /app/data
      sizeGB: 1
```

### Step 5.6: Create .env.example

**File:** `.env.example`

```bash
# Server
NODE_ENV=development
PORT=8080

# Auth (Better Auth)
CORS_ORIGIN=http://localhost:3000  # Your frontend URL
ALLOW_REGISTRATION=false  # Set true temporarily to create accounts

# Admin account (for create-admin script)
ADMIN_EMAIL=your-email@example.com
ADMIN_PASSWORD=your-secure-password
ADMIN_NAME=Your Name

# QStash (Upstash) - Free scheduler
# Get from: console.upstash.com -> QStash
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# Webhook URL (your Render URL in production)
WEBHOOK_BASE_URL=https://your-app.onrender.com

# Database (for Docker/Render)
DATABASE_PATH=./reminders.db

# Email - SendGrid (100 free emails/day)
MAIL_SERVICE=sendgrid
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=

# Development only - use polling instead of QStash
USE_POLLING=true
```

### Step 5.7: Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

2. **Create Render Account**
   - Go to [render.com](https://render.com)
   - Sign up (free)

3. **Create New Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select "Docker" as runtime
   - Select "Free" plan

4. **Add Disk (Important for SQLite!)**
   - Go to service settings → "Disks"
   - Add disk: name=`reminders-data`, mount=`/app/data`, size=1GB

5. **Set Environment Variables**
   - `NODE_ENV` = production
   - `PORT` = 8080
   - `CORS_ORIGIN` = your frontend URL
   - `ALLOW_REGISTRATION` = false
   - `DATABASE_PATH` = /app/data/reminders.db
   - `WEBHOOK_BASE_URL` = https://your-app.onrender.com
   - `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` from Upstash
   - `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` for emails

6. **Deploy**
   - Render will build and deploy automatically
   - Wait for "Live" status

7. **Create Admin Account**
   You have two options:

   **Option A: Via Render Shell**
   - Go to your service → "Shell"
   - Run: `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret123 bun run scripts/create-admin.ts`

   **Option B: Temporarily Enable Registration**
   - Set `ALLOW_REGISTRATION=true` in env vars
   - Sign up via your frontend
   - Set `ALLOW_REGISTRATION=false` again

8. **Test**
   ```bash
   # Health check
   curl https://your-app.onrender.com/health

   # Sign in (get session cookie)
   curl -X POST https://your-app.onrender.com/api/auth/sign-in/email \
     -H "Content-Type: application/json" \
     -d '{"email": "you@example.com", "password": "secret123"}' \
     -c cookies.txt

   # Create reminder (with session cookie)
   curl -X POST https://your-app.onrender.com/reminders \
     -H "Content-Type: application/json" \
     -b cookies.txt \
     -d '{"title": "Test", "date": "2025-01-15T10:00:00Z", "description": "Test reminder", "alerts": [{"id": "1", "time": 60000}]}'
   ```

---

## Phase 6: Code Quality (Optional)

**Priority: LOW** | **Risk: LOW** | **Complexity: LOW**

### Step 6.1: Add Structured Logging

**File:** `src/logger.ts`

```typescript
type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL = (process.env.LOG_LEVEL || "info") as LogLevel;
const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (LEVELS[level] < LEVELS[LOG_LEVEL]) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  console.log(JSON.stringify(entry));
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
};
```

### Step 6.2: Remove Dead Code

- Remove commented-out code in `index.ts`
- Remove unused imports

---

## Implementation Order

| Order | Phase | Effort | Notes |
|-------|-------|--------|-------|
| 1 | Phase 1 (checkReminders refactor) | - | ✅ COMPLETE |
| 2 | Phase 4 (Better Auth) | 2-3 hours | Security first - protect your data |
| 3 | Phase 2 (QStash Integration) | 2-3 hours | Replace polling with events |
| 4 | Phase 5 (Dockerization) | 1-2 hours | Deploy to Render |
| 5 | Phase 3 (Repository Pattern) | 2-3 hours | Nice to have, do later |
| 6 | Phase 6 (Code Quality) | 1 hour | Optional cleanup |

---

## Quick Start (Minimum Viable Deployment)

Recommended order for a secure deployment:

1. **Implement Better Auth** (Phase 4) - 2-3 hours
   - Install better-auth
   - Create auth config, handler, middleware
   - Create admin account script
   - Update index.ts with auth routes

2. **Set up QStash** (Phase 2) - 2-3 hours
   - Create Upstash account
   - Implement scheduler and webhook endpoint
   - Update create-reminder to schedule alerts

3. **Dockerize and Deploy** (Phase 5) - 1-2 hours
   - Create Dockerfile and render.yaml
   - Push to GitHub → Connect to Render
   - Add disk for SQLite persistence
   - Set environment variables
   - Create admin account on production

**Total: ~6-8 hours to fully secured app on Render for FREE**

---

## Free Tier Limitations to Know

| Service | Free Tier | Your Usage |
|---------|-----------|------------|
| **Render** | 750 hours/month, sleeps after 15 min | Fine with QStash |
| **Upstash QStash** | 1,000 messages/day | ~2/week |
| **SendGrid** | 100 emails/day | ~2/week |
| **Render Disk** | 1GB included | Plenty |

**Total Monthly Cost: $0**

---

---

## Phase 7: API Documentation with Swagger/OpenAPI ✅ COMPLETE

**Priority: MEDIUM** | **Risk: LOW** | **Complexity: LOW**

### Goal

Provide interactive API documentation that developers and testing tools can use without manual curl commands.

### What Was Implemented

1. **Swagger Plugin Integration**
   - Installed `@elysiajs/swagger` package
   - Configured OpenAPI 3.0.3 specification
   - Added API key authentication scheme for Swagger UI

2. **Comprehensive Route Documentation**
   - All 8 API endpoints fully documented with:
     - Clear summaries and descriptions
     - Request/response examples with realistic data
     - Parameter documentation
     - Error response codes
   - Routes tagged by category (Reminders, Webhooks)

3. **API Key Support in Swagger UI**
   - Swagger security scheme configured for `x-api-key` header
   - Users can authorize in Swagger UI by:
     - Clicking lock icon (top right)
     - Entering their `APP_API_KEY` value
     - Testing authenticated endpoints directly

4. **Access Points**
   - **Interactive UI**: `http://localhost:8080/swagger`
   - **OpenAPI JSON**: `http://localhost:8080/swagger/json`
   - **Downloadable spec**: For use with API client generators

### Files Modified

- `index.ts` - Added Swagger configuration with security scheme and comprehensive route documentation
- `CLAUDE.md` - Added Swagger integration section and notes about keeping documentation in sync
- `package.json` - Added `@elysiajs/swagger@1.3.1` dependency

### Important Notes for Future Development

**Critical: Keep Swagger in Sync with API Changes**

Whenever you modify the API (add, remove, or change routes):

1. Update the route handler in `index.ts` with the `detail` property
2. Include:
   - `tags`: ["Reminders"] or ["Webhooks"]
   - `summary`: One-line description
   - `description`: Detailed explanation
   - `parameters`: For path/query parameters
   - `requestBody`: With realistic example (for POST/PUT)
   - `responses`: All possible HTTP status codes with examples

3. Test by visiting `http://localhost:8080/swagger` to verify the changes appear

Example structure:
```typescript
.post("/reminders", routes.createReminderRoute, {
  detail: {
    tags: ["Reminders"],
    summary: "Create a new reminder",
    description: "Creates a new reminder...",
    requestBody: { /* ... */ },
    responses: { /* ... */ },
  },
})
```

### Benefits

✅ Interactive API testing without curl/Postman
✅ Self-documenting code - examples stay in one place
✅ API key testing built-in to Swagger UI
✅ OpenAPI spec for code generators and API clients
✅ Developer-friendly discovery of all endpoints
✅ Automatic documentation synchronization with code

### Sample Data Used

Documentation includes realistic examples:
- **One-time reminders**: Doctor appointments, grocery shopping
- **Recurring reminders**: Team meetings with cron expressions
- **Multiple alerts**: Different notification times (email, SMS, push)
- **Various reminder types**: With locations, descriptions, and recurrence patterns

---

## Sources and References

- [QStash Announcement](https://upstash.com/blog/qstash-announcement)
- [Building Reminders with QStash](https://upstash.com/blog/qstash-reminder)
- [QStash Pricing](https://upstash.com/pricing/qstash)
- [Render.com Free Tier](https://community.render.com/t/do-web-services-on-a-free-tier-go-to-sleep-after-some-time-inactive/3303)
- [Email Scheduler with QStash](https://upstash.com/blog/email-scheduler-qstash)
- [Elysia Swagger Plugin](https://elysiajs.com/plugins/swagger)
- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.3)
