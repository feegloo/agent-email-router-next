import { beforeEach, expect, it, vi } from "vitest";
const sendEmail = vi.hoisted(() => vi.fn());
const selectForwardingRoute = vi.hoisted(() => vi.fn(async (_message: string, routes: { id: string; email: string; rule: string }[]) => routes[0]));
vi.mock("@/lib/email", () => ({ sendEmail }));
vi.mock("@/lib/routing-agent", () => ({ selectForwardingRoute }));
import { POST } from "./route";

const routes = [{ id: "hr", email: "hr@example.com", rule: "Time off and employee relations." }];
const request = (overrides: Record<string, unknown> = {}) => new Request("http://localhost/api/messages", {
  method: "POST",
  body: JSON.stringify({ message: "I need leave", email: "sender@example.org", routes, ...overrides }),
});

beforeEach(() => {
  vi.clearAllMocks();
  sendEmail.mockResolvedValue(undefined);
});

it("keeps the selected route when email submission fails, then allows another send", async () => {
  sendEmail.mockRejectedValueOnce(Object.assign(new Error("Recipient rejected"), { code: "EENVELOPE", command: "RCPT TO", response: "550 5.1.1 User unknown" }));
  const failedDelivery = await POST(request());
  expect(failedDelivery.status).toBe(200);
  expect(await failedDelivery.json()).toMatchObject({ status: "routed", routeId: "hr", warning: "Email address not found" });
  sendEmail.mockResolvedValueOnce(undefined);
  expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "sender@example.org" }));
  expect(await (await POST(request())).json()).toMatchObject({ status: "forwarded", routeId: "hr" });
});

it("uses each request's route IDs, emails, and rules without reading shared routes", async () => {
  const firstRoutes = [{ id: "personal-hr", email: "first@example.org", rule: "Leave requests." }];
  const secondRoutes = [{ id: "personal-hr", email: "second@example.org", rule: "Recruitment." }];

  expect(await (await POST(request({ routes: firstRoutes }))).json()).toMatchObject({ routeId: "personal-hr", email: "first@example.org" });
  expect(await (await POST(request({ routes: secondRoutes }))).json()).toMatchObject({ routeId: "personal-hr", email: "second@example.org" });
  expect(selectForwardingRoute).toHaveBeenNthCalledWith(1, "I need leave", firstRoutes);
  expect(selectForwardingRoute).toHaveBeenNthCalledWith(2, "I need leave", secondRoutes);
  expect(sendEmail).toHaveBeenNthCalledWith(1, expect.objectContaining({ to: "first@example.org" }));
  expect(sendEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: "second@example.org" }));
});

it.each([undefined, "", "invalid", "a@example.com\r\nBcc: b@example.com"])("rejects invalid sender %s before SMTP", async (email) => {
  const response = await POST(request({ email }));
  expect(response.status).toBe(400);
  expect(sendEmail).not.toHaveBeenCalled();
});

it.each([undefined, [], [{ id: "hr", email: "invalid", rule: "Help." }], [routes[0], routes[0]]])("rejects invalid route list %s before inference", async (value) => {
  const response = await POST(request({ routes: value }));
  expect(response.status).toBe(400);
  expect(selectForwardingRoute).not.toHaveBeenCalled();
  expect(sendEmail).not.toHaveBeenCalled();
});
