import cron from "node-cron";
import { env } from "../config/env.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { assertSupabase } from "../utils/db.js";
import { generateTtsAudio } from "../services/aiService.js";
import { uploadReminderAudio, getStaticReminderUrl } from "../services/storageService.js";
import { getAuthSchemaMode, extractUserName } from "../utils/userCompat.js";
import { buildDueReminderText } from "../utils/reminderText.js";
import { sendPushToUser } from "../services/pushService.js";

const REMINDER_NOTIFICATION_LEAD_MS = 10 * 1000;
const FAST_REMINDER_SWEEP_CRON = "*/10 * * * * *";

const isMissingMeetingAudioColumns = (error) =>
  error?.code === "PGRST204" &&
  (String(error?.message || "").includes("enable_audio_reminder") ||
    String(error?.message || "").includes("reminder_interval") ||
    String(error?.message || "").includes("last_triggered_at"));
const isMissingNotificationMetaColumns = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42703" ||
    (code === "PGRST204" &&
      (message.includes("body") ||
        message.includes("scheduled_for") ||
        message.includes("triggered_at") ||
        message.includes("status")))
  );
};

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

const buildReminderNotificationText = (reminder) => {
  const parsed = reminder.parsed_data || {};
  const message =
    parsed.reminder_audio_text ||
    parsed.reminder_message ||
    parsed.notification_message ||
    reminder.cleaned_text ||
    reminder.original_text ||
    reminder.title;

  const normalized = String(message || "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "Sizda hozir rejalashtirilgan eslatma bor.";
  }

  return buildDueReminderText(normalized, reminder.title);
};

const buildReminderNotificationTitle = (reminder) => {
  const normalizedTitle = String(reminder.title || "").replace(/\s+/g, " ").trim();
  return normalizedTitle || "Eslatma";
};

const loadUserDisplayName = async (userId) => {
  const mode = await getAuthSchemaMode();
  const result = await supabaseAdmin
    .from("users")
    .select(mode === "modern" ? "id, name" : "id, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (result.error || !result.data) {
    return "Foydalanuvchi";
  }

  return extractUserName(result.data);
};

const loadUserTtsVoice = async (userId) => {
  const mode = await getAuthSchemaMode();

  if (mode === "modern") {
    const settingsResult = await supabaseAdmin.from("user_settings").select("tts_voice").eq("user_id", userId).maybeSingle();
    if (!settingsResult.error && settingsResult.data?.tts_voice) {
      return settingsResult.data.tts_voice;
    }
    return "lola";
  }

  const userResult = await supabaseAdmin.from("users").select("settings").eq("id", userId).maybeSingle();
  if (!userResult.error) {
    const settings = userResult.data?.settings;
    if (settings && typeof settings === "object" && typeof settings.tts_voice === "string" && settings.tts_voice.trim()) {
      return settings.tts_voice;
    }
  }

  return "lola";
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

const createNotification = async ({
  userId,
  title,
  message,
  audioUrl = null,
  audioText = null,
  voice = "lola",
  scheduledFor = null,
}) => {
  let finalAudioUrl = audioUrl;
  let createdNotification = null;

  if (!finalAudioUrl && audioText) {
    try {
      const audioBase64 = await generateTtsAudio({ text: audioText, voice });
      finalAudioUrl = await uploadReminderAudio({ userId, audioBase64 });
    } catch (error) {
      console.error("Failed to generate notification audio:", error);
    }
  }

  if (!finalAudioUrl) {
    try {
      finalAudioUrl = await getStaticReminderUrl();
    } catch (e) {
      console.error("Failed to fetch static audio URL:", e);
    }
  }

  let result = await supabaseAdmin
    .from("notifications")
    .insert({
      user_id: userId,
      title,
      message,
      body: message,
      audio_url: finalAudioUrl,
      scheduled_for: scheduledFor,
      triggered_at: new Date().toISOString(),
      status: "sent",
      is_read: false,
    })
    .select("id, title, message, body, audio_url, created_at")
    .single();

  if (result.error && isMissingNotificationMetaColumns(result.error)) {
    result = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: userId,
        title,
        message,
        audio_url: finalAudioUrl,
        is_read: false,
      })
      .select("id, title, message, audio_url, created_at")
      .single();
  }

  createdNotification = assertSupabase(result, "Failed to create notification");

  try {
    await sendPushToUser({
      userId,
      payload: {
        notificationId: createdNotification.id,
        title,
        body: message,
        url: "/reminders",
        audioUrl: finalAudioUrl,
        tag: `kotiba-${createdNotification.id}`,
      },
    });
  } catch (error) {
    console.error("Failed to send push notification:", error?.message || error);
  }

  return createdNotification;
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

  const reminderMessage = buildReminderNotificationText(reminder);
  const reminderTitle = buildReminderNotificationTitle(reminder);
  const reusableAudioUrl =
    reminder.audio_url && reminder.parsed_data?.reminder_audio_text === reminderMessage
      ? reminder.audio_url
      : null;

  await createNotification({
    userId: reminder.user_id,
    title: reminderTitle,
    message: reminderMessage,
    audioUrl: reusableAudioUrl,
    audioText: reminderMessage,
    voice: reminder.parsed_data?.tts_voice || (await loadUserTtsVoice(reminder.user_id)),
    scheduledFor: job.scheduled_for,
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
  } else {
    const archiveResult = await supabaseAdmin.from("reminders").update({ status: "archived" }).eq("id", reminder.id);
    assertSupabase(archiveResult, "Failed to archive reminder after trigger");
  }

  await finishJob(job.id, "completed");
};

const processMeetingJob = async (job) => {
  const meetingId = job.payload?.meeting_id;
  if (!meetingId) throw new Error("Missing meeting_id in job payload");

  const meetingResult = await supabaseAdmin
    .from("meetings")
    .select("*, clients(name)")
    .eq("id", meetingId)
    .single();

  const meeting = assertSupabase(meetingResult, "Meeting not found");
  
  const meetingStatus = meeting.status || "scheduled";
  if (meetingStatus !== "scheduled" || !meeting.auto_message_enabled) {
    await finishJob(job.id, "completed");
    return;
  }

  const text = `Eslatma: ${meeting.title} uchrashuvi ${new Date(meeting.meeting_datetime).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })} da rejalangan.`;
  const voice = await loadUserTtsVoice(meeting.user_id);

  await createNotification({
    userId: meeting.user_id,
    title: "Meeting reminder created",
    message: `${text} (ichki bildirishnoma)`,
    audioText: text,
    voice,
  });

  await finishJob(job.id, "completed");
};

const processPendingJobs = async (jobType, leadMs = 0) => {
  const cutoff = new Date(Date.now() + Math.max(0, Number(leadMs) || 0)).toISOString();

  const result = await supabaseAdmin
    .from("system_jobs")
    .select("*")
    .eq("status", "pending")
    .eq("job_type", jobType)
    .lte("scheduled_for", cutoff)
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
  const mode = await getAuthSchemaMode();
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const meetingsResult = await supabaseAdmin
    .from("meetings")
    .select(mode === "modern" ? "*, clients(name), users(name)" : "*, clients(name)")
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

    const userName = mode === "modern" ? (meeting.users?.name || "Foydalanuvchi") : await loadUserDisplayName(meeting.user_id);
    const clientName = meeting.clients?.name || "mijoz";
    const message = buildMeetingReminderText({ userName, meetingTime, clientName });
    const voice = await loadUserTtsVoice(meeting.user_id);

    await createNotification({
      userId: meeting.user_id,
      title: "Meeting audio reminder",
      message,
      audioText: message,
      voice,
    });

    const updateResult = await supabaseAdmin
      .from("meetings")
      .update({ last_triggered_at: now.toISOString() })
      .eq("id", meeting.id);

    assertSupabase(updateResult, "Failed to update meeting last_triggered_at");
  }
};

export const startSchedulers = () => {
  cron.schedule(FAST_REMINDER_SWEEP_CRON, async () => {
    await processPendingJobs("reminder_trigger", REMINDER_NOTIFICATION_LEAD_MS);
  });

  cron.schedule(env.meetingJobCron, async () => {
    await processPendingJobs("meeting_auto_message");
  });

  cron.schedule(env.meetingAudioReminderCron, async () => {
    await runMeetingAudioReminderSweep();
  });
};
