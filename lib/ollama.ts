import { ollamaHeaders } from "@/lib/cloud-auth";

import { config } from "@/lib/config";

export type OllamaTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type OllamaChatResponse = {
  message?: {
    content?: string;
    tool_calls?: Array<{
      function?: {
        name?: string;
        arguments?: Record<string, unknown>;
      };
    }>;
  };
};

const baseUrl = config.ollamaBaseUrl.replace(/\/$/, "");

export async function isOllamaReady(): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      headers: await ollamaHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function chatWithTools(input: {
  messages: Array<{ role: "system" | "user"; content: string }>;
  tools: OllamaTool[];
}): Promise<OllamaChatResponse> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...await ollamaHeaders() },
    body: JSON.stringify({
      model: config.ollamaModel,
      messages: input.messages,
      tools: input.tools,
      stream: false,
      think: "low",
      keep_alive: process.env.OLLAMA_CLOUD_RUN_AUDIENCE ? -1 : "10m",
      options: { temperature: 0 },
    }),
    signal: AbortSignal.timeout(config.ollamaTimeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned HTTP ${response.status}.`);
  }

  return (await response.json()) as OllamaChatResponse;
}
