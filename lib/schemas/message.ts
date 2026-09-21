import { z } from "zod";

export const messageInputSchema = z.object({
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(1).max(10_000),
});
