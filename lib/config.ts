function readPort(value: string | undefined, fallback: number): number {
  const port = Number(value ?? fallback);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port: ${value}`);
  }

  return port;
}

const ollamaTimeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? 600_000);
if (!Number.isSafeInteger(ollamaTimeoutMs) || ollamaTimeoutMs < 1) {
  throw new Error("OLLAMA_TIMEOUT_MS must be a positive integer.");
}

export const config = {
  ollamaTimeoutMs,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "qwen3.5:0.8b",
  smtpHost: process.env.SMTP_HOST ?? "localhost",
  smtpPort: readPort(process.env.SMTP_PORT, 1025),
  emailFrom: process.env.EMAIL_FROM ?? "agent-email-router@example.com",
  defaultSenderEmail: process.env.DEFAULT_SENDER_EMAIL ?? "user@example.com",
  routesFilePath: process.env.ROUTES_FILE_PATH ?? "./data/routes.json",
} as const;
