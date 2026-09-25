import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/cloud-auth", () => ({ ollamaHeaders: async () => ({ Authorization: "Bearer test" }) }));
vi.mock("@/lib/config", () => ({ config: { ollamaBaseUrl: "http://ollama", ollamaModel: "qwen3.5:0.8b" } }));
import { GET } from "./route";
afterEach(() => vi.unstubAllGlobals());
const request = () => new Request("http://localhost/api/agent/model-state");
it("detects loading, readiness and unloading instead of keeping a stale ready flag", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({ models: [] }))
    .mockResolvedValueOnce(Response.json({ models: [{ name: "qwen3.5:0.8b" }] }))
    .mockResolvedValueOnce(Response.json({ models: [{ name: "another-model" }] }));
  vi.stubGlobal("fetch", fetcher);
  for (const state of ["initializing", "ready", "initializing"]) {
    expect(await (await GET(request())).json()).toEqual({ state });
  }
  expect(fetcher).toHaveBeenCalledWith("http://ollama/api/ps", expect.objectContaining({
    headers: { Authorization: "Bearer test" }, cache: "no-store",
  }));
});
it.each(["network", "http", "invalid"])("keeps %s status failures separate from routing", async (failure) => {
  const fetcher = vi.fn();
  if (failure === "network") fetcher.mockRejectedValue(new Error("offline"));
  else fetcher.mockResolvedValue(failure === "http" ? new Response("", { status: 503 }) : Response.json({}));
  vi.stubGlobal("fetch", fetcher);
  expect(await (await GET(request())).json()).toEqual({ state: "unknown" });
});
