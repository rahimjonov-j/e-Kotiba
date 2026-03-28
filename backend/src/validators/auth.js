import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(3, "Ism kamida 3 ta belgidan iborat bo'lishi kerak.")
  .max(40, "Ism 40 ta belgidan oshmasligi kerak.")
  .regex(/^[\p{L}\p{N}_\-\s]+$/u, "Ismda ruxsat etilmagan belgilar bor.");

const passwordSchema = z
  .string()
  .min(6, "Parol kamida 6 ta belgidan iborat bo'lishi kerak.")
  .max(128, "Parol juda uzun.");

export const signUpSchema = z.object({
  name: nameSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  name: nameSchema,
  password: passwordSchema,
});
