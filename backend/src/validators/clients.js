import { z } from "zod";

export const clientCreateSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  telegram_chat_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});