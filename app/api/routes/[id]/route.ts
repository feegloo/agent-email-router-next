import { updateRoutes } from "@/lib/route-store";
import { forwardingRouteUpdateSchema } from "@/lib/routes";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const input = forwardingRouteUpdateSchema.safeParse(await request.json());

  if (!input.success) {
    return Response.json({ error: "A valid email or rule is required." }, { status: 400 });
  }

  let updated = false;
  const routes = await updateRoutes((currentRoutes) =>
    currentRoutes.map((route) => {
      if (route.id !== id) {
        return route;
      }

      updated = true;
      return { ...route, ...input.data };
    }),
  );

  if (!updated) {
    return Response.json({ error: "Forwarding route not found." }, { status: 404 });
  }

  return Response.json({ route: routes.find((route) => route.id === id) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  let removed = false;

  try {
    await updateRoutes((routes) => {
      if (routes.length === 1) {
        throw new Error("At least one forwarding route is required.");
      }

      const nextRoutes = routes.filter((route) => route.id !== id);
      removed = nextRoutes.length !== routes.length;
      return nextRoutes;
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to delete route." },
      { status: 409 },
    );
  }

  if (!removed) {
    return Response.json({ error: "Forwarding route not found." }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
