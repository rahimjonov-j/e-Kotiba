import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

const common = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
};

export const supabaseAnon = createClient(env.supabaseUrl, env.supabaseAnonKey, common);
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, common);