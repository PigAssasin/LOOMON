import { describe, expect, it } from "vitest";
import {
  applyEscrowActionToWorkspace,
  emptyCommerceWorkspace,
  type CommerceItem,
} from "@/src/domain/commerce-workspace";

function order(id: string, status = "escrow_funded"): CommerceItem {
  return {
    kind: "order",
    id,
    reference: `LM-26-08-${id.slice(0, 6).toUpperCase()}`,
    status,
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
    makerId: 1,
    makerName: "Lo May",
    productId: 1,
    productSlug: "blue-lotus-tea-set",
    productTitle: "Blue lotus tea set",
    quantity: 1,
  };
}

describe("applyEscrowActionToWorkspace", () => {
  it("updates only the selected order when a seller accepts production", () => {
    const target = "11111111-1111-4111-8111-111111111111";
    const sibling = "22222222-2222-4222-8222-222222222222";
    const workspace = {
      ...emptyCommerceWorkspace,
      sellingOrders: [order(target), order(sibling)],
      buyingOrders: [order(target), order(sibling)],
    };

    const next = applyEscrowActionToWorkspace(workspace, target, "start_production");

    expect(next.sellingOrders.map((item) => [item.id, item.status])).toEqual([
      [target, "in_production"],
      [sibling, "escrow_funded"],
    ]);
    expect(next.buyingOrders.map((item) => [item.id, item.status])).toEqual([
      [target, "in_production"],
      [sibling, "escrow_funded"],
    ]);
  });
});
