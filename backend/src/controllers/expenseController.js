import { supabaseAdmin } from "../lib/supabase.js";
import { ok } from "../utils/response.js";
import { assertSupabase } from "../utils/db.js";
import { convertToUzs, normalizeExpenseCurrency } from "../services/exchangeRateService.js";

const isMissingExpenseOptionalColumns = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42703" ||
    (code === "PGRST204" &&
      (message.includes("original_amount") ||
        message.includes("currency") ||
        message.includes("exchange_rate") ||
        message.includes("exchange_rate_date") ||
        message.includes("title") ||
        message.includes("note") ||
        message.includes("spent_at")))
  );
};

export const createExpense = async (req, res, next) => {
  try {
    const {
      amount,
      currency = "UZS",
      category,
      date,
      title = null,
      note = null,
      spent_at = null,
    } = req.body;

    const converted = await convertToUzs({ amount, currency });
    const payload = {
      user_id: req.user.id,
      amount: converted.uzsAmount,
      category,
      date,
      title,
      note,
      spent_at,
      original_amount: converted.originalAmount,
      currency: converted.currency,
      exchange_rate: converted.exchangeRate,
      exchange_rate_date: converted.exchangeRateDate,
    };

    let result = await supabaseAdmin
      .from("expenses")
      .insert(payload)
      .select()
      .single();

    if (result.error && isMissingExpenseOptionalColumns(result.error)) {
      result = await supabaseAdmin
        .from("expenses")
        .insert({
          user_id: req.user.id,
          amount: converted.uzsAmount,
          category,
          date,
        })
        .select()
        .single();
    }

    const expense = assertSupabase(result, "Failed to create expense");
    res.status(201).json(
      ok(
        {
          expense: {
            ...expense,
            amount: Number(expense.amount || converted.uzsAmount),
            original_amount: Number(expense.original_amount || converted.originalAmount),
            currency: expense.currency || normalizeExpenseCurrency(currency),
            exchange_rate: Number(expense.exchange_rate || converted.exchangeRate || 1),
            exchange_rate_date: expense.exchange_rate_date || converted.exchangeRateDate || null,
          },
        },
        "Expense created"
      )
    );
  } catch (error) {
    next(error);
  }
};

export const listExpenses = async (req, res, next) => {
  try {
    const result = await supabaseAdmin
      .from("expenses")
      .select("*")
      .eq("user_id", req.user.id)
      .order("date", { ascending: false });

    const expenses = assertSupabase(result, "Failed to fetch expenses");
    const normalizedItems = (expenses || []).map((item) => ({
      ...item,
      amount: Number(item.amount || 0),
      original_amount: Number(item.original_amount || item.amount || 0),
      currency: item.currency || "UZS",
      exchange_rate: Number(item.exchange_rate || 1),
      exchange_rate_date: item.exchange_rate_date || null,
    }));
    res.json(ok({ items: normalizedItems }, "Expenses fetched"));
  } catch (error) {
    next(error);
  }
};
