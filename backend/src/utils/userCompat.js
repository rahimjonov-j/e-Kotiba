import crypto from "node:crypto";
import { supabaseAdmin } from "../lib/supabase.js";

let schemaModePromise;

export const getAuthSchemaMode = async () => {
  if (!schemaModePromise) {
    schemaModePromise = (async () => {
      const usersResult = await supabaseAdmin.from("users").select("id, name, password_hash").limit(1);
      if (usersResult.error?.code === "42703") {
        return "legacy";
      }

      const [settingsResult, sessionsResult] = await Promise.all([
        supabaseAdmin.from("user_settings").select("user_id").limit(1),
        supabaseAdmin.from("sessions").select("id").limit(1),
      ]);

      if (settingsResult.error?.code === "PGRST205" || sessionsResult.error?.code === "PGRST205") {
        return "legacy";
      }

      return "modern";
    })();
  }

  return schemaModePromise;
};

export const resetAuthSchemaModeCache = () => {
  schemaModePromise = null;
};

export const extractUserName = (userRow) => userRow?.name || userRow?.full_name || "User";

export const extractUserSettings = (userRow) =>
  userRow?.settings && typeof userRow.settings === "object" && !Array.isArray(userRow.settings)
    ? userRow.settings
    : {};

export const createSyntheticEmail = (name) => {
  const slug = String(name || "user")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "user";

  return `${slug}-${crypto.randomBytes(4).toString("hex")}@local.kotiba`;
};

