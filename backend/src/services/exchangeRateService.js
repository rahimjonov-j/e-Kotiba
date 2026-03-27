import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

const FALLBACK_BASE_CURRENCY = "UZS";
const SUPPORTED_CURRENCIES = new Set(["UZS", "USD", "RUB"]);
const CACHE_TTL_MS = 15 * 60 * 1000;

let cachedRates = null;
let cachedAt = 0;

const normalizeCurrency = (currency) => String(currency || FALLBACK_BASE_CURRENCY).trim().toUpperCase();

const parseRateNumber = (value) => {
  const normalized = String(value || "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const fetchRatesFromCbu = async () => {
  const response = await fetch(env.cbuExchangeRatesUrl);

  if (!response.ok) {
    throw new AppError(`Exchange rate source error: ${response.statusText}`, response.status || 502);
  }

  const payload = await response.json();
  const items = Array.isArray(payload) ? payload : [];
  const rates = new Map([[FALLBACK_BASE_CURRENCY, { rate: 1, nominal: 1, date: null }]]);

  for (const item of items) {
    const code = normalizeCurrency(item?.Ccy);
    const rate = parseRateNumber(item?.Rate);
    const nominal = parseRateNumber(item?.Nominal) || 1;
    const date = String(item?.Date || "").trim() || null;

    if (!SUPPORTED_CURRENCIES.has(code) || !rate) continue;

    rates.set(code, { rate, nominal, date });
  }

  return rates;
};

const getRates = async () => {
  const now = Date.now();
  if (cachedRates && now - cachedAt < CACHE_TTL_MS) {
    return cachedRates;
  }

  cachedRates = await fetchRatesFromCbu();
  cachedAt = now;
  return cachedRates;
};

export const convertToUzs = async ({ amount, currency }) => {
  const normalizedCurrency = normalizeCurrency(currency);
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new AppError("Expense amount must be a positive number", 422);
  }

  if (!SUPPORTED_CURRENCIES.has(normalizedCurrency)) {
    throw new AppError("Only UZS, USD and RUB are supported for expense conversion", 422);
  }

  if (normalizedCurrency === FALLBACK_BASE_CURRENCY) {
    return {
      currency: normalizedCurrency,
      originalAmount: numericAmount,
      uzsAmount: Number(numericAmount.toFixed(2)),
      exchangeRate: 1,
      exchangeRateDate: null,
    };
  }

  const rates = await getRates();
  const entry = rates.get(normalizedCurrency);

  if (!entry?.rate || !entry?.nominal) {
    throw new AppError(`Exchange rate for ${normalizedCurrency} is unavailable`, 502);
  }

  const unitRate = entry.rate / entry.nominal;
  const uzsAmount = numericAmount * unitRate;

  return {
    currency: normalizedCurrency,
    originalAmount: Number(numericAmount.toFixed(2)),
    uzsAmount: Number(uzsAmount.toFixed(2)),
    exchangeRate: Number(unitRate.toFixed(6)),
    exchangeRateDate: entry.date,
  };
};

export const normalizeExpenseCurrency = normalizeCurrency;
