import { z } from "zod";
import { forwardingRoutesSchema } from "@/lib/routes";

export const messageInputSchema = z.object({
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(1).max(10_000),
  routes: forwardingRoutesSchema.max(50).refine(
    (routes) => new Set(routes.map((route) => route.id)).size === routes.length,
    "Route IDs must be unique.",
  ),
});
