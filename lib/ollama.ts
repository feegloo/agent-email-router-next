import { config } from "@/lib/config";

export async function isOllamaReady(): Promise<boolean> {
  try {
    const response = await fetch(`${config.ollamaBaseUrl}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });

    return response.ok;
  } catch {
    return false;
  }
}
