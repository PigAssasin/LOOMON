import { NextResponse } from "next/server";
import {
  createPublicClient,
  getAddress,
  http,
  parseEventLogs,
} from "viem";
import {
  confirmEscrowActionSchema,
  escrowOrderContextSchema,
  type EscrowAction,
} from "@/src/domain/escrow-order";
import { ARC_TESTNET } from "@/src/lib/arc";
import { arcTestnet } from "@/src/lib/chains";
import { loomonEscrowPoolAbi } from "@/src/lib/payments/escrow-pool";
import { mintOrderProofsForParticipants } from "@/src/server/commerce/order-proof-service";
import { createAdminClient } from "@/src/lib/supabase/admin";
import type { Json } from "@/src/lib/supabase/database.types";
import { createClient } from "@/src/lib/supabase/server";

const eventByAction: Record<EscrowAction, string> = {
  start_production: "ProductionStarted",
  mark_delivered: "OrderDelivered",
  confirm_completion: "CompletionConfirmed",
  claim: "SellerFundsClaimed",
  cancel: "BuyerRefunded",
  refund: "BuyerRefunded",
  dispute: "DisputeRaised",
};

const SINGLE_DEMO_SELLER_ADDRESS = "0xd59aa8db407d4219fe4b104ca4142df14301dec4";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getReceiptWithBackoff(
  client: ReturnType<typeof createPublicClient>,
  hash: `0x${string}`,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await client.getTransactionReceipt({ hash });
    } catch (cause) {
      lastError = cause;
      const message = cause instanceof Error ? cause.message : String(cause);
      if (/request limit reached|rate limit|too many requests|32011/i.test(message)) {
        throw new Error("Arc RPC is rate-limited. Please retry in a few seconds.");
      }
      await delay(1_000 + attempt * 700);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Arc transaction was not confirmed yet");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  const input = confirmEscrowActionSchema.safeParse(await request.json());
  if (!input.success) {
    return NextResponse.json({ error: "Invalid escrow action" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sellerDemoAction = [
    "start_production",
    "mark_delivered",
    "claim",
    "refund",
  ].includes(input.data.action);
  const { data: rawContext, error: contextError } = user
    ? await supabase.rpc("get_order_escrow_context", { p_order_id: orderId })
    : sellerDemoAction
      ? await createAdminClient().rpc("get_single_demo_seller_escrow_context" as never, {
        p_order_id: orderId,
        p_wallet_address: SINGLE_DEMO_SELLER_ADDRESS,
      } as never)
      : { data: null, error: { message: "Sign-in required" } };
  if (contextError || !rawContext) {
    return NextResponse.json(
      { error: user ? "Order escrow not found" : "Sign-in required" },
      { status: user ? 404 : 401 },
    );
  }
  const order = escrowOrderContextSchema.parse(rawContext);

  const expectedRole =
    input.data.action === "confirm_completion" || input.data.action === "cancel"
      ? "buyer"
      : input.data.action === "dispute"
        ? order.role
        : "seller";
  if (order.role !== expectedRole) {
    return NextResponse.json({ error: "This wallet cannot perform that action" }, { status: 403 });
  }

  try {
    const client = createPublicClient({
      chain: arcTestnet,
      transport: http(ARC_TESTNET.rpcUrl),
    });
    const receipt = await getReceiptWithBackoff(
      client,
      input.data.transactionHash as `0x${string}`,
    );
    const expectedActor =
      expectedRole === "buyer" ? order.buyerAddress : order.sellerAddress;
    if (
      receipt.status !== "success"
      || getAddress(receipt.from) !== getAddress(expectedActor)
      || !receipt.to
      || getAddress(receipt.to) !== getAddress(order.poolAddress)
    ) {
      return NextResponse.json({ error: "Arc transaction actor or pool mismatch" }, { status: 422 });
    }

    const logs = parseEventLogs({
      abi: loomonEscrowPoolAbi,
      logs: receipt.logs,
      strict: false,
    });
    const event = logs.find((candidate) => {
      const args = candidate.args as { orderId?: string };
      return (
        candidate.eventName === eventByAction[input.data.action]
        && getAddress(candidate.address) === getAddress(order.poolAddress)
        && args.orderId?.toLowerCase() === order.onchainOrderId.toLowerCase()
      );
    });
    if (!event) {
      return NextResponse.json({ error: "Expected escrow event was not found" }, { status: 422 });
    }

    const args = event.args as Record<string, unknown>;
    const payload = Object.fromEntries(
      Object.entries(args).map(([key, value]) => [
        key,
        typeof value === "bigint" ? value.toString() : value,
      ]),
    );
    const admin = createAdminClient();
    const { data: projected, error: projectionError } = await admin.rpc(
      "server_project_escrow_action",
      {
        p_action: input.data.action,
        p_block_number: Number(receipt.blockNumber),
        p_event_payload: payload as Json,
        p_log_index: event.logIndex,
        p_order_id: order.orderId,
        p_transaction_hash: input.data.transactionHash.toLowerCase(),
      },
    );
    if (projectionError) throw projectionError;

    let proofs: unknown = null;
    if (input.data.action === "mark_delivered") {
      try {
        proofs = await mintOrderProofsForParticipants({
          orderId: order.orderId,
          requestKey: crypto.randomUUID(),
        });
      } catch (proofError) {
        proofs = {
          error:
            proofError instanceof Error
              ? proofError.message
              : "Order proof minting will retry safely.",
        };
      }
    }

    const projectedPayload =
      projected && typeof projected === "object" ? projected as Record<string, unknown> : {};
    return NextResponse.json({ ...projectedPayload, proofs });
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : cause && typeof cause === "object" && "message" in cause
          ? String(cause.message)
          : "Escrow verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
