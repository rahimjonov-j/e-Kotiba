import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import { buildDueReminderText } from "../utils/reminderText.js";

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

const fileUrlToBase64 = async (fileUrl) => {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new AppError(`Failed to download generated audio: ${response.statusText}`, response.status || 502);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
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

  const supportedVoices = new Set(["lola", "shoira", "Fotima-angry"]);
  const voiceModel = supportedVoices.has(voice) ? voice : "lola";
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

  const directAudioBase64 = data.audio_base64 || data.audio || data.result?.audio_base64 || data.data?.audio_base64;
  if (directAudioBase64) {
    return directAudioBase64;
  }

  const audioUrl = data.result?.url || data.data?.result?.url || data.url;
  if (audioUrl) {
    return fileUrlToBase64(audioUrl);
  }

  if (!directAudioBase64) {
    throw new AppError("TTS response missing audio", 422);
  }
};

const inferIntent = (text) => {
  const lower = text.toLowerCase();
  if (lower.includes("oylik maosh") || lower.includes("maoshim") || lower.includes("maosh")) return "unknown";
  if (lower.includes("uchrash") || lower.includes("meeting")) return "meeting";
  if (lower.includes("eslat") || lower.includes("remind") || lower.includes("vazifa") || lower.includes("todo")) return "reminder";
  if (lower.includes("kerak") || lower.includes("qilishim") || lower.includes("bajarishim")) return "task";
  if (
    lower.includes("pul") ||
    lower.includes("so'm") ||
    lower.includes("som") ||
    lower.includes("dollar") ||
    lower.includes("usd") ||
    lower.includes("rubl") ||
    lower.includes("rub") ||
    lower.includes("ishlatdim") ||
    lower.includes("xarajat")
  ) {
    return "expense";
  }
  return "unknown";
};

const parseAmountToken = (rawNumber, rawUnit = "") => {
  const normalizedNumber = Number(String(rawNumber || "").replace(/,/g, "."));
  if (!Number.isFinite(normalizedNumber)) return null;

  const unit = String(rawUnit || "").toLowerCase();
  if (unit.includes("million") || unit.includes("mln")) return Math.round(normalizedNumber * 1_000_000);
  if (unit.includes("ming")) return Math.round(normalizedNumber * 1_000);
  return Math.round(normalizedNumber);
};

const normalizeWordToken = (token) =>
  String(token || "")
    .toLowerCase()
    .replace(/[`ï¿½ï¿½']/g, "'")
    .replace(/gï¿½|gï¿½/g, "g'")
    .replace(/oï¿½|oï¿½/g, "o'")
    .replace(/[^a-z0-9']/g, "");

const parseUzbekNumberWords = (text) => {
  const normalized = String(text || "")
    .toLowerCase()
    .replace(/[`ï¿½ï¿½']/g, "'")
    .replace(/gï¿½|gï¿½/g, "g'")
    .replace(/oï¿½|oï¿½/g, "o'");

  const smallNumbers = {
    nol: 0,
    bir: 1,
    ikki: 2,
    uch: 3,
    tort: 4,
    "to'rt": 4,
    besh: 5,
    olti: 6,
    yetti: 7,
    sakkiz: 8,
    toqqiz: 9,
    "to'qqiz": 9,
    on: 10,
    "o'n": 10,
    yigirma: 20,
    ottiz: 30,
    "o'ttiz": 30,
    qirq: 40,
    ellik: 50,
    oltmish: 60,
    yetmish: 70,
    sakson: 80,
    toqsan: 90,
    "to'qson": 90,
  };

  const multipliers = {
    yuz: 100,
    ming: 1000,
    million: 1000000,
    mln: 1000000,
  };

  let current = 0;
  let total = 0;
  let matched = false;

  for (const rawToken of normalized.split(/\s+/)) {
    const token = normalizeWordToken(rawToken);
    if (!token) continue;

    if (smallNumbers[token] !== undefined) {
      current += smallNumbers[token];
      matched = true;
      continue;
    }

    if (token === "yuz") {
      current = Math.max(current, 1) * 100;
      matched = true;
      continue;
    }

    if (token === "ming" || token === "million" || token === "mln") {
      total += Math.max(current, 1) * multipliers[token];
      current = 0;
      matched = true;
      continue;
    }
  }

  if (!matched) return null;
  return total + current;
};

const extractMonthlySalary = (text) => {
  const lower = String(text || "").toLowerCase();
  if (!lower.includes("maosh")) return null;

  const compact = lower.replace(/\s+/g, " ").trim();
  const amountMatch =
    compact.match(/(\d+(?:[.,]\d+)?)\s*(million|mln|ming|so'm|som|uzs)?/) ||
    compact.match(/(\d[\d\s.]*)\s*(million|mln|ming|so'm|som|uzs)?/);

  if (amountMatch) {
    const digits = String(amountMatch[1] || "").replace(/\s+/g, "").replace(/(?<=\d)\.(?=\d{3}\b)/g, "");
    const parsedNumeric = parseAmountToken(digits, amountMatch[2]);
    if (parsedNumeric) return parsedNumeric;
  }

  return parseUzbekNumberWords(lower);
};

const extractExpenseCurrency = (text) => {
  const lower = String(text || "").toLowerCase();
  if (/\b(usd|dollar|dollor)\b/.test(lower)) return "USD";
  if (/\b(rub|rubl|ruble|rubli)\b/.test(lower)) return "RUB";
  return "UZS";
};

const normalizeRelativeTimeText = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/\bdaq\b/g, "daqiqa")
    .replace(/\bdk\b/g, "daqiqa")
    .replace(/\bmin\b/g, "minut");

const parseRelativeAmount = (rawAmount) => {
  const compact = String(rawAmount || "").trim();
  if (!compact) return null;

  const numeric = Number(compact);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  const wordValue = parseUzbekNumberWords(compact);
  if (Number.isFinite(wordValue) && wordValue > 0) {
    return wordValue;
  }

  return null;
};

const extractExpenseAmount = (text) => {
  const lower = String(text || "").toLowerCase();
  const explicitMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(million|mln|ming)?\s*(so'm|som|uzs|usd|dollar|dollor|rub|rubl|ruble)?/);
  if (explicitMatch) {
    const amount = parseAmountToken(explicitMatch[1], explicitMatch[2]);
    if (amount) return amount;
  }

  return parseUzbekNumberWords(lower);
};

const buildExpenseFallback = (cleaned) => {
  const amount = extractExpenseAmount(cleaned);
  const currency = extractExpenseCurrency(cleaned);
  if (!amount) return null;

  return {
    title: cleaned.split(" ").slice(0, 4).join(" ") || "Xarajat",
    amount,
    currency,
    date: new Date().toISOString().slice(0, 10),
  };
};

const inferFrequency = (text) => {
  const lower = normalizeRelativeTimeText(text);
  if (lower.includes("har kuni") || lower.includes("daily")) return { value: 1, unit: "day", recurrence: "daily" };
  if (lower.includes("har hafta") || lower.includes("weekly")) return { value: 1, unit: "week", recurrence: "weekly" };
  if (lower.includes("har oy") || lower.includes("monthly")) return { value: 1, unit: "custom", recurrence: "monthly" };

  const numMatch = lower.match(/(\d+)/);
  const wordMatch = lower.match(/\b(bir|ikki|uch|to'rt|tort|besh|olti|yetti|sakkiz|to'qqiz|toqqiz|o'n|on)\b/);
  const value = numMatch ? Number(numMatch[1]) : parseRelativeAmount(wordMatch?.[1]) || 1;

  if (lower.includes("daqiqa") || lower.includes("minut")) return { value, unit: "minute", recurrence: "none" };
  if (lower.includes("soat") || lower.includes("hour")) return { value, unit: "hour", recurrence: "none" };
  if (lower.includes("kun")) return { value: 1, unit: "day", recurrence: "daily" };
  if (lower.includes("hafta")) return { value: 1, unit: "week", recurrence: "weekly" };

  return { value: null, unit: null, recurrence: "none" };
};

const inferRelativeDateTime = (text) => {
  const lower = normalizeRelativeTimeText(text);
  const now = new Date();

  const relativeMatch = lower.match(/(\d+|bir|ikki|uch|to'rt|tort|besh|olti|yetti|sakkiz|to'qqiz|toqqiz|o'n|on)\s*(daqiqa|minut|soat|kun|hafta)(?:dan)?\s*keyin/);
  if (!relativeMatch) return null;

  const amount = parseRelativeAmount(relativeMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = relativeMatch[2];
  const target = new Date(now);

  if (unit.includes("daqiqa") || unit.includes("minut")) {
    target.setMinutes(target.getMinutes() + amount);
  } else if (unit.includes("soat")) {
    target.setHours(target.getHours() + amount);
  } else if (unit.includes("kun")) {
    target.setDate(target.getDate() + amount);
  } else if (unit.includes("hafta")) {
    target.setDate(target.getDate() + amount * 7);
  } else {
    return null;
  }

  return target.toISOString();
};

const hasExplicitRelativeDateTime = (text) => Boolean(inferRelativeDateTime(text));

const buildReminderMessage = ({ title, cleanedText }) => {
  return buildDueReminderText(title || cleanedText, cleanedText || title);
};

const localReminderExtraction = (rawText) => {
  const cleaned = String(rawText || "").replace(/\s+/g, " ").trim();
  const intent = inferIntent(cleaned);
  const frequency = inferFrequency(cleaned);
  const title = cleaned.split(" ").slice(0, 6).join(" ") || "Yangi eslatma";
  const monthlySalary = extractMonthlySalary(cleaned);
  const expense = intent === "expense" ? buildExpenseFallback(cleaned) : null;

  return {
    cleaned_text: cleaned,
    intent,
    title,
    note: cleaned,
    datetime_iso: inferRelativeDateTime(cleaned),
    recurrence: frequency.recurrence,
    reminder_message: buildReminderMessage({ title, cleanedText: cleaned }),
    expense,
    frequency,
    confidence: 0.55,
    recommendations: [
      "Agar vaqt aytilmasa ham eslatma ro'yxatga qo'shiladi.",
      "Muhim vazifalar uchun audio eslatmani yoqib qo'ying.",
    ],
    monthly_salary: monthlySalary,
    reply:
      monthlySalary
        ? `Tushundim, oylik maoshingiz ${monthlySalary.toLocaleString("uz-UZ")} so'm qilib saqlandi.`
        :
      intent === "meeting"
        ? "Tushundim, yangi uchrashuv belgilandi."
        : intent === "task"
          ? "Vazifa qabul qilindi."
      : "Eslatma qabul qilindi.",
    source: "local_fallback",
  };
};

const buildReminderPrompt = (rawText, context = {}) => {
  const now = new Date().toISOString();
  return `Sen Online Kotiba parsersan. Faqat JSON qaytar.

Intent faqat quyidagilardan biri bo'lsin: "meeting", "reminder", "task", "expense", "unknown".

Qoidalar:
1) Agar foydalanuvchi eslatishni, vazifani yoki keyin bajariladigan ishni aytsa intent="reminder".
2) Agar uchrashuv bo'lsa intent="meeting".
3) Agar oddiy bajariladigan ish bo'lsa intent="task".
4) Xarajat bo'lsa intent="expense".
5) Qolgan hammasi intent="unknown".
5) Sana/vaqtni imkon qadar ISO formatga o'tkaz.
6) Vaqt aytilmagan bo'lsa datetime null qoldir.
7) Recurrence qiymati faqat: "none", "daily", "weekly", "monthly".
8) Agar foydalanuvchi "5 minutdan keyin", "6 daqiqadan keyin", "2 soatdan keyin" desa, aynan shu muddatni saqla. Uni 1 minutga yoki boshqa taxminiy vaqtga o'zgartirma.

JSON shakli:
{
  "intent":"reminder|meeting|task|expense|unknown",
  "cleaned_text":"...",
  "title":"...",
  "note":"...",
  "datetime_iso":"2026-03-27T09:00:00+05:00 yoki null",
  "recurrence":"none|daily|weekly|monthly",
  "reminder_message":"...",
  "monthly_salary": 0 yoki null,
  "meeting":{"title":"...","datetime":"...","person":"..."} yoki null,
  "expense":{"title":"...","amount":0,"currency":"UZS|USD|RUB","date":"YYYY-MM-DD"} yoki null,
  "reply":"foydalanuvchiga qisqa javob"
}

Hozirgi vaqt: ${now}
Timezone: ${context.timezone || "Asia/Tashkent"}
Context datetime: ${context.datetimeIso || "null"}
Maxsus qoida:
- Agar foydalanuvchi oylik maoshi yoki maosh miqdorini aytsa, monthly_salary maydoniga UZS formatida faqat raqam qaytar.
- Bunday holatda foydali qisqa reply yoz va boshqa maydonlarni ham imkon qadar to'ldir, lekin monthly_salary ni bo'sh qoldirma.
- reminder_message foydalanuvchiga ikkinchi shaxsdagi tabiiy eslatma bo'lsin.
- Birinchi shaxs shakllarini ishlatma: "borishim kerak", "do'stlarim", "menga eslat".
- To'g'ri misol: "Do'stlaringiz bilan futbolga borish vaqti bo'ldi."
- To'g'ri misol: "5 minutdan keyin eslat" bo'lsa datetime aynan hozirgi vaqtdan 5 minut keyin bo'lishi kerak.
Matn: ${rawText}`;
};

const callOpenAiWithRetry = async ({ systemPrompt, userPrompt, jsonMode = false, temperature = 0.1 }) => {
  const url = "https://api.openai.com/v1/chat/completions";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const data = await callJsonEndpoint({
        url,
        headers: {
          Authorization: `Bearer ${env.openAiApiKey}`,
        },
        body: {
          model: env.openAiModel,
          temperature,
          response_format: jsonMode ? { type: "json_object" } : undefined,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        },
      });

      return data?.choices?.[0]?.message?.content || "";
    } catch (error) {
      const retryable = error.statusCode === 429 || String(error.message || "").toLowerCase().includes("rate limit");
      if (!retryable || attempt === 1) throw error;
      await sleep(4000);
    }
  }

  throw new AppError("OpenAI call failed", 502);
};

export const processWithOpenAi = async ({ rawText, mode = "reminder_extraction", context = {} }) => {
  if (!env.openAiApiKey) {
    return mode === "cleanup"
      ? { cleaned_text: String(rawText || "").replace(/\s+/g, " ").trim(), source: "local_fallback" }
      : localReminderExtraction(rawText);
  }

  try {
    const isJsonMode = mode !== "cleanup";
    let prompt;
    if (mode === "cleanup") {
      prompt = `Matnni o'zbek tilida imloviy tozalab ber. Faqat tozalangan matnni qaytar.\n\n${rawText}`;
    } else if (mode === "dashboard_insights") {
      prompt = `Siz mahsuldorlik bo'yicha mutaxassis kotibasan. Quyidagi ko'rsatkichlar asosida foydalanuvchiga 4 ta qisqa va amaliy maslahat ber (o'zbek tilida).
Javobni FAQAT JSON formatida qaytar: {"recommendations": ["...", "...", "...", "..."]}

Ko'rsatkichlar:
${rawText}`;
    } else {
      prompt = buildReminderPrompt(rawText, context);
    }

    const text = await callOpenAiWithRetry({
      systemPrompt:
        mode === "cleanup"
          ? "Siz o'zbek tilidagi matnni tozalovchi yordamchisiz. Faqat tayyor matn qaytaring."
          : "Siz Online Kotiba AI parsersiz. Faqat so'ralgan formatdagi javobni qaytaring.",
      userPrompt: prompt,
      jsonMode: isJsonMode,
    });

    if (!text) {
      throw new AppError("LLM returned empty response", 422);
    }

    if (mode === "cleanup") {
      return { cleaned_text: text.trim(), source: "openai" };
    }

    if (mode === "dashboard_insights") {
      const parsedDashboard = extractJsonFromText(text.trim());
      if (parsedDashboard?.recommendations && Array.isArray(parsedDashboard.recommendations)) {
        return {
          cleaned_text: parsedDashboard.recommendations.join("\n"),
          recommendations: parsedDashboard.recommendations,
          source: "openai",
        };
      }
      return { cleaned_text: text.trim(), source: "openai" };
    }

    const parsed = extractJsonFromText(text.trim());
    if (!parsed) {
      throw new AppError("LLM JSON parse failed", 422, { raw: text });
    }

    const intent = ["meeting", "reminder", "task", "expense", "unknown"].includes(parsed.intent)
      ? parsed.intent
      : parsed.meeting
        ? "meeting"
        : parsed.expense
          ? "expense"
          : "unknown";

    const normalizedRecurrence = ["none", "daily", "weekly", "monthly"].includes(parsed.recurrence)
      ? parsed.recurrence
      : "none";
    const monthlySalary = Number(
      parsed.monthly_salary ??
      parsed.salary?.monthly_salary ??
      parsed.extra?.monthly_salary ??
      extractMonthlySalary(rawText) ??
      0
    );
    const hasMonthlySalary = Number.isFinite(monthlySalary) && monthlySalary > 0;

    const fallbackDateTime = inferRelativeDateTime(rawText);
    const resolvedDateTime = hasExplicitRelativeDateTime(rawText)
      ? fallbackDateTime
      : parsed.meeting?.datetime || parsed.datetime_iso || parsed.datetime || fallbackDateTime || null;
    const resolvedTitle = parsed.meeting?.title || parsed.expense?.title || parsed.title || "Yangi eslatma";
    const resolvedCleanedText = parsed.cleaned_text || resolvedTitle || String(rawText || "").trim();
    const resolvedReminderMessage =
      parsed.reminder_message ||
      buildReminderMessage({ title: resolvedTitle, cleanedText: resolvedCleanedText });

    return {
      cleaned_text: resolvedCleanedText,
      intent,
      title: resolvedTitle,
      note: parsed.note || parsed.cleaned_text || String(rawText || "").trim(),
      datetime_iso: resolvedDateTime,
      recurrence: normalizedRecurrence,
      reminder_message: resolvedReminderMessage,
      expense: parsed.expense
        ? {
            ...parsed.expense,
            currency: ["UZS", "USD", "RUB"].includes(String(parsed.expense.currency || "").toUpperCase())
              ? String(parsed.expense.currency).toUpperCase()
              : extractExpenseCurrency(rawText),
          }
        : null,
      meeting: parsed.meeting || null,
      frequency: {
        value: parsed.frequency?.value ?? null,
        unit: parsed.frequency?.unit ?? null,
      },
      monthly_salary: hasMonthlySalary ? monthlySalary : null,
      confidence: parsed.confidence ?? 0.9,
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      reply:
        parsed.confirmation_text ||
        parsed.reply ||
        (hasMonthlySalary
          ? `Tushundim, oylik maoshingiz ${monthlySalary.toLocaleString("uz-UZ")} so'm qilib saqlandi.`
          : intent === "meeting"
            ? "Tushundim, yangi uchrashuv belgilandi."
            : "Eslatma qabul qilindi."),
      source: "openai",
      raw_parsed: parsed,
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

  const data = await processWithOpenAi({ rawText: prompt, mode: "dashboard_insights" });
  return data.recommendations || [];
};



