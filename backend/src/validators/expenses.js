import { z } from "zod";

export const expenseCreateSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(2),
  date: z.string().date(),
});