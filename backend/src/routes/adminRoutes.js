import { Router } from "express";
import { adminOverview } from "../controllers/adminController.js";
import { requireRole } from "../middlewares/role.js";

const router = Router();

router.get("/overview", requireRole(["admin"]), adminOverview);

export default router;