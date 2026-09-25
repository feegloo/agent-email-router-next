import { getRoutes } from "@/lib/route-store";

export async function GET() {
  return Response.json({ routes: await getRoutes() });
}
