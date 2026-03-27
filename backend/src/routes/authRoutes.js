import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { ok } from "../utils/response.js";
import { assertSupabase } from "../utils/db.js";
import { AppError } from "../utils/errors.js";
import { validate } from "../middlewares/validate.js";
import { settingsSchema, settingsUpdateSchema } from "../validators/settings.js";

const router = Router();

const DEFAULT_SETTINGS = {
  default_reminder_unit: "hour",
  preferred_channel: "in_app",
  language: "uz",
  timezone: "Asia/Tashkent",
};

const normalizeSettings = (settings = {}) => {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
  };

  const parsed = settingsSchema.safeParse(merged);
  if (!parsed.success) {
    return DEFAULT_SETTINGS;
  }

  return parsed.data;
};

const ensureUserSettings = async (user) => {
  const userId = user.id;

  const selectResult = await supabaseAdmin
    .from("users")
    .select("id, full_name, email, role, settings")
    .eq("id", userId)
    .maybeSingle();

  if (selectResult.error) {
    throw new AppError(selectResult.error.message || "Failed to fetch user settings", 400);
  }

  const existing = selectResult.data;

  if (!existing) {
    const insertResult = await supabaseAdmin
      .from("users")
      .insert({
        id: userId,
        email: user.email,
        full_name: user.user_metadata?.full_name || "",
        role: "user",
        settings: DEFAULT_SETTINGS,
      })
      .select("id, full_name, email, role, settings")
      .single();

    return assertSupabase(insertResult, "Failed to initialize user settings");
  }

  const normalized = normalizeSettings(existing.settings);
  const changed = JSON.stringify(normalized) !== JSON.stringify(existing.settings || {});

  if (!changed) {
    return { ...existing, settings: normalized };
  }

  const updateResult = await supabaseAdmin
    .from("users")
    .update({ settings: normalized })
    .eq("id", userId)
    .select("id, full_name, email, role, settings")
    .single();

  return assertSupabase(updateResult, "Failed to normalize user settings");
};

router.get("/me", async (req, res, next) => {
  try {
    const profile = await ensureUserSettings(req.user);
    res.json(ok({ profile }, "Profile fetched"));
  } catch (error) {
    next(error);
  }
});

router.get("/settings", async (req, res, next) => {
  try {
    const profile = await ensureUserSettings(req.user);
    res.json(ok({ settings: profile.settings }, "Settings fetched"));
  } catch (error) {
    next(error);
  }
});

router.patch("/settings", validate(settingsUpdateSchema), async (req, res, next) => {
  try {
    const profile = await ensureUserSettings(req.user);
    const merged = {
      ...profile.settings,
      ...req.body,
    };

    const parsed = settingsSchema.safeParse(merged);
    if (!parsed.success) {
      throw new AppError("Invalid settings values", 422);
    }

    const result = await supabaseAdmin
      .from("users")
      .update({ settings: parsed.data })
      .eq("id", req.user.id)
      .select("id, settings")
      .single();

    const updated = assertSupabase(result, "Failed to update settings");
    res.json(ok({ settings: updated.settings }, "Settings updated"));
  } catch (error) {
    next(error);
  }
});

export default router;
