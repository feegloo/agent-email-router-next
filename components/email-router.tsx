"use client";

import { FormEvent, useEffect, useState } from "react";

import type { ForwardingRoute } from "@/lib/routes";
import { AgentLogs } from "@/components/agent-logs";

type FlowStatus = "idle" | "processing" | "forwarded" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "error";

export function EmailRouter() {
  const [routes, setRoutes] = useState<ForwardingRoute[]>([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<FlowStatus>("idle");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});

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

  function changeRoute(id: string, change: Partial<ForwardingRoute>) {
    setRoutes((currentRoutes) =>
      currentRoutes.map((route) => (route.id === id ? { ...route, ...change } : route)),
    );
    setSaveStatus((current) => ({ ...current, [id]: "idle" }));
  }

  async function saveRoute(route: ForwardingRoute) {
    setSaveStatus((current) => ({ ...current, [route.id]: "saving" }));

    try {
      const response = await fetch(`/api/routes/${route.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: route.email, rule: route.rule }),
      });
      const data = (await response.json()) as { route?: ForwardingRoute; error?: string };

      if (!response.ok || !data.route) {
        throw new Error(data.error ?? "Unable to save forwarding route.");
      }

      setRoutes((currentRoutes) =>
        currentRoutes.map((currentRoute) =>
          currentRoute.id === route.id ? data.route! : currentRoute,
        ),
      );
      setSaveStatus((current) => ({ ...current, [route.id]: "saved" }));
    } catch (reason) {
      setSaveStatus((current) => ({ ...current, [route.id]: "error" }));
      setError(reason instanceof Error ? reason.message : "Unable to save forwarding route.");
    }
  }

  async function addRoute() {
    setError(null);

    try {
      const response = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "new-department@example.com",
          rule: "Describe the messages that should be forwarded to this email.",
        }),
      });
      const data = (await response.json()) as { route?: ForwardingRoute; error?: string };

      if (!response.ok || !data.route) {
        throw new Error(data.error ?? "Unable to add forwarding route.");
      }

      setRoutes((currentRoutes) => [...currentRoutes, data.route!]);
      setSaveStatus((current) => ({ ...current, [data.route!.id]: "saved" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to add forwarding route.");
    }
  }

  async function deleteRoute(id: string) {
    setError(null);

    try {
      const response = await fetch(`/api/routes/${id}`, { method: "DELETE" });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to delete forwarding route.");
      }

      setRoutes((currentRoutes) => currentRoutes.filter((route) => route.id !== id));
      if (selectedRouteId === id) setSelectedRouteId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete forwarding route.");
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
            placeholder="Example: I need 3 days of holiday from tomorrow"
            rows={5}
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
          <AgentLogs />
        </section>

        <section className="branches" aria-label="Email forwarding routes">
          <button className="add-route" type="button" onClick={() => void addRoute()}>
            <span aria-hidden="true">＋</span> Add email
          </button>
          <div className="route-list">
          {routes.map((route) => {
            const selected = route.id === selectedRouteId;
            return (
              <div className={`route-row ${selected ? "selected" : ""}`} key={route.id}>
                <div className="branch-connector" aria-hidden="true" />
                <article className="panel route-card">
                  {selected ? <span className="forwarded-badge">Forwarded</span> : null}
                  <button
                    className="delete-route"
                    type="button"
                    onClick={() => void deleteRoute(route.id)}
                    aria-label={`Delete route ${route.email}`}
                    disabled={routes.length === 1}
                  >
                    ×
                  </button>
                  <label className="sr-only" htmlFor={`email-${route.id}`}>
                    Forwarding email
                  </label>
                  <input
                    id={`email-${route.id}`}
                    type="email"
                    value={route.email}
                    onChange={(event) => changeRoute(route.id, { email: event.target.value })}
                    onBlur={() => void saveRoute(route)}
                  />
                  <label className="rule-label" htmlFor={`rule-${route.id}`}>
                    Email forwarding rules
                  </label>
                  <textarea
                    id={`rule-${route.id}`}
                    rows={2}
                    value={route.rule}
                    onChange={(event) => changeRoute(route.id, { rule: event.target.value })}
                    onBlur={() => void saveRoute(route)}
                  />
                  <span className={`save-status ${saveStatus[route.id] ?? "idle"}`}>
                    {saveStatus[route.id] === "saving"
                      ? "Saving..."
                      : saveStatus[route.id] === "error"
                        ? "Not saved"
                        : "Saved"}
                  </span>
                </article>
              </div>
            );
          })}
          </div>
        </section>
      </div>
    </main>
  );
}
