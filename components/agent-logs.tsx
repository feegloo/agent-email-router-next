"use client";

import { useEffect, useState } from "react";

export function AgentLogs() {
  const [lines, setLines] = useState<string[]>([]);
  const [connection, setConnection] = useState("Connecting to container logs...");
  useEffect(() => {
    const source = new EventSource("/api/agent/logs");
    const pending: string[] = [];
    const timer = setInterval(() => {
      const line = pending.shift();
      if (line === undefined) return;
      setLines((current) => [...current, line].slice(-6));
      setConnection("");
    }, 100);
    source.addEventListener("log", (event: MessageEvent<string>) => {
      const data = JSON.parse(event.data) as { line: string };
      pending.push(data.line);
    });
    source.addEventListener("status", (event: MessageEvent<string>) => {
      const data = JSON.parse(event.data) as { message: string };
      setConnection(data.message);
    });
    source.onerror = () => setConnection("Logs disconnected. Reconnecting...");
    return () => { source.close(); clearInterval(timer); };
  }, []);
  return (
    <div className="agent-logs" aria-label="Raw Ollama container logs" aria-live="off">
      <div title={connection || lines[0] || "Waiting for container output..."}>
        {connection || lines[0] || "Waiting for container output..."}
      </div>
      <div title={lines[1] || ""}>{lines[1] || "\u00a0"}</div>
      <div title={lines[2] || ""}>{lines[2] || "\u00a0"}</div>
      <div title={lines[3] || ""}>{lines[3] || "\u00a0"}</div>
      <div title={lines[4] || ""}>{lines[4] || "\u00a0"}</div>
      <div title={lines[5] || ""}>{lines[5] || "\u00a0"}</div>
    </div>
  );
}
