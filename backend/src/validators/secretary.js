import { z } from "zod";

export const secretaryInputSchema = z
  .object({
    audioBase64: z.string().min(20).optional(),
    text: z.string().min(2).optional(),
    timezone: z.string().default("Asia/Tashkent"),
  })
  .refine((value) => value.audioBase64 || value.text, {
    message: "audioBase64 or text is required",
  });

export const secretaryReplyAudioSchema = z.object({
  text: z.string().min(2),
  voice: z.string().trim().min(1).optional(),
});
