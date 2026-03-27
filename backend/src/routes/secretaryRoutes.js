import { Router } from "express";
import { processSecretaryInput, transcribeSecretaryAudio } from "../controllers/secretaryController.js";
import { validate } from "../middlewares/validate.js";
import { secretaryInputSchema } from "../validators/secretary.js";

const router = Router();

router.post("/process", validate(secretaryInputSchema), processSecretaryInput);
router.post("/transcribe", transcribeSecretaryAudio);

export default router;