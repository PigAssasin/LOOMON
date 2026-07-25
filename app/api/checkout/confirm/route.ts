import { NextResponse } from "next/server";
import { getAddress } from "viem";
import {
  confirmPrepaidOrderRequestSchema,
  prepaidOrderResultSchema,
} from "@/src/domain/prepaid-checkout";
import { verifyArcEscrowFunding } from "@/src/lib/payments/verify-arc-payment";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { createClient } from "@/src/lib/supabase/server";

type CheckoutRow = {
  id: string;
  buyer_id: string;
  onchain_order_id: `0x${string}`;
  terms_hash: `0x${string}`;
  buyer_address: `0x${string}`;
  seller_address: `0x${string}`;
  pool_address: `0x${string}`;
  amount_atomic: number | string;
};

export async function POST(request: Request) {
  const input = confirmPrepaidOrderRequestSchema.safeParse(await request.json());
  if (!input.success) {
    return NextResponse.json({ error: "Invalid checkout confirmation" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Checkout is not configured" }, { status: 503 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Wallet sign-in required" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("server_get_prepaid_checkout", {
    p_checkout_id: input.data.checkoutId,
  });
  if (error) {
    return NextResponse.json({ error: "Checkout could not be loaded" }, { status: 500 });
  }
  const checkout = data as CheckoutRow | null;
  if (!checkout || checkout.buyer_id !== user.id) {
    return NextResponse.json({ error: "Checkout not found" }, { status: 404 });
  }

  try {
    const verification = await verifyArcEscrowFunding({
      transactionHash: input.data.transactionHash as `0x${string}`,
      poolAddress: getAddress(checkout.pool_address),
      orderId: checkout.onchain_order_id,
      buyer: getAddress(checkout.buyer_address),
      seller: getAddress(checkout.seller_address),
      amountAtomic: BigInt(checkout.amount_atomic),
      termsHash: checkout.terms_hash,
    });
    if (
      !verification.verified
      || verification.blockNumber === undefined
      || verification.logIndex === undefined
      || !verification.eventPayload
    ) {
      return NextResponse.json(
        { error: verification.reason ?? "Escrow funding could not be verified" },
        { status: 422 },
      );
    }

    const { data: confirmed, error: confirmError } = await admin.rpc(
      "server_confirm_prepaid_order",
      {
        p_block_number: Number(verification.blockNumber),
        p_checkout_id: checkout.id,
        p_event_payload: verification.eventPayload,
        p_log_index: verification.logIndex,
        p_transaction_hash: input.data.transactionHash.toLowerCase(),
      },
    );
    if (confirmError) throw confirmError;

    return NextResponse.json(prepaidOrderResultSchema.parse(confirmed));
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : cause && typeof cause === "object" && "message" in cause
          ? String(cause.message)
          : "Order verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
