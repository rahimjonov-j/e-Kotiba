import { z } from "zod";

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url("Push subscription endpoint noto'g'ri."),
  keys: z.object({
    p256dh: z.string().min(1, "Push kaliti topilmadi."),
    auth: z.string().min(1, "Push auth kaliti topilmadi."),
  }),
});

export const unsubscribePushSchema = z.object({
  endpoint: z.string().url("Endpoint noto'g'ri."),
});
