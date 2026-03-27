import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const run = async () => {
  const usersResult = await supabase.from("users").select("id");
  if (usersResult.error) {
    throw new Error(`Failed to read users: ${usersResult.error.message}`);
  }

  const users = usersResult.data || [];
  if (!users.length) {
    console.log("No users found in public.users. Create at least one auth user first.");
    return;
  }

  for (const user of users) {
    await supabase
      .from("users")
      .update({
        settings: {
          default_reminder_unit: "hour",
          preferred_channel: "telegram",
          language: "uz",
        },
      })
      .eq("id", user.id);

    const existingClient = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", "Ali Valiyev")
      .maybeSingle();

    if (!existingClient.data) {
      await supabase.from("clients").insert({
        user_id: user.id,
        name: "Ali Valiyev",
        phone: "+998901112233",
        email: "ali.valiyev@example.com",
        telegram_chat_id: "123456789",
        notes: "VIP client",
      });
    }

    const clientResult = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (!clientResult.error && clientResult.data) {
      const existingMeeting = await supabase
        .from("meetings")
        .select("id")
        .eq("user_id", user.id)
        .eq("title", "Weekly project sync")
        .maybeSingle();

      if (!existingMeeting.data) {
        await supabase.from("meetings").insert({
          user_id: user.id,
          title: "Weekly project sync",
          meeting_datetime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          client_id: clientResult.data.id,
          auto_message_enabled: true,
        });
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const existingExpense = await supabase
      .from("expenses")
      .select("id")
      .eq("user_id", user.id)
      .eq("category", "transport")
      .eq("date", today)
      .maybeSingle();

    if (!existingExpense.data) {
      await supabase.from("expenses").insert({
        user_id: user.id,
        amount: 120000,
        category: "transport",
        date: today,
      });
    }

    const existingReminder = await supabase
      .from("reminders")
      .select("id")
      .eq("user_id", user.id)
      .eq("title", "Daily standup reminder")
      .maybeSingle();

    if (!existingReminder.data) {
      await supabase.from("reminders").insert({
        user_id: user.id,
        title: "Daily standup reminder",
        original_text: "Har kuni ertalab 9 da standupni eslat",
        cleaned_text: "Har kuni soat 09:00 da standup yig'ilishini eslatish.",
        parsed_data: { intent: "reminder" },
        frequency_value: 1,
        frequency_unit: "day",
        next_run_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        status: "active",
      });
    }

    const existingNotification = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", user.id)
      .eq("title", "Welcome to Online Kotiba")
      .maybeSingle();

    if (!existingNotification.data) {
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Welcome to Online Kotiba",
        message: "System seeded successfully with demo data.",
        is_read: false,
      });
    }
  }

  console.log("Demo seed completed.");
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
