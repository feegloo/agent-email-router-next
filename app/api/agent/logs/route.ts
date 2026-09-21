import { readLogTail } from "@/lib/ollama-logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
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
      let previous = "";
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
          const lines = await readLogTail(path!);
          if (closed) return;
          const snapshot = JSON.stringify(lines);
          if (snapshot !== previous) {
            send("logs", { lines });
            previous = snapshot;
          } else {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          }
        } catch {
          if (closed) return;
          send("status", { message: "Waiting for Ollama container logs..." });
        }
        if (!closed) timer = setTimeout(poll, 1000);
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
