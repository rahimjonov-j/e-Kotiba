import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../lib/supabase.js";
import { AppError } from "../utils/errors.js";

import { generateTtsAudio } from "./aiService.js";

const BUCKET = "reminder-audio";

export const uploadReminderAudio = async ({ userId, audioBase64 }) => {
  const path = `${userId}/${randomUUID()}.mp3`;
  const binary = Buffer.from(audioBase64, "base64");

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, binary, { contentType: "audio/mpeg", upsert: false });

  if (error) {
    throw new AppError(`Audio upload failed: ${error.message}`, 400);
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

  return publicUrl;
};

// Cache the static reminder URL in-memory
let cachedStaticReminderUrl = null;
let staticReminderFetchAttempted = false;

export const getStaticReminderUrl = async () => {
  if (cachedStaticReminderUrl) return cachedStaticReminderUrl;
  if (staticReminderFetchAttempted) return null;

  staticReminderFetchAttempted = true;

  const path = `system/static_reminder.mp3`;

  // Check if it exists in Supabase storage
  const { data: listData, error: listError } = await supabaseAdmin.storage
    .from(BUCKET)
    .list("system", { search: "static_reminder.mp3" });

  if (!listError && listData && listData.length > 0) {
    const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    cachedStaticReminderUrl = publicUrl;
    return publicUrl;
  }

  // If not found, generate it using TTS
  const text = "Bugun sizning muhim uchrashuvingiz bor";
  try {
    const audioBase64 = await generateTtsAudio({ text, voice: "lola" });
    const binary = Buffer.from(audioBase64, "base64");

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, binary, { contentType: "audio/mpeg", upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    cachedStaticReminderUrl = publicUrl;
    return publicUrl;
  } catch (error) {
    console.error("Failed to generate static audio reminder:", error);
    return null;
  }
};