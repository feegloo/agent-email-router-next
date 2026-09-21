import { isOllamaReady } from "@/lib/ollama";

export async function GET() {
  // A CPU health probe must not wake the GPU service.
  if (process.env.OLLAMA_CLOUD_RUN_AUDIENCE) return Response.json({ status: "ok", services: { ollama: "on-demand" } });
  const ollama = await isOllamaReady();

  return Response.json(
    { status: ollama ? "ok" : "degraded", services: { ollama } },
    { status: ollama ? 200 : 503 },
  );
}
