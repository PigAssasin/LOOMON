import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  keccak256,
  parseAbi,
  parseEventLogs,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  buildOrderProofSnapshotHashInput,
  parseOrderProofRecord,
  type OrderProofRecord,
} from "@/src/domain/order-proof";
import { ARC_TESTNET } from "@/src/lib/arc";
import { arcTestnet } from "@/src/lib/chains";
import { createAdminClient } from "@/src/lib/supabase/admin";

const proofAbi = parseAbi([
  "function mintOrderProof(address recipient, bytes32 orderHash, bytes32 snapshotHash) returns (uint256 tokenId)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "event OrderProofMinted(uint256 indexed tokenId, address indexed recipient, bytes32 indexed orderHash, bytes32 snapshotHash)",
]);

type CommerceOrder = {
  id: string;
  order_number: string;
  buyer_id: string;
  accepted_quote_version_id: string;
  deposit_invoice_id: string | null;
  status: string;
};

type WalletAccount = {
  address: `0x${string}`;
};

export type PurchasedOrderProof = OrderProofRecord & {
  orderNumber: string;
};

export class OrderProofAccessError extends Error {}
export class OrderProofConfigurationError extends Error {}

function untyped(client: ReturnType<typeof createAdminClient>) {
  return client as unknown as SupabaseClient;
}

export async function listPurchasedOrderProofs(
  ownerUserId: string,
): Promise<PurchasedOrderProof[]> {
  const admin = createAdminClient();
  const { data, error } = await untyped(admin)
    .schema("commerce")
    .from("order_proof_nfts")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const proofs = (data ?? []).map(parseOrderProofRecord);
  if (!proofs.length) return [];

  const { data: orders, error: orderError } = await untyped(admin)
    .schema("commerce")
    .from("orders")
    .select("id,order_number")
    .in(
      "id",
      proofs.map((proof) => proof.orderId),
    );
  if (orderError) throw orderError;

  const orderNumbers = new Map(
    (orders ?? []).map((order) => [
      String(order.id),
      String(order.order_number),
    ]),
  );

  return proofs.map((proof) => ({
    ...proof,
    orderNumber: orderNumbers.get(proof.orderId) ?? "LOOMON demo order",
  }));
}

export async function mintOrderProofForBuyer(input: {
  buyerUserId: string;
  orderId: string;
  requestKey: string;
}) {
  const admin = createAdminClient();
  const db = untyped(admin);
  const { data: orderData, error: orderError } = await db
    .schema("commerce")
    .from("orders")
    .select(
      "id,order_number,buyer_id,accepted_quote_version_id,deposit_invoice_id,status",
    )
    .eq("id", input.orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!orderData || orderData.buyer_id !== input.buyerUserId) {
    throw new OrderProofAccessError("Order not found for this buyer.");
  }
  const order = orderData as CommerceOrder;

  const { data: walletData, error: walletError } = await db
    .schema("wallet")
    .from("accounts")
    .select("address")
    .eq("user_id", input.buyerUserId)
    .eq("chain_id", ARC_TESTNET.id)
    .eq("is_primary", true)
    .not("verified_at", "is", null)
    .maybeSingle();
  if (walletError) throw walletError;
  if (!walletData) {
    throw new OrderProofAccessError(
      "Connect and verify a primary Arc wallet before minting.",
    );
  }
  const wallet = walletData as WalletAccount;

  const orderHash = keccak256(toBytes(order.id));
  const snapshotHash = keccak256(
    toBytes(
      buildOrderProofSnapshotHashInput({
        orderId: order.id,
        acceptedQuoteVersionId: order.accepted_quote_version_id,
        depositInvoiceId: order.deposit_invoice_id,
      }),
    ),
  );

  const { data: preparedData, error: prepareError } = await admin.rpc(
    "server_prepare_delivered_order_proof",
    {
      request_key: input.requestKey,
      target_order_hash: orderHash,
      target_order_id: order.id,
      target_recipient_wallet_address: wallet.address,
      target_snapshot_hash: snapshotHash,
    },
  );
  if (prepareError) throw prepareError;

  let proof = parseOrderProofRecord(preparedData);
  if (proof.mintStatus === "confirmed") {
    return { proof, orderNumber: order.order_number, mintConfigured: true };
  }

  const contractAddress = process.env
    .LOOMON_ORDER_PROOF_ADDRESS as `0x${string}` | undefined;
  const minterKey = process.env
    .ARC_PROOF_MINTER_PRIVATE_KEY as `0x${string}` | undefined;
  if (
    !contractAddress?.match(/^0x[0-9a-fA-F]{40}$/) ||
    !minterKey?.match(/^0x[0-9a-fA-F]{64}$/)
  ) {
    return { proof, orderNumber: order.order_number, mintConfigured: false };
  }

  const account = privateKeyToAccount(minterKey);
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(ARC_TESTNET.rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_TESTNET.rpcUrl),
  });

  let transactionHash: `0x${string}` | null = null;
  try {
    transactionHash = await walletClient.writeContract({
      address: getAddress(contractAddress),
      abi: proofAbi,
      functionName: "mintOrderProof",
      args: [getAddress(wallet.address), orderHash, snapshotHash],
    });

    const { data: submittedData, error: submittedError } = await admin.rpc(
      "server_mark_order_proof_submitted",
      {
        target_contract_address: contractAddress,
        target_proof_id: proof.id,
        target_transaction_hash: transactionHash,
      },
    );
    if (submittedError) throw submittedError;
    proof = parseOrderProofRecord(submittedData);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    });
    if (receipt.status !== "success") throw new Error("MINT_TRANSACTION_REVERTED");

    const events = parseEventLogs({
      abi: proofAbi,
      eventName: "OrderProofMinted",
      logs: receipt.logs,
      strict: true,
    });
    const event = events.find(
      (candidate) =>
        candidate.args.orderHash === orderHash &&
        getAddress(candidate.args.recipient) === getAddress(wallet.address),
    );
    if (!event) throw new Error("MINT_EVENT_NOT_FOUND");

    const metadataUri = await publicClient.readContract({
      address: getAddress(contractAddress),
      abi: proofAbi,
      functionName: "tokenURI",
      args: [event.args.tokenId],
    });
    const payloadHash = keccak256(
      toBytes(
        JSON.stringify({
          orderHash,
          recipient: getAddress(wallet.address),
          snapshotHash,
          tokenId: event.args.tokenId.toString(),
        }),
      ),
    );

    const { data: confirmedData, error: confirmedError } = await admin.rpc(
      "server_confirm_order_proof",
      {
        target_block_number: Number(receipt.blockNumber),
        target_log_index: event.logIndex,
        target_metadata_uri: metadataUri,
        target_payload_hash: payloadHash,
        target_proof_id: proof.id,
        target_token_id: Number(event.args.tokenId),
        target_transaction_hash: transactionHash,
      },
    );
    if (confirmedError) throw confirmedError;
    proof = parseOrderProofRecord(confirmedData);
  } catch (error) {
    await admin.rpc("server_fail_order_proof", {
      target_failure_code:
        error instanceof Error ? error.message : "ORDER_PROOF_MINT_FAILED",
      target_proof_id: proof.id,
    });
    throw error;
  }

  return { proof, orderNumber: order.order_number, mintConfigured: true };
}
