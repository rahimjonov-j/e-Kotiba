import webpush from "web-push";
import { env } from "../config/env.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { assertSupabase } from "../utils/db.js";

let vapidConfigured = false;

const canUseWebPush = () => Boolean(env.pushVapidPublicKey && env.pushVapidPrivateKey);

const ensureWebPushConfigured = () => {
  if (!canUseWebPush() || vapidConfigured) return canUseWebPush();

  webpush.setVapidDetails(env.pushVapidSubject, env.pushVapidPublicKey, env.pushVapidPrivateKey);
  vapidConfigured = true;
  return true;
};

export const isPushEnabled = () => ensureWebPushConfigured();

export const savePushSubscription = async ({ userId, subscription }) => {
  const result = await supabaseAdmin
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      { onConflict: "endpoint" }
    )
    .select("id, endpoint")
    .single();

  return assertSupabase(result, "Push subscription saqlanmadi");
};

export const deletePushSubscription = async ({ userId, endpoint }) => {
  const result = await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  assertSupabase(result, "Push subscription o'chirilmadi");
};

const pruneSubscriptionByEndpoint = async (endpoint) => {
  const result = await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  assertSupabase(result, "Yaroqsiz push subscription o'chirilmadi");
};

export const sendPushToUser = async ({ userId, payload }) => {
  if (!ensureWebPushConfigured()) return { sent: 0, skipped: true };

  const subscriptionsResult = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  const subscriptions = assertSupabase(subscriptionsResult, "Push subscriptions yuklanmadi");
  if (!subscriptions.length) return { sent: 0, skipped: false };

  let sent = 0;

  await Promise.all(
    subscriptions.map(async (item) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: item.endpoint,
            keys: {
              p256dh: item.p256dh,
              auth: item.auth,
            },
          },
          JSON.stringify(payload)
        );
        sent += 1;
      } catch (error) {
        const statusCode = Number(error?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await pruneSubscriptionByEndpoint(item.endpoint);
        }
      }
    })
  );

  return { sent, skipped: false };
};
