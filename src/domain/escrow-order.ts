import { z } from "zod";

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const bytes32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

export const escrowActionSchema = z.enum([
  "start_production",
  "mark_delivered",
  "confirm_completion",
  "claim",
  "cancel",
  "refund",
  "dispute",
]);
export type EscrowAction = z.infer<typeof escrowActionSchema>;

export const escrowOrderContextSchema = z.object({
  orderId: z.uuid(),
  orderReference: z.string(),
  status: z.string(),
  role: z.enum(["buyer", "seller"]),
  poolAddress: addressSchema,
  onchainOrderId: bytes32Schema,
  buyerAddress: addressSchema,
  sellerAddress: addressSchema,
  amountAtomic: z.string().regex(/^\d+$/),
  sellerClaimableAt: z.string().nullable().optional(),
});
export type EscrowOrderContext = z.infer<typeof escrowOrderContextSchema>;

export const confirmEscrowActionSchema = z.object({
  action: escrowActionSchema,
  transactionHash: bytes32Schema,
  walletAddress: addressSchema.optional(),
});
