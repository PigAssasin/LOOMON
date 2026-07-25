import { NextResponse } from "next/server";
import { listPurchasedOrderProofs } from "@/src/server/commerce/order-proof-service";
import { createClient } from "@/src/lib/supabase/server";

export async function GET() {
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

  try {
    const proofs = await listPurchasedOrderProofs(user.id);
    return NextResponse.json({ proofs });
  } catch {
    return NextResponse.json(
      { error: "Purchased proofs are temporarily unavailable." },
      { status: 500 },
    );
  }
}
