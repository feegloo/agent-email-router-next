import { isOllamaReady } from "@/lib/ollama";

export async function GET() {
  const ollama = await isOllamaReady();

  return Response.json(
    { status: ollama ? "ok" : "degraded", services: { ollama } },
    { status: ollama ? 200 : 503 },
  );
}
