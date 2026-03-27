import { supabaseAdmin } from "../lib/supabase.js";
import { ok } from "../utils/response.js";
import { assertSupabase } from "../utils/db.js";

export const listNotifications = async (req, res, next) => {
  try {
    const result = await supabaseAdmin
      .from("notifications")
      .select("id, title, message, audio_url, is_read, created_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const notifications = assertSupabase(result, "Failed to fetch notifications");
    res.json(ok({ items: notifications }, "Notifications fetched"));
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select("id, is_read")
      .single();

    const notification = assertSupabase(result, "Notification not found");
    res.json(ok({ notification }, "Notification marked as read"));
  } catch (error) {
    next(error);
  }
};