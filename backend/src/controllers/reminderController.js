import { supabaseAdmin } from "../lib/supabase.js";
import { generateTtsAudio } from "../services/aiService.js";
import { uploadReminderAudio } from "../services/storageService.js";
import { ok } from "../utils/response.js";
import { assertSupabase } from "../utils/db.js";
import { AppError } from "../utils/errors.js";
import { toPagination } from "../utils/pagination.js";

const isMissingSystemJobsTable = (error) =>
  error?.code === "PGRST205" || String(error?.message || "").includes("public.system_jobs");

const enqueueReminderJob = async ({ reminderId, runAt }) => {
  const job = await supabaseAdmin.from("system_jobs").insert({
    job_type: "reminder_trigger",
    payload: { reminder_id: reminderId },
    scheduled_for: runAt,
    status: "pending",
    retry_count: 0,
  });

  if (job.error && isMissingSystemJobsTable(job.error)) {
    return false;
  }

  assertSupabase(job, "Failed to create reminder job");
  return true;
};

export const createReminder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      title,
      original_text,
      cleaned_text,
      frequency_value,
      frequency_unit,
      next_run_at,
      parsed_data,
      tts_voice,
    } = req.body;

    let audioUrl = null;
    let audioError = null;
    try {
      const audioBase64 = await generateTtsAudio({ text: cleaned_text || original_text, voice: tts_voice });
      audioUrl = await uploadReminderAudio({ userId, audioBase64 });
    } catch (error) {
      audioUrl = null;
      audioError = error?.message || "Audio generation failed";
    }

    const insertResult = await supabaseAdmin
      .from("reminders")
      .insert({
        user_id: userId,
        title,
        original_text,
        cleaned_text,
        frequency_value,
        frequency_unit,
        next_run_at,
        audio_url: audioUrl,
        parsed_data,
        status: "active",
      })
      .select()
      .single();

    const reminder = assertSupabase(insertResult, "Failed to create reminder");
    const jobScheduled = await enqueueReminderJob({ reminderId: reminder.id, runAt: reminder.next_run_at });

    res.status(201).json(ok({ reminder, job_scheduled: jobScheduled, audio_ready: Boolean(audioUrl), audio_error: audioError }, "Reminder created"));
  } catch (error) {
    next(error);
  }
};

export const listReminders = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const { from, to } = toPagination(page, limit);
    const query = await supabaseAdmin
      .from("reminders")
      .select("*", { count: "exact" })
      .eq("user_id", req.user.id)
      .order("next_run_at", { ascending: true })
      .range(from, to);

    const rows = assertSupabase(query, "Failed to fetch reminders");

    res.json(
      ok(
        {
          items: rows,
          pagination: {
            page,
            limit,
            total: query.count || 0,
          },
        },
        "Reminders fetched"
      )
    );
  } catch (error) {
    next(error);
  }
};

export const updateReminder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patch = req.body;

    const updateResult = await supabaseAdmin
      .from("reminders")
      .update(patch)
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    const reminder = assertSupabase(updateResult, "Failed to update reminder");

    if (patch.next_run_at) {
      await enqueueReminderJob({ reminderId: reminder.id, runAt: patch.next_run_at });
    }

    res.json(ok({ reminder }, "Reminder updated"));
  } catch (error) {
    next(error);
  }
};

export const markReminderRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    const notification = assertSupabase(result, "Notification not found");
    res.json(ok({ notification }, "Notification marked as read"));
  } catch (error) {
    next(error);
  }
};

export const deleteReminder = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await supabaseAdmin.from("reminders").delete().eq("id", id).eq("user_id", req.user.id).select().single();
    const reminder = assertSupabase(result, "Reminder not found");

    res.json(ok({ reminder }, "Reminder deleted"));
  } catch (error) {
    if (error.message?.includes("contains 0 rows")) {
      return next(new AppError("Reminder not found", 404));
    }
    return next(error);
  }
};
