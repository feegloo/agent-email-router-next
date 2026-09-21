import { z } from "zod";

export const forwardingRouteSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  rule: z.string().trim().min(1).max(2_000),
});

export type ForwardingRoute = z.infer<typeof forwardingRouteSchema>;

export const defaultRoutes: ForwardingRoute[] = [
  {
    id: "human-resources",
    email: "human-resources@example.com",
    rule: "Recruitment, employee relations, leave, compensation, contracts, and employee documents.",
  },
  {
    id: "help-desk",
    email: "help-desk@example.com",
    rule: "Software support, hardware problems, and access issues.",
  },
  {
    id: "other",
    email: "other@example.com",
    rule: "Messages that do not match another forwarding route.",
  },
];
