import { afterEach, expect, it, vi } from "vitest";
const sendMail = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); sendMail.mockClear(); });
it("sends local messages through MailHog without authentication", async () => {
  vi.stubEnv("K_SERVICE", "");
  vi.stubEnv("EMAIL_ALLOWED_RECIPIENTS", "");
  const { sendEmail } = await import("./email");
  await sendEmail({ to: "help@example.com", replyTo: "user@example.com", body: "Help" });
  expect(sendMail).toHaveBeenCalledOnce();
});
it("blocks production delivery outside the server-side recipient list", async () => {
  vi.stubEnv("K_SERVICE", "email-router");
  vi.stubEnv("SMTP_USER", "test");
  vi.stubEnv("SMTP_PASSWORD", "test");
  vi.stubEnv("EMAIL_ALLOWED_RECIPIENTS", "allowed@example.com");
  const { sendEmail } = await import("./email");
  await expect(sendEmail({ to: "other@example.com", replyTo: "user@example.com", body: "Help" })).rejects.toThrow("not enabled");
  expect(sendMail).not.toHaveBeenCalled();
  await sendEmail({ to: "allowed@example.com", replyTo: "user@example.com", body: "Help" });
  expect(sendMail).toHaveBeenCalledOnce();
});
it("blocks production delivery with missing SMTP credentials", async () => {
  vi.stubEnv("K_SERVICE", "email-router");
  vi.stubEnv("SMTP_USER", "");
  const { sendEmail } = await import("./email");
  await expect(sendEmail({ to: "allowed@example.com", replyTo: "user@example.com", body: "Help" })).rejects.toThrow("must be configured");
  expect(sendMail).not.toHaveBeenCalled();
});
