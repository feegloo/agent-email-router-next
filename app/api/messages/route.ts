import { sendEmail } from "@/lib/email";
import { selectForwardingRoute } from "@/lib/routing-agent";
import { messageInputSchema } from "@/lib/schemas/message";

export async function POST(request: Request) {
  const input = messageInputSchema.safeParse(await request.json());

  if (!input.success) {
    return Response.json(
      { error: "A message, a sender email and valid email routing rules are required." },
      { status: 400 },
    );
  }

  try {
    const route = await selectForwardingRoute(input.data.message, input.data.routes);

    try {
      await sendEmail({
        to: route.email,
        replyTo: input.data.email,
        body: input.data.message,
      });
    } catch (error) {
      const failure = error as { code?: string; responseCode?: number; command?: string; response?: string; message?: string };
      console.error("Email submission failed", {
        code: failure.code,
        responseCode: failure.responseCode,
        command: failure.command,
        response: failure.response?.slice(0, 500),
      });
      const warning = failure.code === "EAUTH"
        ? "SMTP authentication failed. Email was not sent."
        : failure.command === "RCPT TO" && /\b5\.1\.1\b/.test(failure.response ?? "")
          ? "Email address not found"
          : "Email could not be submitted to SMTP. Check the server configuration and Mailgun logs.";
      return Response.json({ status: "routed", routeId: route.id, email: route.email, warning });
    }

    return Response.json({
      status: "forwarded",
      routeId: route.id,
      email: route.email,
    });
  } catch (error) {
    console.error("Unable to route message", error);
    if (error instanceof Error && error.name === "TimeoutError") {
      return Response.json(
        { error: "Ollama took too long to respond. No email was sent. Try again with the model loaded, or increase OLLAMA_TIMEOUT_MS." },
        { status: 504 },
      );
    }

    return Response.json(
      { error: "The message could not be routed." },
      { status: 502 },
    );
  }
}
