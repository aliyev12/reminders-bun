import { z } from "zod";

const defaultEmailAddress = process.env.DEFAULT_EMAIL;

export const ModeEnum = z.enum(["email", "sms", "push", "ical"]);
export type TMode = z.infer<typeof ModeEnum>;

export const ReminderModeSchema = z.object({
  id: z.string().describe("Unique identifier of the reminder mode"),
  mode: ModeEnum.describe("Mode of contact"),
  address: z.string().describe("Contact address"),
});

export const AlertSchema = z.object({
  id: z.string().describe("Unique identifier of the alert"),
  time: z
    .number()
    .min(3000, "Alert must be at least 3000 milliseconds")
    .describe("Alert time in milliseconds before the reminder"),
});

const ReminderBaseSchema = z.object({
  title: z.string().describe("Title of the reminder"),
  date: z
    .string()
    .describe(
      "Date of the reminder, it has to be using UTC format, for example: 2025-11-29T03:03:53Z",
    ),
  location: z
    .string()
    .nullable()
    .optional()
    .default(null)
    .describe("Location of the reminder"),
  description: z.string().describe("Description of the reminder"),
  reminders: z
    .array(ReminderModeSchema)
    .default([
      {
        id: "123",
        mode: "email",
        address: defaultEmailAddress!,
      },
    ])
    .describe("List of contact modes to use for the reminder"),
  alerts: z
    .array(AlertSchema)
    .default([
      {
        id: "alert-123",
        time: 3000,
      },
    ])
    .describe("List of alert times in milliseconds before the reminder"),
  is_recurring: z
    .boolean()
    .default(false)
    .optional()
    .describe("Indicates if the reminder is recurring"),
  recurrence: z
    .string()
    .nullable()
    .optional()
    .default(null)
    .describe("Recurrence pattern of the reminder as a cron expression"),
  start_date: z
    .string()
    .nullable()
    .optional()
    .default(null)
    .describe("Start date of the recurrence in ISO format"),
  end_date: z
    .string()
    .nullable()
    .optional()
    .default(null)
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

export const DeleteReminderOutputSchema = z.object({
  status: z.string().describe("Status of the delete operation"),
  error: z
    .string()
    .optional()
    .describe("Error message if the delete operation failed"),
  deletedReminder: z
    .array(ReminderSchema)
    .optional()
    .describe("The reminder that was deleted"),
});

export type TDeleteReminderOutput = z.infer<typeof DeleteReminderOutputSchema>;

export const DeleteRemindersBulkOutputSchema = z.object({
  status: z.string().describe("Status of the delete operation"),
  error: z
    .string()
    .optional()
    .describe("Error message if the delete operation failed"),
});

export type TDeleteRemindersBulkOutput = z.infer<
  typeof DeleteRemindersBulkOutputSchema
>;

export const ReminderDTOSchema = z.object({
  ...ReminderSchema.shape,
  reminders: z.string().describe("Serialized reminders JSON string"),
  alerts: z.string().describe("Serialized alerts JSON string"),
  is_active: z.number().describe("Active status as 0 or 1"),
  last_alert_time: z
    .string()
    .nullable()
    .describe("Last alert time in ISO format"),
});

export type TReminderDTO = z.infer<typeof ReminderDTOSchema>;
