import { afterEach, expect, it, vi } from "vitest";
import { cloudRoutes } from "./cloud-routes";
import { defaultRoutes } from "./routes";

vi.mock("@/lib/cloud-auth", () => ({ cloudAccessToken: async () => "test-token" }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("returns defaults for a missing object without persisting during reads", async () => {
  vi.stubEnv("ROUTES_GCS_BUCKET", "test-bucket");
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", fetcher);
  expect(await cloudRoutes()).toEqual(defaultRoutes);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("retries a concurrent write using the latest generation and routes", async () => {
  vi.stubEnv("ROUTES_GCS_BUCKET", "test-bucket");
  const changed = structuredClone(defaultRoutes);
  changed[0].email = "updated@example.com";
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({ generation: "1" }))
    .mockResolvedValueOnce(Response.json(defaultRoutes))
    .mockResolvedValueOnce(new Response(null, { status: 412 }))
    .mockResolvedValueOnce(Response.json({ generation: "2" }))
    .mockResolvedValueOnce(Response.json(changed))
    .mockResolvedValueOnce(Response.json({}));
  vi.stubGlobal("fetch", fetcher);
  const result = await cloudRoutes(routes => routes.map((route, index) => index === 1 ? { ...route, rule: "New rule" } : route));
  expect(result[0].email).toBe("updated@example.com");
  expect(result[1].rule).toBe("New rule");
  expect(fetcher.mock.calls[5][0]).toContain("ifGenerationMatch=2");
});

it("does not overwrite defaults on storage permission failures", async () => {
  vi.stubEnv("ROUTES_GCS_BUCKET", "test-bucket");
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(cloudRoutes(routes => routes)).rejects.toThrow("403");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
