import { describe, expect, it } from "vitest";
import {
  buildOrderProofExplorerUrl,
  buildOrderProofSnapshotHashInput,
  parseOrderProofRecord,
} from "@/src/domain/order-proof";

describe("order proof domain", () => {
  it("normalizes a confirmed proof for the Purchased UI", () => {
    const proof = parseOrderProofRecord({
      id: "11111111-1111-4111-8111-111111111111",
      order_id: "22222222-2222-4222-8222-222222222222",
      owner_user_id: "33333333-3333-4333-8333-333333333333",
      recipient_wallet_address: "0x1111111111111111111111111111111111111111",
      chain_id: 5042002,
      contract_address: "0x2222222222222222222222222222222222222222",
      token_id: 7,
      order_hash: `0x${"a".repeat(64)}`,
      snapshot_hash: `0x${"b".repeat(64)}`,
      mint_status: "confirmed",
      mint_transaction_hash: `0x${"c".repeat(64)}`,
      block_number: 123,
      metadata_uri: "data:application/json;base64,test",
      failure_code: null,
      attempt_count: 1,
      idempotency_key: "44444444-4444-4444-8444-444444444444",
      submitted_at: "2026-07-25T00:00:00.000Z",
      confirmed_at: "2026-07-25T00:01:00.000Z",
      created_at: "2026-07-25T00:00:00.000Z",
      updated_at: "2026-07-25T00:01:00.000Z",
    });

    expect(proof.mintStatus).toBe("confirmed");
    expect(proof.tokenId).toBe("7");
    expect(proof.chainId).toBe(5_042_002);
  });

  it("builds a transaction explorer link only for a valid Arc hash", () => {
    const hash = `0x${"c".repeat(64)}`;
    expect(buildOrderProofExplorerUrl(hash)).toBe(
      `https://testnet.arcscan.app/tx/${hash}`,
    );
    expect(buildOrderProofExplorerUrl(null)).toBeNull();
  });

  it("uses stable commercial fields for the snapshot hash input", () => {
    expect(
      buildOrderProofSnapshotHashInput({
        orderId: "order-1",
        acceptedQuoteVersionId: "quote-1",
        depositInvoiceId: "invoice-1",
      }),
    ).toBe(
      '{"acceptedQuoteVersionId":"quote-1","depositInvoiceId":"invoice-1","orderId":"order-1","version":1}',
    );
  });
});
