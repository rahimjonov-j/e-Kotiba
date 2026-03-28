import dotenv from "dotenv";

dotenv.config();

const splitCsv = (value) =>
  (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8080),
  appOrigin:
    process.env.APP_ORIGIN || process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173",
  corsOrigins: splitCsv(
    process.env.CORS_ORIGINS ||
      process.env.APP_ORIGIN ||
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      "http://localhost:5173"
  ),
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  openAiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  uzbekVoiceSttUrl: process.env.UZBEKVOICE_STT_URL || "",
  uzbekVoiceSttApiKey: process.env.UZBEKVOICE_STT_API_KEY || process.env.UZBEKVOICE_API_KEY || "",
  uzbekVoiceTtsUrl: process.env.UZBEKVOICE_TTS_URL || "",
  uzbekVoiceTtsApiKey: process.env.UZBEKVOICE_TTS_API_KEY || process.env.UZBEKVOICE_API_KEY || "",
  cbuExchangeRatesUrl: process.env.CBU_EXCHANGE_RATES_URL || "https://cbu.uz/en/arkhiv-kursov-valyut/json/",
  pushVapidPublicKey: process.env.PUSH_VAPID_PUBLIC_KEY || "",
  pushVapidPrivateKey: process.env.PUSH_VAPID_PRIVATE_KEY || "",
  pushVapidSubject: process.env.PUSH_VAPID_SUBJECT || "mailto:admin@example.com",
  reminderJobCron: process.env.REMINDER_JOB_CRON || "*/1 * * * *",
  meetingJobCron: process.env.MEETING_JOB_CRON || "*/5 * * * *",
  meetingAudioReminderCron: process.env.MEETING_AUDIO_REMINDER_CRON || "*/1 * * * *",
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 720),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "kotiba_session",
};

export const assertRequiredEnv = () => {
  const required = ["supabaseUrl", "supabaseAnonKey", "supabaseServiceRoleKey"];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    console.warn(`Missing required env vars: ${missing.join(", ")}`);
  }

  if ((env.uzbekVoiceSttUrl && !env.uzbekVoiceSttApiKey) || (!env.uzbekVoiceSttUrl && env.uzbekVoiceSttApiKey)) {
    console.warn("STT configuration is incomplete. Set both UZBEKVOICE_STT_URL and UZBEKVOICE_STT_API_KEY (or UZBEKVOICE_API_KEY).");
  }

  if ((env.uzbekVoiceTtsUrl && !env.uzbekVoiceTtsApiKey) || (!env.uzbekVoiceTtsUrl && env.uzbekVoiceTtsApiKey)) {
    console.warn("TTS configuration is incomplete. Set both UZBEKVOICE_TTS_URL and UZBEKVOICE_TTS_API_KEY (or UZBEKVOICE_API_KEY).");
  }

  if (!env.openAiApiKey) {
    console.warn("OPENAI_API_KEY is missing. OpenAI parsing will not work.");
  }

  if ((env.pushVapidPublicKey || env.pushVapidPrivateKey) && !(env.pushVapidPublicKey && env.pushVapidPrivateKey)) {
    console.warn("Push configuration is incomplete. Set both PUSH_VAPID_PUBLIC_KEY and PUSH_VAPID_PRIVATE_KEY.");
  }

};
