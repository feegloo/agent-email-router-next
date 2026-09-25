import { ollamaHeaders } from "@/lib/cloud-auth";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // Local Ollama stays on through Compose; only the Cloud Run GPU needs waking.
  if (!process.env.OLLAMA_CLOUD_RUN_AUDIENCE) {
    return Response.json({ status: "local" });
  }
  try {
    const response = await fetch(`${config.ollamaBaseUrl.replace(/\/$/, "")}/warmup`, {
      method: "POST",
      headers: await ollamaHeaders(),
      signal: AbortSignal.timeout(config.ollamaTimeoutMs),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Warmup returned HTTP ${response.status}`);
    return Response.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to warm the model", error);
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
