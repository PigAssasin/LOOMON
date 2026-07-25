import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/src/lib/supabase/server";
import {
  mintOrderProofForBuyer,
  OrderProofAccessError,
} from "@/src/server/commerce/order-proof-service";

const inputSchema = z.object({
  requestKey: z.uuid().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const input = inputSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!input.success) {
    return NextResponse.json({ error: "Invalid mint request." }, { status: 400 });
  }

  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) {
    return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  }

  try {
    const result = await mintOrderProofForBuyer({
      buyerUserId: user.id,
      orderId,
      requestKey: input.data.requestKey ?? crypto.randomUUID(),
    });
    return NextResponse.json(result, {
      status: result.proof.mintStatus === "confirmed" ? 200 : 202,
    });
  } catch (error) {
    if (error instanceof OrderProofAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "The Arc proof could not be minted yet. Retry is safe." },
      { status: 502 },
    );
  }
}
