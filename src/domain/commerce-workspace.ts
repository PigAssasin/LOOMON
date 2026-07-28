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
    escrow_funded: "Funded in Arc escrow",
    in_progress: "In progress",
    in_production: "In production",
    seller_marked_delivered: "Confirm delivery",
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
  return ["proof_minted", "cancelled", "released", "refunded", "resolved"].includes(item.status)
    ? "history"
    : "active";
}

export function sellingStage(item: CommerceItem) {
  if (item.kind === "request") {
    return ["submitted", "seller_review", "changes_requested"].includes(item.status)
      ? "incoming"
      : "history";
  }
  return ["proof_minted", "cancelled", "released", "refunded", "resolved"].includes(item.status)
    ? "history"
    : "active";
}
