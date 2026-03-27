import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../lib/supabase.js";
import { AppError } from "../utils/errors.js";

import { generateTtsAudio } from "./aiService.js";

const BUCKET = "reminder-audio";
let bucketReadyPromise = null;

const ensureReminderAudioBucket = async () => {
  if (!bucketReadyPromise) {
    bucketReadyPromise = (async () => {
      const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
      if (listError) {
        throw new AppError(`Failed to inspect storage buckets: ${listError.message}`, 500);
      }

      const exists = Array.isArray(buckets) && buckets.some((bucket) => bucket.name === BUCKET || bucket.id === BUCKET);
      if (exists) return;

      const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: "25MB",
      });

      if (createError && !String(createError.message || "").toLowerCase().includes("already exists")) {
        throw new AppError(`Failed to create storage bucket '${BUCKET}': ${createError.message}`, 500);
      }
    })().catch((error) => {
      bucketReadyPromise = null;
      throw error;
    });
  }

  return bucketReadyPromise;
};

export const uploadReminderAudio = async ({ userId, audioBase64 }) => {
  await ensureReminderAudioBucket();
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
  await ensureReminderAudioBucket();

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
