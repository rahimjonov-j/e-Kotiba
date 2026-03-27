import { z } from "zod";

const reminderIntervalSchema = z
  .string()
  .regex(/^\d+min$/i, "reminder_interval must look like 1min, 5min")
  .optional()
  .nullable();

export const meetingCreateSchema = z.object({
  title: z.string().min(2),
  meeting_datetime: z.string().datetime(),
  client_id: z.string().uuid(),
  auto_message_enabled: z.boolean().default(true),
  reminder_interval: reminderIntervalSchema,
  enable_audio_reminder: z.boolean().default(false),
});

export const meetingUpdateSchema = z
  .object({
    title: z.string().min(2).optional(),
    meeting_datetime: z.string().datetime().optional(),
    client_id: z.string().uuid().optional(),
    auto_message_enabled: z.boolean().optional(),
    reminder_interval: reminderIntervalSchema,
    enable_audio_reminder: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });
