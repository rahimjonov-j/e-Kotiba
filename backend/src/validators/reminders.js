import { z } from "zod";

const reminderVoices = ["lola", "shoira", "Fotima-angry"];

export const reminderCreateSchema = z.object({
  title: z.string().min(2),
  original_text: z.string().min(2),
  cleaned_text: z.string().min(2),
  frequency_value: z.number().int().positive().nullable(),
  frequency_unit: z.enum(["minute", "hour", "day", "week", "custom"]).nullable(),
  next_run_at: z.string().datetime(),
  tts_voice: z.enum(reminderVoices).default("lola"),
  parsed_data: z.record(z.any()).default({}),
  status: z.enum(["active", "paused", "archived"]).optional(),
});

export const reminderUpdateSchema = z.object({
  title: z.string().min(2).optional(),
  cleaned_text: z.string().min(2).optional(),
  frequency_value: z.number().int().positive().nullable().optional(),
  frequency_unit: z.enum(["minute", "hour", "day", "week", "custom"]).nullable().optional(),
  parsed_data: z.record(z.any()).optional(),
  status: z.enum(["active", "paused", "archived"]).optional(),
  next_run_at: z.string().datetime().optional(),
});
