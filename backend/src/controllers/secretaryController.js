import { supabaseAdmin } from "../lib/supabase.js";
import { runSecretaryPipeline } from "../services/secretaryService.js";
import { transcribeAudio } from "../services/aiService.js";
import { ok } from "../utils/response.js";
import { assertSupabase } from "../utils/db.js";

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
