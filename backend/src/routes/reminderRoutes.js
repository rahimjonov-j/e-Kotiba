import { Router } from "express";
import { createReminder, deleteReminder, listReminders, updateReminder } from "../controllers/reminderController.js";
import { validate } from "../middlewares/validate.js";
import { reminderCreateSchema, reminderUpdateSchema } from "../validators/reminders.js";
import { paginationQuerySchema, idParamSchema } from "../validators/common.js";

const router = Router();

router.get("/", validate(paginationQuerySchema, "query"), listReminders);
router.post("/", validate(reminderCreateSchema), createReminder);
router.patch("/:id", validate(idParamSchema, "params"), validate(reminderUpdateSchema), updateReminder);
router.delete("/:id", validate(idParamSchema, "params"), deleteReminder);

export default router;