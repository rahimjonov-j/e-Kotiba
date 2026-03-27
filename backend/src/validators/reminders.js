import { z } from "zod";

export const reminderCreateSchema = z.object({
  title: z.string().min(2),
  original_text: z.string().min(2),
  cleaned_text: z.string().min(2),
  frequency_value: z.number().int().positive().nullable(),
  frequency_unit: z.enum(["minute", "hour", "day", "week", "custom"]).nullable(),
  next_run_at: z.string().datetime(),
  tts_voice: z.string().default("female_uz"),
  parsed_data: z.record(z.any()).default({}),
});

export const reminderUpdateSchema = z.object({
  status: z.enum(["active", "paused", "archived"]).optional(),
  next_run_at: z.string().datetime().optional(),
});