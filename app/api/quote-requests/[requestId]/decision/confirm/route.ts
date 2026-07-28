import { NextResponse } from "next/server";
import { createPublicClient, getAddress, http, keccak256, parseEventLogs, toBytes } from "viem";
import { z } from "zod";
import { ARC_TESTNET } from "@/src/lib/arc";
import { arcTestnet } from "@/src/lib/chains";
import {
  LOOMON_QUOTE_DECISION_ADDRESS,
  loomonQuoteDecisionAbi,
  quoteDecisionCode,
} from "@/src/lib/payments/quote-decision";
import { createAdminClient } from "@/src/lib/supabase/admin";
import type { Json } from "@/src/lib/supabase/database.types";

const SINGLE_DEMO_SELLER_ADDRESS = "0xd59aa8db407d4219fe4b104ca4142df14301dec4";

const requestSchema = z.object({
  action: z.enum(["accept", "reject"]),
  requestKey: z.uuid(),
  transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await context.params;
  const input = requestSchema.safeParse(await request.json());
  if (!input.success || !z.uuid().safeParse(requestId).success) {
    return NextResponse.json({ error: "Invalid quote decision" }, { status: 400 });
  }

  try {
    const requestIdHash = keccak256(toBytes(requestId));
    const decision = quoteDecisionCode[input.data.action];
    const client = createPublicClient({
      chain: arcTestnet,
      transport: http(ARC_TESTNET.rpcUrl),
    });
    const receipt = await client.getTransactionReceipt({
      hash: input.data.transactionHash as `0x${string}`,
    });
    if (
      receipt.status !== "success"
      || getAddress(receipt.from) !== getAddress(SINGLE_DEMO_SELLER_ADDRESS)
      || !receipt.to
      || getAddress(receipt.to) !== getAddress(LOOMON_QUOTE_DECISION_ADDRESS)
    ) {
      return NextResponse.json({ error: "Arc quote decision transaction mismatch" }, { status: 422 });
    }

    const logs = parseEventLogs({
      abi: loomonQuoteDecisionAbi,
      logs: receipt.logs,
      strict: false,
    });
    const event = logs.find((candidate) => {
      const args = candidate.args as {
        requestIdHash?: string;
        seller?: string;
        decision?: number;
        decisionHash?: string;
      };
      return (
        candidate.eventName === "QuoteRequestDecided"
        && getAddress(candidate.address) === getAddress(LOOMON_QUOTE_DECISION_ADDRESS)
        && args.requestIdHash?.toLowerCase() === requestIdHash.toLowerCase()
        && args.seller
        && getAddress(args.seller) === getAddress(SINGLE_DEMO_SELLER_ADDRESS)
        && Number(args.decision) === decision
      );
    });
    if (!event) {
      return NextResponse.json({ error: "Expected quote decision event was not found" }, { status: 422 });
    }

    const args = event.args as Record<string, unknown>;
    const payload = Object.fromEntries(
      Object.entries(args).map(([key, value]) => [
        key,
        typeof value === "bigint" ? value.toString() : value,
      ]),
    );
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("server_project_quote_request_decision" as never, {
      p_action: input.data.action,
      p_block_number: Number(receipt.blockNumber),
      p_decision_contract_address: LOOMON_QUOTE_DECISION_ADDRESS.toLowerCase(),
      p_event_payload: payload as Json,
      p_log_index: event.logIndex,
      p_reason: input.data.action === "reject" ? "Seller rejected request" : "",
      p_request_id: requestId,
      p_request_key: input.data.requestKey,
      p_seller_address: SINGLE_DEMO_SELLER_ADDRESS,
      p_transaction_hash: input.data.transactionHash.toLowerCase(),
    } as never);
    if (error) throw error;
    return NextResponse.json(data);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Quote decision verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
