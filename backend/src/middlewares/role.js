import { AppError } from "../utils/errors.js";
import { supabaseAdmin } from "../lib/supabase.js";

export const requireRole = (allowedRoles = []) => async (req, _res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (error || !data) {
      throw new AppError("User role not found", 403);
    }

    if (!allowedRoles.includes(data.role)) {
      throw new AppError("Forbidden", 403);
    }

    req.role = data.role;
    next();
  } catch (error) {
    next(error);
  }
};