import { Router } from "express";
import { generateSecretaryReplyAudio, processSecretaryInput, transcribeSecretaryAudio } from "../controllers/secretaryController.js";
import { validate } from "../middlewares/validate.js";
import { secretaryInputSchema, secretaryReplyAudioSchema } from "../validators/secretary.js";

const router = Router();

router.post("/process", validate(secretaryInputSchema), processSecretaryInput);
router.post("/transcribe", transcribeSecretaryAudio);
router.post("/reply-audio", validate(secretaryReplyAudioSchema), generateSecretaryReplyAudio);

export default router;
