import { expect, it, vi } from "vitest";
const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email", () => ({ sendEmail }));
vi.mock("@/lib/route-store", () => ({ getRoutes: async () => [] }));
vi.mock("@/lib/routing-agent", () => ({ selectForwardingRoute: async () => ({ id: "hr", email: "hr@example.com" }) }));
import { POST } from "./route";
it("keeps the selected route when email submission fails, then allows another send", async () => {
  const request = () => new Request("http://localhost/api/messages", { method: "POST", body: JSON.stringify({ message: "I need leave" }) });
  sendEmail.mockRejectedValueOnce(new Error("This email address is not enabled for delivery in this demo."));
  const failedDelivery = await POST(request());
  expect(failedDelivery.status).toBe(200);
  expect(await failedDelivery.json()).toMatchObject({ status: "routed", routeId: "hr", warning: expect.any(String) });
  sendEmail.mockResolvedValueOnce(undefined);
  expect(await (await POST(request())).json()).toMatchObject({ status: "forwarded", routeId: "hr" });
});
