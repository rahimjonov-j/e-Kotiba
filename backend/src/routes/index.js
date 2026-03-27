import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import authRoutes from "./authRoutes.js";
import secretaryRoutes from "./secretaryRoutes.js";
import reminderRoutes from "./reminderRoutes.js";
import meetingRoutes from "./meetingRoutes.js";
import clientRoutes from "./clientRoutes.js";
import expenseRoutes from "./expenseRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import adminRoutes from "./adminRoutes.js";
import notificationRoutes from "./notificationRoutes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    data: { status: "ok", timestamp: new Date().toISOString() },
    message: "API healthy",
  });
});

router.use("/auth", authRoutes);
router.use(requireAuth);
router.use("/secretary", secretaryRoutes);
router.use("/reminders", reminderRoutes);
router.use("/meetings", meetingRoutes);
router.use("/clients", clientRoutes);
router.use("/expenses", expenseRoutes);
router.use("/notifications", notificationRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/admin", adminRoutes);

export default router;
