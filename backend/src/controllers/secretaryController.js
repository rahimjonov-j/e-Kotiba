import { supabaseAdmin } from "../lib/supabase.js";
import { runSecretaryPipeline } from "../services/secretaryService.js";
import { generateTtsAudio, transcribeAudio } from "../services/aiService.js";
import { uploadReminderAudio } from "../services/storageService.js";
import { ok } from "../utils/response.js";
import { assertSupabase } from "../utils/db.js";
import { extractUserSettings, getAuthSchemaMode } from "../utils/userCompat.js";

import { randomUUID } from "node:crypto";

const isMissingSecretaryLogsTable = (error) => {
  if (!error) return false;
  const code = `${error.code || ""}`.toUpperCase();
  const message = `${error.message || ""}`.toLowerCase();
  return code === "PGRST205" || code === "PGRST204" || message.includes("public.secretary_logs");
};

const isMissingSecretaryLogsAudioColumn = (error) => {
  if (!error) return false;
  const code = `${error.code || ""}`.toUpperCase();
  const message = `${error.message || ""}`.toLowerCase();
  return code === "PGRST204" && message.includes("audio_url");
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
    const settings = extractUserSettings(userResult.data);
    if (typeof settings.tts_voice === "string" && settings.tts_voice.trim()) {
      return settings.tts_voice;
    }
  }

  return "lola";
};

export const processSecretaryInput = async (req, res, next) => {
  try {
    const { audioBase64, text, timezone, context } = req.body;
    
    // Save STT audio into storage backend
    let savedAudioUrl = null;
    if (audioBase64) {
      try {
        const buffer = Buffer.from(audioBase64, "base64");
        const path = `secretary_audio/${req.user?.id || "anonymous"}/${randomUUID()}.webm`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from("reminder-audio")
          .upload(path, buffer, { contentType: "audio/webm", upsert: true });
          
        if (!uploadError) {
          const { data: { publicUrl } } = supabaseAdmin.storage.from("reminder-audio").getPublicUrl(path);
          savedAudioUrl = publicUrl;
        }
      } catch (e) {
        console.error("STT Audio save failed:", e);
      }
    }

    const result = await runSecretaryPipeline({ audioBase64, text, timezone, context });

    const payload = {
      user_id: req.user.id,
      original_text: result.originalText,
      cleaned_text: result.cleanedText,
      parsed_data: result.parsed,
      audio_url: savedAudioUrl, // Extracted audio column reference
      created_at: new Date().toISOString(),
    };

    let saveResult = await supabaseAdmin.from("secretary_logs").insert(payload).select().single();
    if (saveResult.error && isMissingSecretaryLogsAudioColumn(saveResult.error)) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.audio_url;
      saveResult = await supabaseAdmin.from("secretary_logs").insert(fallbackPayload).select().single();
    }
    let savedLog = null;
    let logSaved = false;
    if (saveResult.error) {
      if (!isMissingSecretaryLogsTable(saveResult.error)) {
        assertSupabase(saveResult, "Failed to save secretary log");
      }
    } else {
      savedLog = saveResult.data;
      logSaved = true;
    }

    res.json(
      ok(
        {
          ...result,
          log: savedLog,
          log_saved: logSaved,
          audio_backed_up: !!savedAudioUrl
        },
        "Secretary input processed"
      )
    );
  } catch (error) {
    next(error);
  }
};

export const transcribeSecretaryAudio = async (req, res, next) => {
  try {
    const { audioBase64 } = req.body;
    if (!audioBase64) throw new Error("Audio is required");
    
    // Save STT audio trace
    if (audioBase64) {
      try {
        const buffer = Buffer.from(audioBase64, "base64");
        const path = `secretary_audio/${req.user?.id || "anonymous"}/${randomUUID()}_transcribe.webm`;
        await supabaseAdmin.storage
          .from("reminder-audio")
          .upload(path, buffer, { contentType: "audio/webm", upsert: true });
      } catch (e) {
        console.error("STT Audio trace save failed:", e);
      }
    }

    const text = await transcribeAudio({ audioBase64, language: "uz" });
    res.json(ok({ text }, "Audio transcribed"));
  } catch (error) {
    next(error);
  }
};

export const generateSecretaryReplyAudio = async (req, res, next) => {
  try {
    const text = String(req.body.text || "").trim();
    const voice = String(req.body.voice || "").trim() || (await loadUserTtsVoice(req.user.id));

    const audioBase64 = await generateTtsAudio({ text, voice });
    const audioUrl = await uploadReminderAudio({ userId: req.user.id, audioBase64 });

    res.json(ok({ audio_url: audioUrl, voice }, "Secretary reply audio generated"));
  } catch (error) {
    next(error);
  }
};
