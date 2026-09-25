import { ollamaHeaders } from "@/lib/cloud-auth";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const response = await fetch(`${config.ollamaBaseUrl}/api/ps`, {
      headers: await ollamaHeaders(),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(5000)]),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Model status unavailable");
    const data = await response.json() as { models?: { name?: string; model?: string }[] };
    if (!Array.isArray(data.models)) throw new Error("Invalid model status");
    const model = config.ollamaModel.includes(":") ? config.ollamaModel : `${config.ollamaModel}:latest`;
    return Response.json({
      state: data.models.some(item => item.name === model || item.model === model)
        ? "ready" : "initializing",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // A failed status probe must not interrupt routing or imply model readiness.
    return Response.json({ state: "unknown" }, { headers: { "Cache-Control": "no-store" } });
  }
}
