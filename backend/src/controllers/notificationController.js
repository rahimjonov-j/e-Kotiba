import { supabaseAdmin } from "../lib/supabase.js";
import { ok } from "../utils/response.js";
import { assertSupabase } from "../utils/db.js";

const isMissingNotificationMetaColumns = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42703" ||
    (code === "PGRST204" &&
      (message.includes("status") ||
        message.includes("scheduled_for") ||
        message.includes("triggered_at") ||
        message.includes("body")))
  );
};

export const listNotifications = async (req, res, next) => {
  try {
    let result = await supabaseAdmin
      .from("notifications")
      .select("id, title, message, audio_url, is_read, status, scheduled_for, triggered_at, created_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (result.error && isMissingNotificationMetaColumns(result.error)) {
      result = await supabaseAdmin
        .from("notifications")
        .select("id, title, message, audio_url, is_read, created_at")
        .eq("user_id", req.user.id)
        .order("created_at", { ascending: false })
        .limit(50);
    }

    const notifications = assertSupabase(result, "Failed to fetch notifications");
    const normalizedItems = (notifications || []).map((item) => ({
      ...item,
      status: item.status || (item.is_read ? "read" : "sent"),
      scheduled_for: item.scheduled_for || null,
      triggered_at: item.triggered_at || item.created_at || null,
    }));

    res.json(ok({ items: normalizedItems }, "Notifications fetched"));
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    let result = await supabaseAdmin
      .from("notifications")
      .update({ is_read: true, status: "read" })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select("id, is_read, status")
      .single();

    if (result.error && isMissingNotificationMetaColumns(result.error)) {
      result = await supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", req.user.id)
        .select("id, is_read")
        .single();
    }

    const notification = assertSupabase(result, "Notification not found");
    res.json(
      ok(
        {
          notification: {
            ...notification,
            status: notification.status || (notification.is_read ? "read" : "sent"),
          },
        },
        "Notification marked as read"
      )
    );
  } catch (error) {
    next(error);
  }
};
