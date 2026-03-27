import { Router } from "express";
import { createClient, listClients } from "../controllers/clientController.js";
import { validate } from "../middlewares/validate.js";
import { clientCreateSchema } from "../validators/clients.js";

const router = Router();

router.get("/", listClients);
router.post("/", validate(clientCreateSchema), createClient);

export default router;