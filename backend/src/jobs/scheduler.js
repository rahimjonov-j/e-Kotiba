import cron from "node-cron";
import { env } from "../config/env.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { assertSupabase } from "../utils/db.js";
import { sendTelegramMessage } from "../services/notificationService.js";
import { generateTtsAudio } from "../services/aiService.js";
import { uploadReminderAudio, getStaticReminderUrl } from "../services/storageService.js";
const isMissingMeetingAudioColumns = (error) =>
  error?.code === "PGRST204" &&
  (String(error?.message || "").includes("enable_audio_reminder") ||
    String(error?.message || "").includes("reminder_interval") ||
    String(error?.message || "").includes("last_triggered_at"));

const computeNextRun = (current, value, unit) => {
  const date = new Date(current);
  if (!value || !unit) return null;

  if (unit === "minute") date.setMinutes(date.getMinutes() + value);
  if (unit === "hour") date.setHours(date.getHours() + value);
  if (unit === "day") date.setDate(date.getDate() + value);
  if (unit === "week") date.setDate(date.getDate() + value * 7);

  return date.toISOString();
};

const parseIntervalMinutes = (intervalRaw) => {
  if (!intervalRaw || typeof intervalRaw !== "string") return null;
  const match = intervalRaw.match(/^(\d+)min$/i);
  if (!match) return null;
  const minutes = Number(match[1]);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return minutes;
};

const isSameMinute = (a, b) => {
  if (!a || !b) return false;
  const aa = new Date(a);
  const bb = new Date(b);
  return (
    aa.getUTCFullYear() === bb.getUTCFullYear() &&
    aa.getUTCMonth() === bb.getUTCMonth() &&
    aa.getUTCDate() === bb.getUTCDate() &&
    aa.getUTCHours() === bb.getUTCHours() &&
    aa.getUTCMinutes() === bb.getUTCMinutes()
  );
};

const buildMeetingReminderText = ({ userName, meetingTime, clientName }) => {
  const time = meetingTime.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tashkent" });
  const date = meetingTime.toLocaleDateString("uz-UZ", { timeZone: "Asia/Tashkent" });
  return `${userName}, sizni ${date} kuni soat ${time} da ${clientName} bilan uchrashuvingiz bor.`;
};

const finishJob = async (jobId, status, errorMessage = null) => {
  const result = await supabaseAdmin
    .from("system_jobs")
    .update({
      status,
      error_message: errorMessage,
      processed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  assertSupabase(result, "Failed to update job status");
};

const createNotification = async ({ userId, title, message, audioUrl = null }) => {
  let finalAudioUrl = audioUrl;
  if (!finalAudioUrl) {
    try {
      finalAudioUrl = await getStaticReminderUrl();
    } catch (e) {
      console.error("Failed to fetch static audio URL:", e);
    }
  }

  const result = await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    title,
    message,
    audio_url: finalAudioUrl,
    is_read: false,
  });
  assertSupabase(result, "Failed to create notification");
};

const processReminderJob = async (job) => {
  const reminderId = job.payload?.reminder_id;
  if (!reminderId) throw new Error("Missing reminder_id in job payload");

  const reminderResult = await supabaseAdmin.from("reminders").select("*").eq("id", reminderId).single();
  const reminder = assertSupabase(reminderResult, "Reminder not found");

  if (reminder.status !== "active") {
    await finishJob(job.id, "completed");
    return;
  }

  await createNotification({
    userId: reminder.user_id,
    title: reminder.title,
    message: reminder.cleaned_text,
    audioUrl: reminder.audio_url,
  });

  const nextRun = computeNextRun(reminder.next_run_at, reminder.frequency_value, reminder.frequency_unit);
  if (nextRun) {
    const updateReminderResult = await supabaseAdmin.from("reminders").update({ next_run_at: nextRun }).eq("id", reminder.id);
    assertSupabase(updateReminderResult, "Failed to update next reminder run");

    const enqueueResult = await supabaseAdmin.from("system_jobs").insert({
      job_type: "reminder_trigger",
      payload: { reminder_id: reminder.id },
      scheduled_for: nextRun,
      status: "pending",
      retry_count: 0,
    });
    assertSupabase(enqueueResult, "Failed to enqueue next reminder job");
  }

  await finishJob(job.id, "completed");
};

const processMeetingJob = async (job) => {
  const meetingId = job.payload?.meeting_id;
  if (!meetingId) throw new Error("Missing meeting_id in job payload");

  const meetingResult = await supabaseAdmin
    .from("meetings")
    .select("*, clients(name, telegram_chat_id)")
    .eq("id", meetingId)
    .single();

  const meeting = assertSupabase(meetingResult, "Meeting not found");
  
  if (meeting.status !== "scheduled" || !meeting.auto_message_enabled) {
    await finishJob(job.id, "completed");
    return;
  }

  const client = meeting.clients;
  const text = `Reminder: ${meeting.title} meeting at ${new Date(meeting.meeting_datetime).toLocaleString("en-US", { timeZone: "Asia/Tashkent" })}`;

  if (client?.telegram_chat_id) {
    await sendTelegramMessage({ chatId: client.telegram_chat_id, message: text });
  }

  await createNotification({
    userId: meeting.user_id,
    title: "Meeting auto-message sent",
    message: text,
  });

  await finishJob(job.id, "completed");
};

const processPendingJobs = async (jobType) => {
  const now = new Date().toISOString();

  const result = await supabaseAdmin
    .from("system_jobs")
    .select("*")
    .eq("status", "pending")
    .eq("job_type", jobType)
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(20);

  const jobs = assertSupabase(result, "Failed to fetch jobs");

  for (const job of jobs) {
    try {
      if (job.job_type === "reminder_trigger") {
        await processReminderJob(job);
      } else if (job.job_type === "meeting_auto_message") {
        await processMeetingJob(job);
      }
    } catch (error) {
      const retries = (job.retry_count || 0) + 1;
      const failed = retries >= 3;

      const updateResult = await supabaseAdmin
        .from("system_jobs")
        .update({
          retry_count: retries,
          status: failed ? "failed" : "pending",
          error_message: error.message,
          scheduled_for: failed
            ? job.scheduled_for
            : new Date(Date.now() + 60 * 1000 * retries).toISOString(),
        })
        .eq("id", job.id);

      assertSupabase(updateResult, "Failed to update failed job");
    }
  }
};

const runMeetingAudioReminderSweep = async () => {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const meetingsResult = await supabaseAdmin
    .from("meetings")
    .select("*, clients(name), users(full_name)")
    .eq("enable_audio_reminder", true)
    .eq("status", "scheduled")
    .gte("meeting_datetime", dayStart.toISOString())
    .lte("meeting_datetime", dayEnd.toISOString());

  if (meetingsResult.error && isMissingMeetingAudioColumns(meetingsResult.error)) {
    return;
  }

  const meetings = assertSupabase(meetingsResult, "Failed to fetch meetings for audio reminders");

  for (const meeting of meetings) {
    const intervalMinutes = parseIntervalMinutes(meeting.reminder_interval);
    if (!intervalMinutes) continue;

    const meetingTime = new Date(meeting.meeting_datetime);
    const minutesToMeeting = Math.floor((meetingTime.getTime() - now.getTime()) / 60000);

    if (minutesToMeeting < 0) continue;
    if (minutesToMeeting % intervalMinutes !== 0) continue;
    if (isSameMinute(meeting.last_triggered_at, now.toISOString())) continue;

    const userName = meeting.users?.full_name || "Foydalanuvchi";
    const clientName = meeting.clients?.name || "mijoz";
    const message = buildMeetingReminderText({ userName, meetingTime, clientName });

    await createNotification({
      userId: meeting.user_id,
      title: "Meeting audio reminder",
      message,
    });

    const updateResult = await supabaseAdmin
      .from("meetings")
      .update({ last_triggered_at: now.toISOString() })
      .eq("id", meeting.id);

    assertSupabase(updateResult, "Failed to update meeting last_triggered_at");
  }
};

export const startSchedulers = () => {
  cron.schedule(env.reminderJobCron, async () => {
    await processPendingJobs("reminder_trigger");
  });

  cron.schedule(env.meetingJobCron, async () => {
    await processPendingJobs("meeting_auto_message");
  });

  cron.schedule(env.meetingAudioReminderCron, async () => {
    await runMeetingAudioReminderSweep();
  });
};
