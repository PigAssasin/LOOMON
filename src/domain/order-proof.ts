import { z } from "zod";
import { ARC_TESTNET } from "@/src/lib/arc";

const ethereumAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const transactionHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

const orderProofRecordSchema = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  owner_user_id: z.uuid(),
  recipient_wallet_address: ethereumAddress,
  chain_id: z.literal(5_042_002),
  contract_address: ethereumAddress.nullable(),
  token_id: z.union([z.string(), z.number()]).nullable(),
  order_hash: transactionHash,
  snapshot_hash: transactionHash,
  mint_status: z.enum(["pending", "submitted", "confirmed", "failed"]),
  mint_transaction_hash: transactionHash.nullable(),
  block_number: z.union([z.string(), z.number()]).nullable(),
  metadata_uri: z.string().nullable(),
  failure_code: z.string().nullable(),
  attempt_count: z.number().int().nonnegative(),
  idempotency_key: z.uuid(),
  submitted_at: z.string().nullable(),
  confirmed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type OrderProofRecord = ReturnType<typeof parseOrderProofRecord>;

export function parseOrderProofRecord(input: unknown) {
  const value = orderProofRecordSchema.parse(input);
  return {
    id: value.id,
    orderId: value.order_id,
    ownerUserId: value.owner_user_id,
    recipientWalletAddress: value.recipient_wallet_address,
    chainId: value.chain_id,
    contractAddress: value.contract_address,
    tokenId: value.token_id === null ? null : String(value.token_id),
    orderHash: value.order_hash,
    snapshotHash: value.snapshot_hash,
    mintStatus: value.mint_status,
    mintTransactionHash: value.mint_transaction_hash,
    blockNumber: value.block_number === null ? null : String(value.block_number),
    metadataUri: value.metadata_uri,
    failureCode: value.failure_code,
    attemptCount: value.attempt_count,
    submittedAt: value.submitted_at,
    confirmedAt: value.confirmed_at,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

export function buildOrderProofExplorerUrl(hash: string | null) {
  if (!hash || !transactionHash.safeParse(hash).success) return null;
  return `${ARC_TESTNET.explorerUrl}/tx/${hash}`;
}

export function buildOrderProofSnapshotHashInput(input: {
  orderId: string;
  acceptedQuoteVersionId: string;
  depositInvoiceId: string | null;
}) {
  return JSON.stringify({
    acceptedQuoteVersionId: input.acceptedQuoteVersionId,
    depositInvoiceId: input.depositInvoiceId,
    orderId: input.orderId,
    version: 1,
  });
}
