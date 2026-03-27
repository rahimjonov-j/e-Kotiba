const normalizeApostrophes = (value) =>
  String(value || "")
    .replace(/[`’‘]/g, "'")
    .replace(/gʻ|g‘/g, "g'")
    .replace(/oʻ|o‘/g, "o'");

const toSentenceCase = (value) => {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const LETTERS = "A-Za-zА-Яа-яҚқҒғҲҳЎў'";
const NUMBER_WORDS = "bir|ikki|uch|to'rt|tort|besh|olti|yetti|sakkiz|to'qqiz|toqqiz|o'n|on";

const stemToMasdar = (stem) => {
  const normalized = String(stem || "").trim();
  if (!normalized) return "";

  return /[aeiou]$/i.test(normalized) || /o'$/i.test(normalized)
    ? `${normalized}sh`
    : `${normalized}ish`;
};

const stripRelativeLead = (value) =>
  String(value || "")
    .replace(new RegExp(`^\\s*(?:\\d+|${NUMBER_WORDS})\\s*(?:daq(?:iqa)?|dk|min(?:ut)?|soat|kun|hafta)(?:dan)?\\s+keyin\\s+`, "i"), "")
    .replace(/^\s*(bugun|ertaga|indin|kechqurun|ertalab|tushda)\s+/i, "")
    .trim();

const normalizeTaskGrammar = (value) => {
  let text = String(value || "");
  const compoundPattern = new RegExp(
    `\\b([${LETTERS}-]+?)gani\\s+(borish|ketish|chiqish)(?:im\\s+kerak|ingiz\\s+kerak|i\\s+kerak|\\s+kerak)?\\b`,
    "gi"
  );
  const infinitiveNeedPattern = new RegExp(`\\b([${LETTERS}-]+?(?:ish|sh))im\\s+kerak\\b`, "gi");
  const plainNeedPattern = new RegExp(`\\b([${LETTERS}-]+?(?:ish|sh))\\s+kerak\\b`, "gi");

  text = text.replace(compoundPattern, (_match, stem) => stemToMasdar(stem));
  text = text.replace(infinitiveNeedPattern, "$1");
  text = text.replace(plainNeedPattern, "$1");
  text = text.replace(/\bborishim kerak\b/gi, "borish");
  text = text.replace(/\bketishim kerak\b/gi, "ketish");

  return text;
};

const cleanReminderAction = (value) => {
  let text = stripRelativeLead(normalizeApostrophes(value))
    .replace(/\beslat(ib)?\s*(qo'y|qoy)?\b/gi, " ")
    .replace(/\b(eslatma|haqida|xaqida)\b/gi, " ")
    .replace(/\bmenga\b/gi, " ")
    .replace(/\bmeni\b/gi, " ")
    .replace(/\bmening\b/gi, " ")
    .replace(/\biltimos\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  text = text
    .replace(/\b(do'st)larim\b/gi, "$1laringiz")
    .replace(/\boilam\b/gi, "oilangiz")
    .replace(/\bfarzandlarim\b/gi, "farzandlaringiz")
    .replace(/\s+/g, " ")
    .trim();

  text = normalizeTaskGrammar(text)
    .replace(/\s+/g, " ")
    .trim();

  return text.replace(/[.!?]+$/g, "").trim();
};

export const buildDueReminderText = (value, fallback = "") => {
  const raw = cleanReminderAction(value || fallback);
  if (!raw) return "Sizda hozir rejalashtirilgan eslatma bor.";

  const normalized = toSentenceCase(raw)
    .replace(/\bvaqti\s+(bo'?ldi|keldi)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return `${normalized} vaqti bo'ldi.`;
};
