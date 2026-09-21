import { randomUUID } from "node:crypto";

import { getRoutes, updateRoutes } from "@/lib/route-store";
import { forwardingRouteInputSchema } from "@/lib/routes";

export async function GET() {
  return Response.json({ routes: await getRoutes() });
}

export async function POST(request: Request) {
  const input = forwardingRouteInputSchema.safeParse(await request.json());

  if (!input.success) {
    return Response.json({ error: "A valid email and rule are required." }, { status: 400 });
  }

  const route = { id: randomUUID(), ...input.data };
  await updateRoutes((routes) => [...routes, route]);

  return Response.json({ route }, { status: 201 });
}
