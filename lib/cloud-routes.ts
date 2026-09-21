import { cloudAccessToken } from "@/lib/cloud-auth";
import { defaultRoutes, forwardingRoutesSchema, type ForwardingRoute } from "@/lib/routes";

export async function cloudRoutes(mutate?: (routes: ForwardingRoute[]) => ForwardingRoute[]): Promise<ForwardingRoute[]> {
  const bucket = process.env.ROUTES_GCS_BUCKET;
  if (!bucket) throw new Error("ROUTES_GCS_BUCKET is required");
  const headers = { Authorization: `Bearer ${await cloudAccessToken()}` };
  const object = "routes.json";
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${object}`;
  // Compare-and-swap prevents lost updates across overlapping Cloud Run revisions.
  for (let attempt = 0; attempt < 5; attempt++) {
    const metadata = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(10000) });
    let generation = "0";
    let routes = structuredClone(defaultRoutes);
    if (metadata.ok) {
      generation = ((await metadata.json()) as { generation: string }).generation;
      const data = await fetch(`${url}?alt=media&generation=${generation}`, { headers, cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (data.status === 404) continue;
      if (!data.ok) throw new Error(`Unable to read routes: ${data.status}`);
      routes = forwardingRoutesSchema.parse(await data.json());
    } else if (metadata.status !== 404) {
      throw new Error(`Unable to read route metadata: ${metadata.status}`);
    }
    if (!mutate) return routes;
    const next = forwardingRoutesSchema.parse(mutate(structuredClone(routes)));
    const saved = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${object}&ifGenerationMatch=${generation}`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(next), signal: AbortSignal.timeout(10000),
    });
    if (saved.status === 412) continue;
    if (!saved.ok) throw new Error(`Unable to save routes: ${saved.status}`);
    return next;
  }
  throw new Error("Routes changed concurrently. Please retry saving.");
}
