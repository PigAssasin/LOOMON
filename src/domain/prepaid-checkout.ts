import { z } from "zod";

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const bytes32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

export const prepaidCheckoutSchema = z.object({
  checkoutId: z.uuid(),
  onchainOrderId: bytes32Schema,
  termsHash: bytes32Schema,
  buyerAddress: addressSchema,
  sellerAddress: addressSchema,
  poolAddress: addressSchema,
  amountAtomic: z.string().regex(/^\d+$/),
  amount: z.coerce.number().positive(),
  expiresAt: z.string(),
  status: z.enum([
    "prepared",
    "approval_pending",
    "submitted",
    "confirmed",
    "failed",
    "expired",
    "cancelled",
  ]),
  idempotent: z.boolean(),
});

export type PrepaidCheckout = z.infer<typeof prepaidCheckoutSchema>;

export const prepaidOrderResultSchema = z.object({
  orderId: z.uuid(),
  orderReference: z.string().regex(/^LM-\d{2}-\d{2}-[A-Z0-9]{6}$/),
  checkoutId: z.uuid(),
  transactionHash: bytes32Schema,
  status: z.string(),
  idempotent: z.boolean(),
});

export type PrepaidOrderResult = z.infer<typeof prepaidOrderResultSchema>;

export const confirmPrepaidOrderRequestSchema = z.object({
  checkoutId: z.uuid(),
  transactionHash: bytes32Schema,
});
