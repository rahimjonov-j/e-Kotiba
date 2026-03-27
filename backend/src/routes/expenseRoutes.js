import { Router } from "express";
import { createExpense, listExpenses } from "../controllers/expenseController.js";
import { validate } from "../middlewares/validate.js";
import { expenseCreateSchema } from "../validators/expenses.js";

const router = Router();

router.get("/", listExpenses);
router.post("/", validate(expenseCreateSchema), createExpense);

export default router;