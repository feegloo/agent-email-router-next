import { afterEach, expect, it, vi } from "vitest";
const sendMail = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); sendMail.mockClear(); });
it("sends local messages through MailHog without authentication", async () => {
  vi.stubEnv("K_SERVICE", "");
  const { sendEmail } = await import("./email");
  await sendEmail({ to: "help@example.com", replyTo: "user@example.com", body: "Help" });
  expect(sendMail).toHaveBeenCalledOnce();
});
it("submits any selected route address to SMTP in production", async () => {
  vi.stubEnv("K_SERVICE", "email-router");
  vi.stubEnv("SMTP_USER", "test");
  vi.stubEnv("SMTP_PASSWORD", "test");
  const { sendEmail } = await import("./email");
  await sendEmail({ to: "department@company.example", replyTo: "user@example.com", body: "Help" });
  expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "department@company.example", replyTo: "user@example.com" }));
});
it("blocks production delivery with missing SMTP credentials", async () => {
  vi.stubEnv("K_SERVICE", "email-router");
  vi.stubEnv("SMTP_USER", "");
  const { sendEmail } = await import("./email");
  await expect(sendEmail({ to: "allowed@example.com", replyTo: "user@example.com", body: "Help" })).rejects.toThrow("must be configured");
  expect(sendMail).not.toHaveBeenCalled();
});
