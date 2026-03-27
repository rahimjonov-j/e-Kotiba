import { AppError } from "../utils/errors.js";
import { supabaseAdmin } from "../lib/supabase.js";

export const requireAuth = async (req, _res, next) => {
  try {
    // LOGIN BYPASS ENABLED FOR DEV/DEMO
    req.user = { id: "901d54a0-23c4-4291-bd0f-46c3cd0d8be4" };
    return next();
  } catch (error) {
    next(error);
  }
};