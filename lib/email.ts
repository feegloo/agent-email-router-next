import nodemailer from "nodemailer";

import { config } from "@/lib/config";

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: false,
});

type SendEmailInput = {
  body: string;
  replyTo: string;
  to: string;
};

export async function sendEmail({ body, replyTo, to }: SendEmailInput): Promise<void> {
  await transporter.sendMail({
    from: config.emailFrom,
    to,
    replyTo,
    subject: `New message from user '${replyTo}'`,
    text: body,
  });
}
