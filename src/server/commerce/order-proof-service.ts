import "server-only";

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
  user_id?: string;
};

export type PurchasedOrderProof = OrderProofRecord & {
  orderNumber: string;
};

export class OrderProofAccessError extends Error {}
export class OrderProofConfigurationError extends Error {}

type ProofParticipant = {
  role: "buyer" | "seller";
  userId: string;
  walletAddress: `0x${string}`;
};

async function callServerRpc(
  admin: ReturnType<typeof createAdminClient>,
  fn: string,
  args: Record<string, unknown>,
) {
  const rpc = admin.rpc as unknown as (
    rpcName: string,
    rpcArgs: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: Error | null }>;
  return rpc(fn, args);
}

export async function listPurchasedOrderProofs(
  ownerUserId: string,
): Promise<PurchasedOrderProof[]> {
  const admin = createAdminClient();
  const { data, error } = await callServerRpc(
    admin,
    "server_list_purchased_order_proofs",
    { target_owner_user_id: ownerUserId },
  );
  if (error) throw error;

  return (Array.isArray(data) ? data : []).map((row) => ({
    ...parseOrderProofRecord(row),
    orderNumber:
      typeof row === "object" &&
      row !== null &&
      "order_number" in row &&
      typeof row.order_number === "string"
        ? row.order_number
        : "LOOMON demo order",
  }));
}

export async function mintOrderProofForBuyer(input: {
  buyerUserId: string;
  orderId: string;
  requestKey: string;
}) {
  const admin = createAdminClient();
  const { data: contextData, error: contextError } = await callServerRpc(
    admin,
    "server_get_order_proof_context",
    {
      target_buyer_user_id: input.buyerUserId,
      target_order_id: input.orderId,
    },
  );
  if (contextError) throw contextError;
  if (!contextData || typeof contextData !== "object") {
    throw new OrderProofAccessError("Order not found for this buyer.");
  }

  const context = contextData as { order?: CommerceOrder; wallet?: WalletAccount | null };
  if (!context.order || context.order.buyer_id !== input.buyerUserId) {
    throw new OrderProofAccessError("Order not found for this buyer.");
  }
  const order = context.order;
  if (!context.wallet) {
    throw new OrderProofAccessError(
      "Connect and verify a primary Arc wallet before minting.",
    );
  }
  const wallet = context.wallet;

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

export async function mintOrderProofsForParticipants(input: {
  orderId: string;
  requestKey: string;
}) {
  const admin = createAdminClient();
  const { data: contextData, error: contextError } = await callServerRpc(
    admin,
    "server_get_order_participant_proof_context",
    { target_order_id: input.orderId },
  );
  if (contextError) throw contextError;
  if (!contextData || typeof contextData !== "object") {
    throw new OrderProofAccessError("Order proof context not found.");
  }

  const context = contextData as {
    order?: CommerceOrder & { maker_id?: number };
    buyerWallet?: WalletAccount | null;
    sellerWallet?: WalletAccount | null;
  };
  if (!context.order) throw new OrderProofAccessError("Order not found.");

  const participants: ProofParticipant[] = [];
  if (context.buyerWallet?.address) {
    participants.push({
      role: "buyer",
      userId: context.order.buyer_id,
      walletAddress: context.buyerWallet.address,
    });
  }
  if (context.sellerWallet?.address && context.sellerWallet.user_id) {
    participants.push({
      role: "seller",
      userId: context.sellerWallet.user_id,
      walletAddress: context.sellerWallet.address,
    });
  }
  if (!participants.length) {
    throw new OrderProofAccessError("No verified participant wallets found.");
  }

  const results: Array<{ role: ProofParticipant["role"]; proof: OrderProofRecord }> = [];
  for (const participant of participants) {
    const proof = await mintParticipantProof({
      admin,
      order: context.order,
      participant,
      requestKey:
        participant.role === "buyer" ? input.requestKey : crypto.randomUUID(),
    });
    results.push({ role: participant.role, proof });
  }

  return {
    orderNumber: context.order.order_number,
    proofs: results,
    mintConfigured: true,
  };
}

async function mintParticipantProof(input: {
  admin: ReturnType<typeof createAdminClient>;
  order: CommerceOrder;
  participant: ProofParticipant;
  requestKey: string;
}) {
  const orderHash = keccak256(
    toBytes(`loomon-order-proof:${input.participant.role}:${input.order.id}`),
  );
  const snapshotHash = keccak256(
    toBytes(
      JSON.stringify({
        role: input.participant.role,
        source: buildOrderProofSnapshotHashInput({
          orderId: input.order.id,
          acceptedQuoteVersionId: input.order.accepted_quote_version_id,
          depositInvoiceId: input.order.deposit_invoice_id,
        }),
      }),
    ),
  );

  const { data: preparedData, error: prepareError } = await callServerRpc(
    input.admin,
    "server_prepare_participant_order_proof",
    {
      request_key: input.requestKey,
      target_order_hash: orderHash,
      target_order_id: input.order.id,
      target_owner_user_id: input.participant.userId,
      target_recipient_wallet_address: input.participant.walletAddress,
      target_snapshot_hash: snapshotHash,
    },
  );
  if (prepareError) throw prepareError;

  let proof = parseOrderProofRecord(preparedData);
  if (proof.mintStatus === "confirmed") return proof;

  const contractAddress = process.env
    .LOOMON_ORDER_PROOF_ADDRESS as `0x${string}` | undefined;
  const minterKey = process.env
    .ARC_PROOF_MINTER_PRIVATE_KEY as `0x${string}` | undefined;
  if (
    !contractAddress?.match(/^0x[0-9a-fA-F]{40}$/) ||
    !minterKey?.match(/^0x[0-9a-fA-F]{64}$/)
  ) {
    return proof;
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
      args: [getAddress(input.participant.walletAddress), orderHash, snapshotHash],
    });

    const { data: submittedData, error: submittedError } = await input.admin.rpc(
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
        getAddress(candidate.args.recipient) ===
          getAddress(input.participant.walletAddress),
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
          recipient: getAddress(input.participant.walletAddress),
          role: input.participant.role,
          snapshotHash,
          tokenId: event.args.tokenId.toString(),
        }),
      ),
    );

    const { data: confirmedData, error: confirmedError } = await input.admin.rpc(
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
    await input.admin.rpc("server_fail_order_proof", {
      target_failure_code:
        error instanceof Error ? error.message : "ORDER_PROOF_MINT_FAILED",
      target_proof_id: proof.id,
    });
    throw error;
  }

  return proof;
}
