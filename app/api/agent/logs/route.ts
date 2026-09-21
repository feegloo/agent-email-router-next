import { ollamaHeaders } from "@/lib/cloud-auth";
import { createLogReader } from "@/lib/ollama-logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.OLLAMA_CLOUD_RUN_AUDIENCE) {
    try {
      const response = await fetch(`${process.env.OLLAMA_BASE_URL}/logs`, {
        headers: await ollamaHeaders(), signal: request.signal, cache: "no-store",
      });
      return new Response(response.body, { status: response.status, headers: {
        "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform",
      } });
    } catch {
      return Response.json({ error: "Container logs unavailable" }, { status: 503 });
    }
  }
  const path = process.env.OLLAMA_LOG_PATH;
  if (!path) {
    return Response.json({ error: "Container logs are available in Docker Compose." }, { status: 503 });
  }

  let stop = () => {};
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let timer: ReturnType<typeof setTimeout>;
      const readLines = createLogReader(path!);
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      stop = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        request.signal.removeEventListener("abort", stop);
        controller.close();
      };
      request.signal.addEventListener("abort", stop, { once: true });
      if (request.signal.aborted) { stop(); return; }
      send("status", { message: "Connected to Ollama container logs" });
      async function poll() {
        try {
          const lines = await readLines();
          if (closed) return;
          if (lines.length) {
            for (const line of lines) send("log", { line });
          } else {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          }
        } catch {
          if (closed) return;
          send("status", { message: "Waiting for Ollama container logs..." });
        }
        if (!closed) timer = setTimeout(poll, 250);
      }
      void poll();
    },
    cancel() { stop(); },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
