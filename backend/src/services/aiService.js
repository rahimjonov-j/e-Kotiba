import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

const safeJsonParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const extractJsonFromText = (text) => {
  if (!text) return null;
  const cleaned = String(text).trim().replace(/```json|```/gi, "").trim();

  const direct = safeJsonParse(cleaned);
  if (direct) return direct;

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return safeJsonParse(cleaned.slice(start, end + 1));
  }

  return null;
};

const callJsonEndpoint = async ({ url, method = "POST", headers = {}, body }) => {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    const parsed = safeJsonParse(text);
    const statusCode = response.status || 502;
    const apiMessage = parsed?.error?.message || text || response.statusText;
    throw new AppError(`External API error: ${apiMessage}`, statusCode, {
      status: parsed?.error?.status,
      response: parsed || text,
    });
  }

  return response.json();
};

const callMultipartEndpoint = async ({ url, headers = {}, formData }) => {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    const parsed = safeJsonParse(text);
    const apiMessage = parsed?.error?.message || text || response.statusText;
    throw new AppError(`External API error: ${apiMessage}`, response.status || 502, {
      status: parsed?.error?.status,
      response: parsed || text,
    });
  }

  return response.json();
};

export const transcribeAudio = async ({ audioBase64, language = "uz" }) => {
  if (!env.uzbekVoiceSttUrl || !env.uzbekVoiceSttApiKey) {
    throw new AppError("STT is not configured", 500);
  }

  const audioBuffer = Buffer.from(audioBase64, "base64");
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: "audio/webm" }), "recording.webm");
  formData.append("return_offsets", "false");
  formData.append("run_diarization", "false");
  formData.append("language", language);
  formData.append("blocking", "true");

  const data = await callMultipartEndpoint({
    url: env.uzbekVoiceSttUrl,
    headers: { Authorization: env.uzbekVoiceSttApiKey },
    formData,
  });

  const text = data.text || data.transcript || data.result?.text || data.data?.text || "";
  if (!text) throw new AppError("STT returned empty transcript", 422);
  return text;
};

export const generateTtsAudio = async ({ text, voice = "female_uz" }) => {
  if (!env.uzbekVoiceTtsUrl || !env.uzbekVoiceTtsApiKey) {
    throw new AppError("TTS is not configured", 500);
  }

  const voiceModel = voice === "female_uz" ? "lola" : voice || "lola";
  let data;
  try {
    data = await callJsonEndpoint({
      url: env.uzbekVoiceTtsUrl,
      headers: { Authorization: env.uzbekVoiceTtsApiKey },
      body: {
        text,
        model: voiceModel,
        blocking: "true",
      },
    });
  } catch (error) {
    if (voiceModel !== "lola") {
      data = await callJsonEndpoint({
        url: env.uzbekVoiceTtsUrl,
        headers: { Authorization: env.uzbekVoiceTtsApiKey },
        body: {
          text,
          model: "lola",
          blocking: "true",
        },
      });
    } else {
      throw error;
    }
  }

  const audioBase64 = data.audio_base64 || data.audio || data.result?.audio_base64 || data.data?.audio_base64;
  if (!audioBase64) {
    throw new AppError("TTS response missing audio", 422);
  }

  return audioBase64;
};

const inferIntent = (text) => {
  const lower = text.toLowerCase();
  if (lower.includes("uchrash") || lower.includes("meeting")) return "meeting";
  if (lower.includes("eslat") || lower.includes("remind")) return "reminder";
  if (lower.includes("pul") || lower.includes("so'm") || lower.includes("som") || lower.includes("ishlatdim") || lower.includes("xarajat")) return "expense";
  return "note";
};

const inferFrequency = (text) => {
  const lower = text.toLowerCase();
  const numMatch = lower.match(/(\d+)/);
  const value = numMatch ? Number(numMatch[1]) : 1;

  if (lower.includes("daqiqa") || lower.includes("minut")) return { value, unit: "minute" };
  if (lower.includes("soat") || lower.includes("hour")) return { value, unit: "hour" };
  if (lower.includes("kun") || lower.includes("daily") || lower.includes("har kuni")) return { value: 1, unit: "day" };
  if (lower.includes("hafta") || lower.includes("week")) return { value: 1, unit: "week" };
  return { value: null, unit: null };
};

const localReminderExtraction = (rawText) => {
  const cleaned = String(rawText || "").replace(/\s+/g, " ").trim();
  const intent = inferIntent(cleaned);
  const frequency = inferFrequency(cleaned);
  const title = cleaned.split(" ").slice(0, 6).join(" ") || "Eslatma";

  return {
    cleaned_text: cleaned,
    intent,
    title,
    datetime_iso: null,
    frequency,
    confidence: 0.55,
    recommendations: [
      "Iltimos, uchrashuv vaqtini yoki kim bilanligini ayting.",
      "Ahamiyatli uchrashuvlar uchun audio eslatmani yoqing.",
    ],
    reply: "Tushundim, yangi uchrashuv belgilandi.",
    source: "local_fallback",
  };
};

const buildReminderPrompt = (rawText, context = {}) => {
  const now = new Date().toISOString();
  return `# AI Kotiba — UNIVERSAL PARSER (MEETING + EXPENSE)

Sen aqlli AI kotibasan. Foydalanuvchi gapidan 2 xil narsani aniqlaysan:
1. 📅 UCHRASHUV (intent: "meeting")
2. 💰 HARAJAT (intent: "expense")

Sen HECH QACHON "tushunmadim" demaysan.
Har doim maksimal darajada parse qilasan.

---

# 🎯 INTENT ANIQLASH

Agar gapda:
- uchrashuv / meeting / belgila / qo‘y → "meeting"
- pul / so‘m / dollar / ishlatdim / xarajat → "expense"

---

# 📅 MEETING LOGIC (KRITIK)

## ✅ SUCCESS OUTPUT JAVOBI (ENG MUHIM)
Har doim uchrashuv to'laqonli bo'lganda (ism + vaqt), "confirmation_text" maydoniga FAQAT va FAQAT ushbu matnni yozasan:
"Tushundim, yangi uchrashuv belgilandi."

Agar ism yoki vaqt yetishmasa, savol berishing mumkin, lekin muvaffaqiyatli bo'lsa yuqoridagidan boshqasini yozma!

---

## ⏰ VAQT (ENG MUHIM)
- sakkiz → 08:00
- 8 ga / 8 da → 08:00
- 8 00 → 08:00
- sakkiz u nol nol → 08:00
- sakkiz u o'ttiz → 08:30
- yarim to‘qqiz → 08:30

## 📅 SANA
- bugun → current date
- ertaga → +1 kun
- indin → +2 kun

## 👤 PERSON
- bobur bilan → Bobur
- aslxon bn → Aslxon

Agar ism yo‘q bo‘lsa, intentni \`incomplete_meeting\` deb belgilagin.

---

# 💰 EXPENSE LOGIC (YANGI)

## ✅ EXPENSE SUCCESS JAVOBI
Xarajat kiritilganda "confirmation_text" maydoniga har doim shunday matn yoz:
"[SUMMA] so‘m [NIMA UCHUN] uchun xarajat qo‘shildi."

---

# ✅ OUTPUT FORMAT (HAR DOIM JSON)

## Meeting to'liq bo'lsa:
{
  "success": true,
  "intent": "meeting",
  "confirmation_text": "Tushundim, yangi uchrashuv belgilandi.",
  "meeting": {
    "title": "Aslxon bilan uchrashuv",
    "datetime": "2026-03-28T08:00:00",
    "display_time": "28.03.2026 08:00",
    "person": "Aslxon"
  }
}

## Meeting ism yo'q bo'lsa:
{
  "success": false,
  "intent": "incomplete_meeting",
  "confirmation_text": "Ertaga 08:00 ga uchrashuv. Kim bilan?",
  "datetime": "2026-03-28T08:00:00"
}

## Expense bo'lsa:
{
  "success": true,
  "intent": "expense",
  "confirmation_text": "25 000 so‘m kofe uchun xarajat qo‘shildi.",
  "expense": {
    "title": "kofe",
    "amount": 25000,
    "currency": "UZS",
    "date": "2026-03-27"
  }
}

---

# ❌ TAQIQLANGAN JAVOBLAR
Hech qachon yozma: "tushunmadim", "aniqroq ayting", "muvaffaqiyatli qo‘shildi".

# 🔥 CONTEXT (XOTIRA)
Xotiradagi vaqt: ${context.datetimeIso || "Yo'q"} (agar foydalanuvchi hozir ism aytsa, shu vaqtdan foydalan).

Hozirgi vaqt: ${now}
Timezone: ${context.timezone || "Asia/Tashkent"}
Foydalanuvchi kiritgan tekst: ${rawText}`;
};

const callGeminiWithRetry = async ({ prompt, temperature = 0.1, responseMimeType = "text/plain" }) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const data = await callJsonEndpoint({
        url,
        body: {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            responseMimeType,
          },
        },
      });
      return data;
    } catch (error) {
      const retryable = error.statusCode === 429 || String(error.message || "").includes("RESOURCE_EXHAUSTED");
      if (!retryable || attempt === 1) throw error;

      const retryMs = 8000;
      await sleep(retryMs);
    }
  }

  throw new AppError("Gemini call failed", 502);
};

export const processWithGemini = async ({ rawText, mode = "reminder_extraction", context = {} }) => {
  if (!env.geminiApiKey) {
    return mode === "cleanup"
      ? { cleaned_text: String(rawText || "").replace(/\s+/g, " ").trim(), source: "local_fallback" }
      : localReminderExtraction(rawText);
  }

  try {
    const isJsonMode = mode !== "cleanup";
    let prompt;
    if (mode === "cleanup") {
      prompt = `Matnni o'zbek tilida tozalang va faqat toza matn qaytaring: ${rawText}`;
    } else if (mode === "dashboard_insights") {
      prompt = `Siz mahsuldorlik bo'yicha mutaxassis kotibasan. Quyidagi ko'rsatkichlar asosida foydalanuvchiga 4 ta qisqa va amaliy maslahat ber (o'zbek tilida). 
Javobni FAQAT JSON formatida qaytar: {"recommendations": ["...", "...", "...", "..."]}

Ko'rsatkichlar:
${rawText}`;
    } else {
      prompt = buildReminderPrompt(rawText, context);
    }

    const data = await callGeminiWithRetry({
      prompt,
      responseMimeType: isJsonMode ? "application/json" : "text/plain"
    });

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new AppError("Gemini returned empty response", 422);
    }

    if (mode === "cleanup" || mode === "dashboard_insights") {
      return { cleaned_text: text.trim(), source: "gemini" };
    }

    const parsed = extractJsonFromText(text.trim());
    if (!parsed) {
      throw new AppError("Gemini JSON parse failed", 422, { raw: text });
    }

    const intent = parsed.intent || (parsed.meeting ? "meeting" : (parsed.expense ? "expense" : "note"));

    return {
      cleaned_text: parsed.cleaned_text || parsed.meeting?.title || parsed.expense?.title || String(rawText || "").trim(),
      intent: intent,
      title: parsed.meeting?.title || parsed.expense?.title || parsed.title || "Eslatma",
      datetime_iso: parsed.meeting?.datetime || parsed.datetime_iso || parsed.datetime || null,
      expense: parsed.expense || null,
      meeting: parsed.meeting || null,
      frequency: {
        value: parsed.frequency?.value ?? null,
        unit: parsed.frequency?.unit ?? null,
      },
      confidence: parsed.confidence ?? 0.9,
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      reply: parsed.confirmation_text || parsed.reply || "Tushundim, yangi uchrashuv belgilandi.",
      source: "gemini",
      raw_parsed: parsed
    };
  } catch (error) {
    if (mode === "cleanup") {
      return { cleaned_text: String(rawText || "").replace(/\s+/g, " ").trim(), source: "local_fallback" };
    }
    return localReminderExtraction(rawText);
  }
};

export const generateRecommendations = async ({ remindersCount, meetingsCount, expensesSummary }) => {
  const prompt = `Return JSON only with this shape: {"recommendations":["..."]}. Generate 4 concise productivity recommendations.
Context: reminders=${remindersCount}, meetings=${meetingsCount}, expenses=${JSON.stringify(expensesSummary)}`;

  const data = await processWithGemini({ rawText: prompt, mode: "cleanup" });
  return data.cleaned_text;
};
