import { describe, expect, it } from "vitest";
import {
  prepaidCheckoutSchema,
  prepaidOrderResultSchema,
} from "@/src/domain/prepaid-checkout";

describe("prepaid checkout domain", () => {
  it("accepts typed Arc escrow calldata", () => {
    const parsed = prepaidCheckoutSchema.parse({
      checkoutId: "11111111-1111-4111-8111-111111111111",
      onchainOrderId: `0x${"11".repeat(32)}`,
      termsHash: `0x${"22".repeat(32)}`,
      buyerAddress: `0x${"33".repeat(20)}`,
      sellerAddress: `0x${"44".repeat(20)}`,
      poolAddress: `0x${"55".repeat(20)}`,
      amountAtomic: "240000000",
      amount: 240,
      expiresAt: "2026-07-25T12:00:00Z",
      status: "prepared",
      idempotent: false,
    });
    expect(parsed.amountAtomic).toBe("240000000");
  });

  it("rejects non-atomic and malformed transaction data", () => {
    expect(() =>
      prepaidCheckoutSchema.parse({
        checkoutId: "11111111-1111-4111-8111-111111111111",
        onchainOrderId: "not-a-hash",
        termsHash: `0x${"22".repeat(32)}`,
        buyerAddress: `0x${"33".repeat(20)}`,
        sellerAddress: `0x${"44".repeat(20)}`,
        poolAddress: `0x${"55".repeat(20)}`,
        amountAtomic: "240.5",
        amount: 240,
        expiresAt: "2026-07-25T12:00:00Z",
        status: "prepared",
        idempotent: false,
      }),
    ).toThrow();
  });

  it("validates the funded order result", () => {
    expect(
      prepaidOrderResultSchema.parse({
        orderId: "11111111-1111-4111-8111-111111111111",
        orderReference: "LM-26-07-A1B2C3",
        checkoutId: "22222222-2222-4222-8222-222222222222",
        transactionHash: `0x${"66".repeat(32)}`,
        status: "escrow_funded",
        idempotent: false,
      }),
    ).toMatchObject({ status: "escrow_funded" });
  });
});
