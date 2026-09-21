import { messageInputSchema } from "@/lib/schemas/message";

export async function POST(request: Request) {
  const input = messageInputSchema.safeParse(await request.json());

  if (!input.success) {
    return Response.json(
      { error: "A non-empty message is required." },
      { status: 400 },
    );
  }

  return Response.json({ message: "processing" }, { status: 202 });
}
