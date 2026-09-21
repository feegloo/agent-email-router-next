"use client";

import { FormEvent, useEffect, useState } from "react";

import type { ForwardingRoute } from "@/lib/routes";

type FlowStatus = "idle" | "processing" | "forwarded" | "error";

export function EmailRouter() {
  const [routes, setRoutes] = useState<ForwardingRoute[]>([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<FlowStatus>("idle");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/routes")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load forwarding routes.");
        return response.json() as Promise<{ routes: ForwardingRoute[] }>;
      })
      .then((data) => setRoutes(data.routes))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Unable to load forwarding routes."),
      );
  }, []);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || status === "processing") return;

    setStatus("processing");
    setSelectedRouteId(null);
    setError(null);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await response.json()) as { routeId?: string; error?: string };
      if (!response.ok || !data.routeId) {
        throw new Error(data.error ?? "The message could not be routed.");
      }
      setSelectedRouteId(data.routeId);
      setStatus("forwarded");
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "The message could not be routed.");
    }
  }

  const flowStarted = status === "processing" || status === "forwarded";

  return (
    <main className="app-shell">
      <div className="flow-grid">
        <form className="panel message-panel" onSubmit={sendMessage}>
          <h1>User message to AI Agent</h1>
          <label className="sr-only" htmlFor="message">Message to route</label>
          <textarea
            id="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe what you need help with..."
            rows={7}
          />
          <button type="submit" disabled={!message.trim() || status === "processing"}>
            {status === "processing" ? "Sending..." : "Send message"}
          </button>
          {error ? <p className="error-message">{error}</p> : null}
        </form>

        <div className={`flow-arrow ${flowStarted ? "active" : ""}`} aria-hidden="true" />

        <section className={`panel agent-panel ${status}`} aria-live="polite">
          <div className="agent-icon" aria-hidden="true"><span>●</span></div>
          <h2>AI Agent</h2>
          <p>
            <span className="status-dot" />
            {status === "processing"
              ? "Processing..."
              : status === "forwarded"
                ? "Processing complete"
                : status === "error"
                  ? "Routing failed"
                  : "Ready"}
          </p>
        </section>

        <section className="branches" aria-label="Email forwarding routes">
          {routes.map((route) => {
            const selected = route.id === selectedRouteId;
            return (
              <div className={`route-row ${selected ? "selected" : ""}`} key={route.id}>
                <div className="branch-connector" aria-hidden="true" />
                <article className="panel route-card">
                  {selected ? <span className="forwarded-badge">Forwarded</span> : null}
                  <h3>Email forwarding rules</h3>
                  <div className="readonly-field">{route.email}</div>
                  <p>{route.rule}</p>
                </article>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
