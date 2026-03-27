import { z } from "zod";

export const settingsValues = {
  default_reminder_unit: ["minute", "hour", "day", "week", "custom"],
  preferred_channel: ["in_app"],
  language: ["uz", "en", "ru"],
  theme: ["light", "dark", "system"],
  reminder_interval: ["1min", "5min", "15min", "1hour"],
  tts_voice: ["lola", "shoira", "Fotima-angry"],
};

const isValidTimezone = (value) => {
  if (typeof value !== "string" || !value.includes("/")) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

export const settingsSchema = z.object({
  default_reminder_unit: z.enum(settingsValues.default_reminder_unit),
  reminder_interval: z.enum(settingsValues.reminder_interval).default("1min"),
  preferred_channel: z.enum(settingsValues.preferred_channel),
  language: z.enum(settingsValues.language),
  theme: z.enum(settingsValues.theme).default("light"),
  audio_enabled: z.boolean().default(true),
  timezone: z.string().refine(isValidTimezone, "Invalid timezone"),
  monthly_salary: z.coerce.number().finite().min(0).default(0),
  tts_voice: z.enum(settingsValues.tts_voice).default("lola"),
  welcome_seen: z.boolean().default(false),
});

export const settingsUpdateSchema = settingsSchema.partial();
