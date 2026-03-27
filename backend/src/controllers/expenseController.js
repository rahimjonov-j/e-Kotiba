import { supabaseAdmin } from "../lib/supabase.js";
import { ok } from "../utils/response.js";
import { assertSupabase } from "../utils/db.js";

export const createExpense = async (req, res, next) => {
  try {
    const result = await supabaseAdmin
      .from("expenses")
      .insert({
        ...req.body,
        user_id: req.user.id,
      })
      .select()
      .single();

    const expense = assertSupabase(result, "Failed to create expense");
    res.status(201).json(ok({ expense }, "Expense created"));
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
    res.json(ok({ items: expenses }, "Expenses fetched"));
  } catch (error) {
    next(error);
  }
};