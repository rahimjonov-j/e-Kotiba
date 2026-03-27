import { Router } from "express";
import { randomUUID } from "node:crypto";
import { supabaseAdmin, supabaseAnon } from "../lib/supabase.js";
import { ok } from "../utils/response.js";
import { AppError } from "../utils/errors.js";
import { validate } from "../middlewares/validate.js";
import { requireAuth } from "../middlewares/auth.js";
import { signUpSchema, loginSchema } from "../validators/auth.js";
import { settingsSchema, settingsUpdateSchema } from "../validators/settings.js";
import { generateSessionToken, getSessionCookieOptions, getSessionExpiresAt, hashPassword, verifyPassword } from "../utils/auth.js";
import { env } from "../config/env.js";
import { createSyntheticEmail, extractUserName, extractUserSettings, getAuthSchemaMode } from "../utils/userCompat.js";

const router = Router();

const DEFAULT_SETTINGS = {
  default_reminder_unit: "hour",
  reminder_interval: "1min",
  preferred_channel: "in_app",
  language: "uz",
  timezone: "Asia/Tashkent",
  theme: "light",
  audio_enabled: true,
  monthly_salary: 0,
  tts_voice: "lola",
  welcome_seen: false,
};

const SETTINGS_SELECT =
  "default_reminder_unit, reminder_interval, preferred_channel, language, timezone, theme, audio_enabled, monthly_salary, tts_voice, welcome_seen";

const normalizeSettings = (settings = {}) => {
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
};

const setSessionCookie = (res, token) => {
  res.cookie(env.sessionCookieName, token, getSessionCookieOptions());
};

const clearSessionCookie = (res) => {
  res.clearCookie(env.sessionCookieName, {
    ...getSessionCookieOptions(),
    maxAge: undefined,
  });
};

const ensureUserSettingsModern = async (userId) => {
  const settingsResult = await supabaseAdmin
    .from("user_settings")
    .select(SETTINGS_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (settingsResult.error) {
    throw new AppError(settingsResult.error.message || "Failed to fetch settings", 400);
  }

  if (!settingsResult.data) {
    const insertResult = await supabaseAdmin
      .from("user_settings")
      .insert({ user_id: userId, ...DEFAULT_SETTINGS })
      .select(SETTINGS_SELECT)
      .single();

    if (insertResult.error) {
      throw new AppError(insertResult.error.message || "Failed to create settings", 400);
    }

    return insertResult.data;
  }

  const normalized = normalizeSettings(settingsResult.data);
  if (JSON.stringify(normalized) === JSON.stringify(settingsResult.data)) {
    return normalized;
  }

  const updateResult = await supabaseAdmin
    .from("user_settings")
    .update(normalized)
    .eq("user_id", userId)
    .select(SETTINGS_SELECT)
    .single();

  if (updateResult.error) {
    throw new AppError(updateResult.error.message || "Failed to normalize settings", 400);
  }

  return updateResult.data;
};

const ensureUserSettingsLegacy = async (userId) => {
  const userResult = await supabaseAdmin
    .from("users")
    .select("id, settings")
    .eq("id", userId)
    .single();

  if (userResult.error) {
    throw new AppError(userResult.error.message || "Failed to fetch settings", 400);
  }

  const existingSettings = extractUserSettings(userResult.data);
  const normalized = normalizeSettings(existingSettings);

  if (JSON.stringify(normalized) === JSON.stringify(existingSettings)) {
    return normalized;
  }

  const updateResult = await supabaseAdmin
    .from("users")
    .update({ settings: { ...existingSettings, ...normalized } })
    .eq("id", userId)
    .select("settings")
    .single();

  if (updateResult.error) {
    throw new AppError(updateResult.error.message || "Failed to normalize settings", 400);
  }

  return normalizeSettings(extractUserSettings(updateResult.data));
};

const ensureUserSettings = async (userId) => {
  const mode = await getAuthSchemaMode();
  return mode === "modern" ? ensureUserSettingsModern(userId) : ensureUserSettingsLegacy(userId);
};

const createSessionModern = async (userId) => {
  const token = generateSessionToken();
  const expiresAt = getSessionExpiresAt();

  const sessionResult = await supabaseAdmin
    .from("sessions")
    .insert({
      user_id: userId,
      token,
      expires_at: expiresAt,
    })
    .select("id, user_id, token, expires_at")
    .single();

  if (sessionResult.error) {
    throw new AppError(sessionResult.error.message || "Failed to create session", 400);
  }

  return sessionResult.data;
};

const createSessionLegacy = async (userId) => {
  const token = generateSessionToken();
  const expiresAt = getSessionExpiresAt();

  const userResult = await supabaseAdmin
    .from("users")
    .select("settings")
    .eq("id", userId)
    .single();

  if (userResult.error) {
    throw new AppError(userResult.error.message || "Failed to create session", 400);
  }

  const settings = extractUserSettings(userResult.data);
  const updateResult = await supabaseAdmin
    .from("users")
    .update({
      settings: {
        ...settings,
        session_token: token,
        session_expires_at: expiresAt,
      },
    })
    .eq("id", userId)
    .select("id")
    .single();

  if (updateResult.error) {
    throw new AppError(updateResult.error.message || "Failed to create session", 400);
  }

  return { id: `legacy-${userId}`, user_id: userId, token, expires_at: expiresAt };
};

const createSession = async (userId) => {
  const mode = await getAuthSchemaMode();
  return mode === "modern" ? createSessionModern(userId) : createSessionLegacy(userId);
};

const buildProfile = async (userRow) => {
  const settings = await ensureUserSettings(userRow.id);
  return {
    id: userRow.id,
    name: extractUserName(userRow),
    role: userRow.role || "user",
    created_at: userRow.created_at,
    settings,
  };
};

const findUserByName = async (name) => {
  const mode = await getAuthSchemaMode();
  const selectColumns = mode === "modern" ? "id, name, role, created_at, password_hash" : "id, full_name, email, role, created_at, settings";
  const column = mode === "modern" ? "name" : "full_name";

  const result = await supabaseAdmin
    .from("users")
    .select(selectColumns)
    .eq(column, name)
    .maybeSingle();

  if (result.error) {
    throw new AppError(result.error.message || "Failed to check user", 400);
  }

  return { mode, user: result.data };
};

router.post("/signup", validate(signUpSchema), async (req, res, next) => {
  try {
    const name = req.body.name.trim();
    const passwordHash = hashPassword(req.body.password);
    const { mode, user: existingUser } = await findUserByName(name);

    if (existingUser) {
      throw new AppError("This username is already taken", 409);
    }

    let userResult;

    if (mode === "modern") {
      userResult = await supabaseAdmin
        .from("users")
        .insert({ name, password_hash: passwordHash, role: "user" })
        .select("id, name, role, created_at")
        .single();
    } else {
      const authEmail = createSyntheticEmail(name);
      const authResult = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password: req.body.password,
        email_confirm: true,
        user_metadata: { full_name: name },
      });

      if (authResult.error || !authResult.data.user) {
        throw new AppError(authResult.error?.message || "Failed to create account", 400);
      }

      userResult = await supabaseAdmin
        .from("users")
        .upsert(
          {
            id: authResult.data.user.id || randomUUID(),
            full_name: name,
            email: authEmail,
            role: "user",
            settings: {
              ...DEFAULT_SETTINGS,
            },
          },
          { onConflict: "id" }
        )
        .select("id, full_name, email, role, created_at, settings")
        .single();
    }

    if (userResult.error) {
      throw new AppError(userResult.error.message || "Failed to create account", 400);
    }

    await ensureUserSettings(userResult.data.id);
    const session = await createSession(userResult.data.id);
    setSessionCookie(res, session.token);

    const profile = await buildProfile(userResult.data);
    res.status(201).json(ok({ profile, session: { expires_at: session.expires_at } }, "Account created"));
  } catch (error) {
    next(error);
  }
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const name = req.body.name.trim();
    const { mode, user } = await findUserByName(name);

    if (!user) {
      throw new AppError("Invalid name or password", 401);
    }

    if (mode === "modern") {
      const passwordHash = user.password_hash;
      if (!verifyPassword(req.body.password, passwordHash)) {
        throw new AppError("Invalid name or password", 401);
      }
    } else {
      const signInResult = await supabaseAnon.auth.signInWithPassword({
        email: user.email,
        password: req.body.password,
      });

      if (signInResult.error) {
        throw new AppError("Invalid name or password", 401);
      }
    }

    const session = await createSession(user.id);
    setSessionCookie(res, session.token);

    const profile = await buildProfile(user);
    res.json(ok({ profile, session: { expires_at: session.expires_at } }, "Login successful"));
  } catch (error) {
    next(error);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const mode = await getAuthSchemaMode();

    if (mode === "modern") {
      await supabaseAdmin.from("sessions").delete().eq("id", req.session.id);
    } else {
      const userResult = await supabaseAdmin.from("users").select("settings").eq("id", req.user.id).single();
      if (userResult.error) {
        throw new AppError(userResult.error.message || "Failed to logout", 400);
      }

      const settings = extractUserSettings(userResult.data);
      delete settings.session_token;
      delete settings.session_expires_at;

      const updateResult = await supabaseAdmin.from("users").update({ settings }).eq("id", req.user.id);
      if (updateResult.error) {
        throw new AppError(updateResult.error.message || "Failed to logout", 400);
      }
    }

    clearSessionCookie(res);
    res.json(ok({}, "Logout successful"));
  } catch (error) {
    next(error);
  }
});

router.get("/session", requireAuth, async (req, res, next) => {
  try {
    const profile = await buildProfile(req.user);
    res.json(ok({ profile, session: { expires_at: req.session.expires_at } }, "Session restored"));
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const profile = await buildProfile(req.user);
    res.json(ok({ profile }, "Profile fetched"));
  } catch (error) {
    next(error);
  }
});

router.get("/settings", requireAuth, async (req, res, next) => {
  try {
    const settings = await ensureUserSettings(req.user.id);
    res.json(ok({ settings }, "Settings fetched"));
  } catch (error) {
    next(error);
  }
});

router.patch("/settings", requireAuth, validate(settingsUpdateSchema), async (req, res, next) => {
  try {
    const mode = await getAuthSchemaMode();
    const currentSettings = await ensureUserSettings(req.user.id);
    const merged = { ...currentSettings, ...req.body };
    const parsed = settingsSchema.safeParse(merged);

    if (!parsed.success) {
      throw new AppError("Invalid settings values", 422);
    }

    if (mode === "modern") {
      const updateResult = await supabaseAdmin
        .from("user_settings")
        .update(parsed.data)
        .eq("user_id", req.user.id)
        .select(SETTINGS_SELECT)
        .single();

      if (updateResult.error) {
        throw new AppError(updateResult.error.message || "Failed to update settings", 400);
      }

      res.json(ok({ settings: updateResult.data }, "Settings updated"));
      return;
    }

    const userResult = await supabaseAdmin.from("users").select("settings").eq("id", req.user.id).single();
    if (userResult.error) {
      throw new AppError(userResult.error.message || "Failed to update settings", 400);
    }

    const existingSettings = extractUserSettings(userResult.data);
    const updateResult = await supabaseAdmin
      .from("users")
      .update({ settings: { ...existingSettings, ...parsed.data } })
      .eq("id", req.user.id)
      .select("settings")
      .single();

    if (updateResult.error) {
      throw new AppError(updateResult.error.message || "Failed to update settings", 400);
    }

    res.json(ok({ settings: normalizeSettings(extractUserSettings(updateResult.data)) }, "Settings updated"));
  } catch (error) {
    next(error);
  }
});

export default router;
