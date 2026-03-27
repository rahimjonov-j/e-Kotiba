import { supabaseAdmin } from "../lib/supabase.js";
import { ok } from "../utils/response.js";
import { assertSupabase } from "../utils/db.js";

export const adminOverview = async (_req, res, next) => {
  try {
    const [usersResult, jobsResult, reminderResult] = await Promise.all([
      supabaseAdmin.from("users").select("id, email, role, created_at"),
      supabaseAdmin.from("system_jobs").select("*").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("reminders").select("id, status, created_at"),
    ]);

    const users = assertSupabase(usersResult, "Failed to fetch users");
    const jobs = assertSupabase(jobsResult, "Failed to fetch jobs");
    const reminders = assertSupabase(reminderResult, "Failed to fetch reminders");

    const failedJobs = jobs.filter((job) => job.status === "failed");

    res.json(
      ok(
        {
          users,
          ai_usage_stats: {
            secretary_events: reminders.length,
          },
          reminders_monitoring: reminders,
          failed_jobs: failedJobs,
          system_logs: jobs,
        },
        "Admin overview fetched"
      )
    );
  } catch (error) {
    next(error);
  }
};