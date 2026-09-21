import { describe, expect, it } from "vitest";

import { createAgentPrompt } from "@/lib/routing-agent";
import type { ForwardingRoute } from "@/lib/routes";

describe("createAgentPrompt", () => {
  it("adds the current server-side routes to every agent prompt", () => {
    const routes: ForwardingRoute[] = [
      {
        id: "legal",
        email: "legal@company.example",
        rule: "Contracts, policies, and legal questions.",
      },
      {
        id: "other",
        email: "other@company.example",
        rule: "Everything else.",
      },
    ];

    const prompt = createAgentPrompt(routes);

    expect(prompt).toContain("legal@company.example");
    expect(prompt).toContain("Contracts, policies, and legal questions.");
    expect(prompt).toContain("other@company.example");
    expect(prompt).toContain("forward_email");
    expect(prompt).toContain("Never invent a routeId");
  });
});
