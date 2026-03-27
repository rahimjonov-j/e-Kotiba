import { supabaseAdmin } from "../lib/supabase.js";
import { ok } from "../utils/response.js";
import { processWithOpenAi } from "../services/aiService.js";
import { env } from "../config/env.js";

const safeArrayQuery = async (queryPromise) => {
  const result = await queryPromise;
  if (result.error) {
    return { items: [], degraded: true, error: result.error.message };
  }
  return { items: result.data || [], degraded: false, error: null };
};

const safeCountQuery = async (queryPromise) => {
  const result = await queryPromise;
  if (result.error) {
    return { count: 0, degraded: true, error: result.error.message };
  }
  return { count: result.count || 0, degraded: false, error: null };
};

export const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const nowIso = new Date().toISOString();

    const [todayRemindersResult, upcomingMeetingsResult, missedRemindersResult, expensesResult, activeResult, upcomingRemindersResult, completedRemindersResult, overdueRemindersResult] = await Promise.all([
      safeArrayQuery(
        supabaseAdmin
        .from("reminders")
        .select("*")
        .eq("user_id", userId)
        .gte("next_run_at", new Date().toISOString().slice(0, 10))
        .lte("next_run_at", `${new Date().toISOString().slice(0, 10)}T23:59:59.999Z`)
      ),
      safeArrayQuery(supabaseAdmin.from("meetings").select("*").eq("user_id", userId).gte("meeting_datetime", nowIso).neq("status", "cancelled")),
      safeArrayQuery(supabaseAdmin.from("reminders").select("*").eq("user_id", userId).lt("next_run_at", nowIso).eq("status", "active")),
      safeArrayQuery(supabaseAdmin.from("expenses").select("amount, category, date").eq("user_id", userId)),
      safeCountQuery(supabaseAdmin.from("reminders").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active")),
      safeArrayQuery(
        supabaseAdmin
          .from("reminders")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "active")
          .gte("next_run_at", nowIso)
          .order("next_run_at", { ascending: true })
          .limit(10)
      ),
      safeArrayQuery(
        supabaseAdmin
          .from("reminders")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "archived")
          .order("created_at", { ascending: false })
          .limit(10)
      ),
      safeArrayQuery(
        supabaseAdmin
          .from("reminders")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "active")
          .lt("next_run_at", nowIso)
          .order("next_run_at", { ascending: true })
          .limit(10)
      ),
    ]);

    const todayReminders = todayRemindersResult.items;
    const upcomingMeetings = upcomingMeetingsResult.items;
    const missedReminders = missedRemindersResult.items;
    const expenses = expensesResult.items;

    const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const degraded = [todayRemindersResult, upcomingMeetingsResult, missedRemindersResult, expensesResult, activeResult, upcomingRemindersResult, completedRemindersResult, overdueRemindersResult].some(
      (result) => result.degraded
    );
    const errors = [todayRemindersResult, upcomingMeetingsResult, missedRemindersResult, expensesResult, activeResult, upcomingRemindersResult, completedRemindersResult, overdueRemindersResult]
      .map((result) => result.error)
      .filter(Boolean);

    let recommendations = "AI recommendations are currently unavailable.";
    if (env.openAiApiKey) {
      try {
        const stats = {
          reminders_today: todayReminders.length,
          meetings_upcoming: upcomingMeetings.length,
          missedCount: missedReminders.length,
          expenseTotal
        };
        const recommendationRaw = await processWithOpenAi({
          rawText: JSON.stringify(stats), 
          mode: "dashboard_insights" 
        });
        recommendations = recommendationRaw.recommendations || recommendationRaw.cleaned_text || recommendations;
      } catch {
        recommendations = "AI recommendations are currently unavailable.";
      }
    }

    res.json(
      ok(
        {
          today_reminders: todayReminders,
          upcoming_meetings: upcomingMeetings,
          missed_reminders: missedReminders,
          upcoming_reminders: upcomingRemindersResult.items,
          completed_reminders: completedRemindersResult.items,
          overdue_reminders: overdueRemindersResult.items,
          expenses_summary: {
            total: expenseTotal,
            count: expenses.length,
            by_category: expenses.reduce((acc, item) => {
              const key = item.category || "other";
              acc[key] = (acc[key] || 0) + Number(item.amount || 0);
              return acc;
            }, {}),
          },
          active_reminders_count: activeResult.count || 0,
          recommendations,
          degraded,
          degraded_reason: errors[0] || null,
        },
        degraded ? "Dashboard analytics fetched (partial data)" : "Dashboard analytics fetched"
      )
    );
  } catch (error) {
    next(error);
  }
};
