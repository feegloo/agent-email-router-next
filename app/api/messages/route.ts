import { config } from "@/lib/config";
import { sendEmail } from "@/lib/email";
import { getRoutes } from "@/lib/route-store";
import { selectForwardingRoute } from "@/lib/routing-agent";
import { messageInputSchema } from "@/lib/schemas/message";

export async function POST(request: Request) {
  const input = messageInputSchema.safeParse(await request.json());

  if (!input.success) {
    return Response.json(
      { error: "A non-empty message is required." },
      { status: 400 },
    );
  }

  try {
    const route = await selectForwardingRoute(input.data.message, await getRoutes());

    await sendEmail({
      to: route.email,
      replyTo: config.defaultSenderEmail,
      body: input.data.message,
    });

    return Response.json({
      status: "forwarded",
      routeId: route.id,
      email: route.email,
    });
  } catch (error) {
    console.error("Unable to route message", error);

    return Response.json(
      { error: "The message could not be routed." },
      { status: 502 },
    );
  }
}
