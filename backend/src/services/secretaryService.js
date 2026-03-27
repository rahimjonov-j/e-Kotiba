import { transcribeAudio, processWithOpenAi } from "./aiService.js";
import { AppError } from "../utils/errors.js";

export const runSecretaryPipeline = async ({ audioBase64, text, timezone = "Asia/Tashkent", context = {} }) => {
  if (!audioBase64 && !text) {
    throw new AppError("Either audio or text input is required", 422);
  }

  const originalText = audioBase64
    ? await transcribeAudio({ audioBase64, language: "uz" })
    : text;

  if (!originalText || !originalText.trim()) {
    throw new AppError("Input text is empty after transcription", 422);
  }

  const aiOutput = await processWithOpenAi({
    rawText: originalText,
    mode: "reminder_extraction",
    context: { timezone, ...context },
  });

  return {
    originalText,
    cleanedText: aiOutput.cleaned_text || originalText,
    parsed: {
      intent: aiOutput.intent || "unknown",
      title: aiOutput.meeting?.title || aiOutput.expense?.title || aiOutput.title || "Reminder",
      note: aiOutput.note || aiOutput.cleaned_text || originalText,
      datetimeIso: aiOutput.meeting?.datetime || aiOutput.datetime_iso || aiOutput.datetime || null,
      monthlySalary: aiOutput.monthly_salary ?? null,
      recurrence: aiOutput.recurrence || "none",
      reminderMessage: aiOutput.reminder_message || aiOutput.note || aiOutput.title || null,
      person: aiOutput.meeting?.person || aiOutput.person || null,
      expense: aiOutput.expense || null,
      frequencyValue: aiOutput.frequency?.value ?? null,
      frequencyUnit: aiOutput.frequency?.unit ?? null,
      confidence: aiOutput.confidence ?? 0.7,
      recommendations: aiOutput.recommendations || [],
      reply: aiOutput.reply || aiOutput.confirmation_text || null,
    },
  };
};
