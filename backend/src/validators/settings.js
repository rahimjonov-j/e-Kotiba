import { z } from "zod";

export const settingsValues = {
  default_reminder_unit: ["minute", "hour", "day", "week", "custom"],
  preferred_channel: ["telegram", "email", "in_app"],
  language: ["uz", "en", "ru"],
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
  preferred_channel: z.enum(settingsValues.preferred_channel),
  language: z.enum(settingsValues.language),
  timezone: z.string().refine(isValidTimezone, "Invalid timezone"),
});

export const settingsUpdateSchema = settingsSchema.partial();
