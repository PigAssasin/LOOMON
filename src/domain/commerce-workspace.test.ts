import { describe, expect, it } from "vitest";
import {
  applyEscrowActionToWorkspace,
  emptyCommerceWorkspace,
  mergeCommerceWorkspaces,
  type CommerceItem,
} from "@/src/domain/commerce-workspace";

function order(id: string, status = "escrow_funded", updatedAt = "2026-08-08T00:00:00.000Z"): CommerceItem {
  return {
    kind: "order",
    id,
    reference: `LM-26-08-${id.slice(0, 6).toUpperCase()}`,
    status,
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt,
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

describe("mergeCommerceWorkspaces", () => {
  it("restores wallet-native buyer orders when the session workspace is empty", () => {
    const walletOrder = order("33333333-3333-4333-8333-333333333333");

    const merged = mergeCommerceWorkspaces(emptyCommerceWorkspace, {
      ...emptyCommerceWorkspace,
      buyingOrders: [walletOrder],
    });

    expect(merged.buyingOrders).toEqual([walletOrder]);
  });

  it("keeps the fresher copy when the same order appears in both workspaces", () => {
    const id = "44444444-4444-4444-8444-444444444444";
    const older = order(id, "escrow_funded", "2026-08-08T00:00:00.000Z");
    const newer = order(id, "in_production", "2026-08-08T01:00:00.000Z");

    const merged = mergeCommerceWorkspaces(
      { ...emptyCommerceWorkspace, buyingOrders: [older] },
      { ...emptyCommerceWorkspace, buyingOrders: [newer] },
    );

    expect(merged.buyingOrders).toEqual([newer]);
  });
});
