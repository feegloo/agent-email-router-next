import { expect, it, vi } from "vitest";
const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email", () => ({ sendEmail }));
vi.mock("@/lib/route-store", () => ({ getRoutes: async () => [] }));
vi.mock("@/lib/routing-agent", () => ({ selectForwardingRoute: async () => ({ id: "hr", email: "hr@example.com" }) }));
import { POST } from "./route";
it("keeps the selected route when email submission fails, then allows another send", async () => {
  const request = () => new Request("http://localhost/api/messages", { method: "POST", body: JSON.stringify({ message: "I need leave", email: "sender@example.org" }) });
  sendEmail.mockRejectedValueOnce(Object.assign(new Error("Recipient rejected"), { code: "EENVELOPE", command: "RCPT TO", response: "550 5.1.1 User unknown" }));
  const failedDelivery = await POST(request());
  expect(failedDelivery.status).toBe(200);
  expect(await failedDelivery.json()).toMatchObject({ status: "routed", routeId: "hr", warning: "Email address not found" });
  sendEmail.mockResolvedValueOnce(undefined);
  expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "sender@example.org" }));
  expect(await (await POST(request())).json()).toMatchObject({ status: "forwarded", routeId: "hr" });
});

it.each([undefined, "", "invalid", "a@example.com\r\nBcc: b@example.com"])("rejects invalid sender %s before SMTP", async (email) => {
  sendEmail.mockClear();
  const response = await POST(new Request("http://localhost/api/messages", { method: "POST", body: JSON.stringify({ message: "Hello", email }) }));
  expect(response.status).toBe(400);
  expect(sendEmail).not.toHaveBeenCalled();
});
