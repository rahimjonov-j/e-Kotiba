import { Router } from "express";
import { getPushPublicKey, subscribePush, unsubscribePush } from "../controllers/pushController.js";
import { validate } from "../middlewares/validate.js";
import { pushSubscriptionSchema, unsubscribePushSchema } from "../validators/push.js";

const router = Router();

router.get("/public-key", getPushPublicKey);
router.post("/subscribe", validate(pushSubscriptionSchema), subscribePush);
router.delete("/subscribe", validate(unsubscribePushSchema), unsubscribePush);

export default router;
