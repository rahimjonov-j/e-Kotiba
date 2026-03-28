import { ok } from "../utils/response.js";
import { deletePushSubscription, isPushEnabled, savePushSubscription } from "../services/pushService.js";
import { env } from "../config/env.js";

export const getPushPublicKey = async (_req, res, next) => {
  try {
    res.json(
      ok(
        {
          publicKey: env.pushVapidPublicKey || "",
          enabled: isPushEnabled(),
        },
        "Push public key fetched"
      )
    );
  } catch (error) {
    next(error);
  }
};

export const subscribePush = async (req, res, next) => {
  try {
    const subscription = await savePushSubscription({
      userId: req.user.id,
      subscription: req.body,
    });

    res.status(201).json(ok({ subscription }, "Push subscription saved"));
  } catch (error) {
    next(error);
  }
};

export const unsubscribePush = async (req, res, next) => {
  try {
    await deletePushSubscription({
      userId: req.user.id,
      endpoint: req.body.endpoint,
    });

    res.json(ok({}, "Push subscription removed"));
  } catch (error) {
    next(error);
  }
};
