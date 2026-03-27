import { Router } from "express";
import { createMeeting, deleteMeeting, listMeetings, updateMeeting } from "../controllers/meetingController.js";
import { validate } from "../middlewares/validate.js";
import { meetingCreateSchema, meetingUpdateSchema } from "../validators/meetings.js";
import { idParamSchema, paginationQuerySchema } from "../validators/common.js";

const router = Router();

router.get("/", validate(paginationQuerySchema, "query"), listMeetings);
router.post("/", validate(meetingCreateSchema), createMeeting);
router.patch("/:id", validate(idParamSchema, "params"), validate(meetingUpdateSchema), updateMeeting);
router.delete("/:id", validate(idParamSchema, "params"), deleteMeeting);

export default router;