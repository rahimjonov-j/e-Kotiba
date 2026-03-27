import { Router } from "express";
import { listNotifications, markNotificationRead } from "../controllers/notificationController.js";
import { validate } from "../middlewares/validate.js";
import { idParamSchema } from "../validators/common.js";

const router = Router();

router.get("/", listNotifications);
router.patch("/:id/read", validate(idParamSchema, "params"), markNotificationRead);

export default router;