import { AppError } from "../utils/errors.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { parseCookies } from "../utils/auth.js";
import { env } from "../config/env.js";
import { extractUserName, extractUserSettings, getAuthSchemaMode } from "../utils/userCompat.js";

export const requireAuth = async (req, _res, next) => {
  try {
    const cookies = parseCookies(req.headers.cookie || "");
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const sessionToken = bearerToken || cookies[env.sessionCookieName] || cookies.kotiba_session;

    if (!sessionToken) {
      throw new AppError("Unauthorized", 401);
    }

    const mode = await getAuthSchemaMode();

    if (mode === "modern") {
      const sessionResult = await supabaseAdmin
        .from("sessions")
        .select("id, user_id, expires_at, users(id, name, role, created_at)")
        .eq("token", sessionToken)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (sessionResult.error || !sessionResult.data?.users) {
        throw new AppError("Unauthorized", 401);
      }

      req.session = sessionResult.data;
      req.user = sessionResult.data.users;
      return next();
    }

    const userResult = await supabaseAdmin
      .from("users")
      .select("id, full_name, role, created_at, settings")
      .contains("settings", { session_token: sessionToken })
      .maybeSingle();

    if (userResult.error || !userResult.data) {
      throw new AppError("Unauthorized", 401);
    }

    const settings = extractUserSettings(userResult.data);
    const expiresAt = settings.session_expires_at;
    if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) {
      throw new AppError("Unauthorized", 401);
    }

    req.session = {
      id: `legacy-${userResult.data.id}`,
      user_id: userResult.data.id,
      expires_at: expiresAt,
      token: sessionToken,
    };
    req.user = {
      id: userResult.data.id,
      name: extractUserName(userResult.data),
      role: userResult.data.role || "user",
      created_at: userResult.data.created_at,
    };
    return next();
  } catch (error) {
    next(error);
  }
};
