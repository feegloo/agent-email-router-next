import nodemailer from "nodemailer";

import { config } from "@/lib/config";

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpSecure,
  requireTLS: config.smtpRequireTls,
  auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword } : undefined,
  connectionTimeout: 15_000,
  socketTimeout: 30_000,
});

type SendEmailInput = {
  body: string;
  replyTo: string;
  to: string;
};

export async function sendEmail({ body, replyTo, to }: SendEmailInput): Promise<void> {
  if (process.env.K_SERVICE && (!config.smtpUser || !config.smtpPassword)) {
    throw new Error("Production SMTP credentials must be configured.");
  }
  await transporter.sendMail({
    from: config.emailFrom,
    to,
    replyTo,
    subject: `New message from user '${replyTo}'`,
    text: body,
  });
}
