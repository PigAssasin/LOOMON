import { z } from "zod";

export const commerceItemSchema = z.object({
  kind: z.enum(["request", "order"]),
  id: z.uuid(),
  reference: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  makerId: z.number(),
  makerName: z.string(),
  productId: z.number(),
  productSlug: z.string(),
  productTitle: z.string(),
  quantity: z.number(),
  threadId: z.uuid().nullable().optional(),
  requiredBy: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  sellerNote: z.string().nullable().optional(),
  buyerName: z.string().nullable().optional(),
  deliveredAt: z.string().nullable().optional(),
  receivedAt: z.string().nullable().optional(),
  proofTokenId: z.union([z.string(), z.number()]).nullable().optional(),
  proofTransactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).nullable().optional(),
});

export type CommerceItem = z.infer<typeof commerceItemSchema>;

export const commerceWorkspaceSchema = z.object({
  buyingRequests: z.array(commerceItemSchema),
  sellingRequests: z.array(commerceItemSchema),
  buyingOrders: z.array(commerceItemSchema),
  sellingOrders: z.array(commerceItemSchema),
});

export type CommerceWorkspace = z.infer<typeof commerceWorkspaceSchema>;

export const emptyCommerceWorkspace: CommerceWorkspace = {
  buyingRequests: [],
  sellingRequests: [],
  buyingOrders: [],
  sellingOrders: [],
};

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    submitted: "Waiting for seller",
    seller_review: "Seller is reviewing",
    changes_requested: "Changes requested",
    accepted: "Accepted",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
    seller_accepted: "Order accepted",
    escrow_funded: "Paid · waiting for seller",
    in_progress: "In progress",
    in_production: "Seller accepted",
    seller_marked_delivered: "Delivered · mint proof",
    release_hold: "Completed · 7-day protection",
    released: "Seller paid",
    refunded: "Refunded",
    disputed: "Payment disputed",
    resolved: "Dispute resolved",
    delivery_disputed: "Delivery issue reported",
    buyer_confirmed_received: "Preparing your proof",
    proof_pending: "Minting on Arc",
    proof_minted: "Delivered · Proof minted",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export function buyingStage(item: CommerceItem) {
  if (item.kind === "request") {
    return ["rejected", "withdrawn", "cancelled", "expired"].includes(item.status)
      ? "history"
      : "requests";
  }
  if (item.status === "escrow_funded") return "requests";
  if (["in_production", "seller_marked_delivered"].includes(item.status)) return "active";
  return [
    "seller_accepted",
    "in_progress",
    "buyer_confirmed_received",
    "proof_pending",
    "proof_minted",
    "release_hold",
    "cancelled",
    "released",
    "refunded",
    "resolved",
  ].includes(item.status)
    ? "history"
    : "active";
}

export function sellingStage(item: CommerceItem) {
  if (item.kind === "request") {
    return ["submitted", "seller_review", "changes_requested"].includes(item.status)
      ? "incoming"
      : "history";
  }
  if (item.status === "escrow_funded") return "incoming";
  if (item.status === "in_production") return "active";
  return [
    "seller_accepted",
    "in_progress",
    "seller_marked_delivered",
    "buyer_confirmed_received",
    "proof_pending",
    "proof_minted",
    "release_hold",
    "cancelled",
    "released",
    "refunded",
    "resolved",
  ].includes(item.status)
    ? "history"
    : "active";
}

export function statusForEscrowAction(action: string) {
  if (action === "mark_delivered") return "seller_marked_delivered";
  if (action === "start_production") return "in_production";
  if (action === "confirm_completion") return "proof_minted";
  return "refunded";
}

export function applyEscrowActionToWorkspace(
  workspace: CommerceWorkspace,
  orderId: string,
  action: string,
): CommerceWorkspace {
  const status = statusForEscrowAction(action);
  const update = (order: CommerceItem) =>
    order.id === orderId ? { ...order, status } : order;

  return {
    ...workspace,
    buyingOrders: workspace.buyingOrders.map(update),
    sellingOrders: workspace.sellingOrders.map(update),
  };
}

function mergeItems(left: CommerceItem[], right: CommerceItem[]) {
  const byKey = new Map<string, CommerceItem>();
  for (const item of [...left, ...right]) {
    const key = `${item.kind}:${item.id}`;
    const current = byKey.get(key);
    if (!current || Date.parse(item.updatedAt) >= Date.parse(current.updatedAt)) {
      byKey.set(key, item);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

export function mergeCommerceWorkspaces(
  primary: CommerceWorkspace,
  secondary: CommerceWorkspace,
): CommerceWorkspace {
  return {
    buyingRequests: mergeItems(primary.buyingRequests, secondary.buyingRequests),
    sellingRequests: mergeItems(primary.sellingRequests, secondary.sellingRequests),
    buyingOrders: mergeItems(primary.buyingOrders, secondary.buyingOrders),
    sellingOrders: mergeItems(primary.sellingOrders, secondary.sellingOrders),
  };
}
