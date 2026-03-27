import { z } from "zod";

export const expenseCreateSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(2),
  date: z.string().date(),
  currency: z.enum(["UZS", "USD", "RUB"]).optional(),
  title: z.string().min(2).optional(),
  note: z.string().optional(),
  spent_at: z.string().datetime().optional(),
});
