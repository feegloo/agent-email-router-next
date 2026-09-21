"use client";

import { useEffect, useState } from "react";

export function AgentLogs() {
  const [lines, setLines] = useState<string[]>([]);
  const [connection, setConnection] = useState("Connecting to container logs...");
  useEffect(() => {
    const source = new EventSource("/api/agent/logs");
    source.addEventListener("logs", (event: MessageEvent<string>) => {
      const data = JSON.parse(event.data) as { lines: string[] };
      setLines(data.lines.slice(-3));
      setConnection("");
    });
    source.addEventListener("status", (event: MessageEvent<string>) => {
      const data = JSON.parse(event.data) as { message: string };
      setConnection(data.message);
    });
    source.onerror = () => setConnection("Logs disconnected. Reconnecting...");
    return () => source.close();
  }, []);
  return (
    <div className="agent-logs" aria-label="Raw Ollama container logs" aria-live="off">
      <div title={connection || lines[0] || "Waiting for container output..."}>
        {connection || lines[0] || "Waiting for container output..."}
      </div>
      <div title={lines[1] || ""}>{lines[1] || "\u00a0"}</div>
      <div title={lines[2] || ""}>{lines[2] || "\u00a0"}</div>
    </div>
  );
}
