import { z } from "zod";

export const messageInputSchema = z.object({
  message: z.string().trim().min(1).max(10_000),
});
