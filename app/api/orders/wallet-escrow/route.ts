import "server-only";

import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { z } from "zod";
import { escrowOrderContextSchema } from "@/src/domain/escrow-order";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { requireWalletSession } from "@/src/server/auth/wallet-session";

const querySchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  orderId: z.uuid(),
});

export async function GET(request: Request) {
  const query = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!query.success) {
    return NextResponse.json({ error: "Invalid wallet escrow request" }, { status: 400 });
  }

  const address = getAddress(query.data.address).toLowerCase();
  if (!(await requireWalletSession(address))) {
    return NextResponse.json({ error: "Wallet sign-in required" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_wallet_order_escrow_context" as never, {
    p_order_id: query.data.orderId,
    p_wallet_address: address,
  } as never);
  if (error) {
    return NextResponse.json({ error: "Wallet escrow could not be loaded" }, { status: 404 });
  }

  const parsed = escrowOrderContextSchema.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Wallet escrow is malformed" }, { status: 500 });
  }

  return NextResponse.json(parsed.data);
}
