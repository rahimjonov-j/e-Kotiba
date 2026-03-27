import { supabaseAdmin } from "../lib/supabase.js";
import { ok } from "../utils/response.js";
import { assertSupabase } from "../utils/db.js";
import { toPagination } from "../utils/pagination.js";
import { AppError } from "../utils/errors.js";

const isMissingSystemJobsTable = (error) =>
  error?.code === "PGRST205" || String(error?.message || "").includes("public.system_jobs");
const isMissingMeetingAudioColumns = (error) =>
  error?.code === "PGRST204" &&
  (String(error?.message || "").includes("enable_audio_reminder") ||
    String(error?.message || "").includes("reminder_interval") ||
    String(error?.message || "").includes("last_triggered_at"));
const isMissingMeetingStatusColumns = (error) =>
  error?.code === "PGRST204" &&
  (String(error?.message || "").includes("status") || String(error?.message || "").includes("cancelled_at"));

const enqueueMeetingJob = async ({ meetingId, scheduledFor }) => {
  const result = await supabaseAdmin.from("system_jobs").insert({
    job_type: "meeting_auto_message",
    payload: { meeting_id: meetingId },
    scheduled_for: scheduledFor,
    status: "pending",
    retry_count: 0,
  });

  if (result.error && isMissingSystemJobsTable(result.error)) {
    return false;
  }

  assertSupabase(result, "Failed to queue meeting job");
  return true;
};

export const createMeeting = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      user_id: req.user.id,
      reminder_interval: req.body.reminder_interval || null,
      enable_audio_reminder: Boolean(req.body.enable_audio_reminder),
      status: "scheduled",
      cancelled_at: null,
    };

    let result = await supabaseAdmin.from("meetings").insert(payload).select().single();
    if (result.error && isMissingMeetingAudioColumns(result.error)) {
      const fallbackPayload = {
        title: req.body.title,
        meeting_datetime: req.body.meeting_datetime,
        client_id: req.body.client_id,
        auto_message_enabled: req.body.auto_message_enabled,
        user_id: req.user.id,
      };
      result = await supabaseAdmin.from("meetings").insert(fallbackPayload).select().single();
    }

    const meeting = assertSupabase(result, "Failed to create meeting");

    let autoMessageJobScheduled = false;
    if (meeting.auto_message_enabled) {
      const scheduleDate = new Date(new Date(meeting.meeting_datetime).getTime() - 60 * 60 * 1000).toISOString();
      autoMessageJobScheduled = await enqueueMeetingJob({ meetingId: meeting.id, scheduledFor: scheduleDate });
    }

    res.status(201).json(ok({ meeting, auto_message_job_scheduled: autoMessageJobScheduled }, "Meeting created"));
  } catch (error) {
    next(error);
  }
};

export const listMeetings = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const { from, to } = toPagination(page, limit);

    const result = await supabaseAdmin
      .from("meetings")
      .select("*, clients(name, phone, email, telegram_chat_id)", { count: "exact" })
      .eq("user_id", req.user.id)
      .order("meeting_datetime", { ascending: true })
      .range(from, to);

    let meetings = assertSupabase(result, "Failed to fetch meetings");
    if (!Array.isArray(meetings)) {
      meetings = [];
    }
    meetings = meetings.map((meeting) => ({
      ...meeting,
      status: meeting.status || "scheduled",
    }));

    res.json(ok({ items: meetings, pagination: { page, limit, total: result.count || 0 } }, "Meetings fetched"));
  } catch (error) {
    next(error);
  }
};

export const updateMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;

    let result = await supabaseAdmin
      .from("meetings")
      .update(req.body)
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select("*, clients(name, phone, email, telegram_chat_id)")
      .single();

    if (result.error && isMissingMeetingAudioColumns(result.error)) {
      const fallbackPatch = { ...req.body };
      delete fallbackPatch.reminder_interval;
      delete fallbackPatch.enable_audio_reminder;
      delete fallbackPatch.last_triggered_at;

      result = await supabaseAdmin
        .from("meetings")
        .update(fallbackPatch)
        .eq("id", id)
        .eq("user_id", req.user.id)
        .select("*, clients(name, phone, email, telegram_chat_id)")
        .single();
    }

    const meeting = assertSupabase(result, "Failed to update meeting");

    let autoMessageJobScheduled = false;
    if (meeting.auto_message_enabled && req.body.meeting_datetime) {
      const scheduleDate = new Date(new Date(meeting.meeting_datetime).getTime() - 60 * 60 * 1000).toISOString();
      autoMessageJobScheduled = await enqueueMeetingJob({ meetingId: meeting.id, scheduledFor: scheduleDate });
    }

    res.json(ok({ meeting, auto_message_job_scheduled: autoMessageJobScheduled }, "Meeting updated"));
  } catch (error) {
    if (String(error.message || "").includes("contains 0 rows")) {
      return next(new AppError("Meeting not found", 404));
    }
    return next(error);
  }
};

export const deleteMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;

    let result = await supabaseAdmin
      .from("meetings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select("id, title, meeting_datetime, status, cancelled_at")
      .single();

    if (result.error && isMissingMeetingStatusColumns(result.error)) {
      result = await supabaseAdmin
        .from("meetings")
        .delete()
        .eq("id", id)
        .eq("user_id", req.user.id)
        .select("id, title, meeting_datetime")
        .single();
    }

    const meeting = assertSupabase(result, "Failed to cancel meeting");
    res.json(ok({ meeting }, "Meeting cancelled"));
  } catch (error) {
    if (String(error.message || "").includes("contains 0 rows")) {
      return next(new AppError("Meeting not found", 404));
    }
    return next(error);
  }
};
