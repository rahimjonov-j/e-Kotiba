import { z } from "zod";

const nameSchema = z.string().trim().min(3).max(40).regex(/^[\p{L}\p{N}_\-\s]+$/u, "Name contains invalid characters");
const passwordSchema = z.string().min(6).max(128);

export const signUpSchema = z.object({
  name: nameSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  name: nameSchema,
  password: passwordSchema,
});

