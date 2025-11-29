import { z } from "zod";

const ReminderModeSchema = z.object({
  mode: z.string().describe("Mode of contact"),
  address: z.string().describe("Contact address"),
});

const ReminderBaseSchema = z.object({
  title: z.string().describe("Title of the reminder"),
  date: z
    .string()
    .describe(
      "Date of the reminder, it has to be using UTC format, for example: 2025-11-29T03:03:53Z"
    ),
  location: z
    .string()
    .nullable()
    .optional()
    .describe("Location of the reminder"),
  description: z.string().describe("Description of the reminder"),
  reminders: z
    .array(ReminderModeSchema)
    .describe("List of contact modes to use for the reminder"),
  alerts: z
    .array(z.number())
    .describe("List of alert times in milliseconds before the reminder"),
  is_recurring: z
    .boolean()
    .default(false)
    .optional()
    .describe("Indicates if the reminder is recurring"),
  recurrence: z
    .any()
    .nullable()
    .optional()
    .describe("Recurrence pattern of the reminder as a cron expression"),
  start_date: z
    .any()
    .nullable()
    .optional()
    .describe("Start date of the recurrence in ISO format"),
  end_date: z
    .any()
    .nullable()
    .optional()
    .describe("End date of the recurrence in ISO format"),
  is_active: z
    .boolean()
    .optional()
    .describe("Indicates if the reminder is active"),
});

export const ReminderSchema = ReminderBaseSchema.extend({
  id: z.number().describe("Unique identifier of the reminder"),
  last_alert_time: z.any().nullable().describe("Last alert time in ISO format"),
});

export const RemindersSchema = z
  .array(ReminderSchema)
  .describe("An array of reminder objects.");

export type TReminder = z.infer<typeof ReminderSchema>;

export type TReminderMode = z.infer<typeof ReminderModeSchema>;

export const CreateReminderInputSchema = ReminderBaseSchema.extend({});

export type TCreateReminderInput = z.infer<typeof CreateReminderInputSchema>;
