import { supabaseAdmin } from "../lib/supabase.js";
import { ok } from "../utils/response.js";
import { assertSupabase } from "../utils/db.js";

export const createClient = async (req, res, next) => {
  try {
    const result = await supabaseAdmin
      .from("clients")
      .insert({
        ...req.body,
        user_id: req.user.id,
      })
      .select()
      .single();

    const client = assertSupabase(result, "Failed to create client");
    res.status(201).json(ok({ client }, "Client created"));
  } catch (error) {
    next(error);
  }
};

export const listClients = async (req, res, next) => {
  try {
    const result = await supabaseAdmin.from("clients").select("*").eq("user_id", req.user.id).order("created_at", { ascending: false });
    const clients = assertSupabase(result, "Failed to fetch clients");
    res.json(ok({ items: clients }, "Clients fetched"));
  } catch (error) {
    next(error);
  }
};