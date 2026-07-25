import { z } from "zod";

const makerId = z.number().int().positive();
const productId = z.number().int().positive();
const variantId = z.number().int().positive();
const expectedVersion = z.number().int().positive();
const requestKey = z.string().uuid();
const reason = z.string().trim().min(1).max(500);
const source = z.enum(["seller", "agent_confirmed"]).default("seller");

export const availabilityStatusSchema = z.enum([
  "available",
  "paused",
  "out_of_stock",
  "discontinued",
]);

export const setProductAvailabilityCommandSchema = z
  .object({
    makerId,
    productId,
    status: availabilityStatusSchema,
    reason,
    expectedAvailableAt: z
      .string()
      .datetime({ offset: true })
      .nullable(),
    expectedVersion,
    requestKey,
    source,
  })
  .strict();

export const archiveProductCommandSchema = z
  .object({
    makerId,
    productId,
    reason,
    requestKey,
    source,
  })
  .strict();

export const restoreProductCommandSchema = z
  .object({
    makerId,
    productId,
    requestKey,
  })
  .strict();

export const deleteProductDraftCommandSchema = z
  .object({
    makerId,
    productId,
    confirmationSlug: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    requestKey,
  })
  .strict();

export const inventoryMovementSchema = z.enum([
  "receive",
  "reserve",
  "release",
  "sell",
  "adjust",
]);

export const adjustVariantInventoryCommandSchema = z
  .object({
    makerId,
    variantId,
    movement: inventoryMovementSchema,
    quantity: z.number().int().positive(),
    reason,
    expectedVersion,
    requestKey,
    orderId: z.string().uuid().nullable().default(null),
    source,
  })
  .strict();

export const productReferenceImpactCommandSchema = z
  .object({
    makerId,
    productId,
  })
  .strict();

export const productAvailabilityResultSchema = z
  .object({
    product_id: productId,
    status: availabilityStatusSchema,
    expected_available_at: z.string().datetime({ offset: true }).nullable(),
    version: z.number().int().positive(),
  })
  .strict();

export const productLifecycleResultSchema = z
  .object({
    product_id: productId,
    status: z.enum(["archived", "published"]),
    availability: availabilityStatusSchema.optional(),
  })
  .strict();

export const deleteProductDraftResultSchema = z
  .object({
    product_id: productId,
    deleted: z.literal(true),
    media_cleanup_jobs: z.number().int().nonnegative(),
  })
  .strict();

export const inventoryResultSchema = z
  .object({
    variant_id: variantId,
    on_hand: z.number().int().nonnegative(),
    reserved: z.number().int().nonnegative(),
    available_to_sell: z.number().int(),
    version: z.number().int().positive(),
  })
  .strict();

export const productReferenceImpactResultSchema = z
  .object({
    product_id: productId,
    maker_id: makerId,
    slug: z.string().min(1),
    editorial_status: z.enum([
      "draft",
      "in_review",
      "published",
      "rejected",
      "archived",
    ]),
    published_version_id: z.number().int().positive().nullable(),
    availability_status: availabilityStatusSchema,
    availability_version: z.number().int().positive(),
    references: z
      .object({
        quotes: z.number().int().nonnegative(),
        customization_projects: z.number().int().nonnegative(),
        orders: z.number().int().nonnegative(),
      })
      .strict(),
    can_hard_delete: z.boolean(),
    recommended_action: z.enum(["delete_draft", "archive", "none"]),
  })
  .strict();

export type SetProductAvailabilityCommand = z.infer<
  typeof setProductAvailabilityCommandSchema
>;
export type ArchiveProductCommand = z.infer<
  typeof archiveProductCommandSchema
>;
export type RestoreProductCommand = z.infer<
  typeof restoreProductCommandSchema
>;
export type DeleteProductDraftCommand = z.infer<
  typeof deleteProductDraftCommandSchema
>;
export type AdjustVariantInventoryCommand = z.infer<
  typeof adjustVariantInventoryCommandSchema
>;
export type ProductReferenceImpactCommand = z.infer<
  typeof productReferenceImpactCommandSchema
>;

export const productLifecycleErrorCodes = [
  "UNAUTHENTICATED",
  "MEMBERSHIP_REQUIRED",
  "MAKER_SELECTION_REQUIRED",
  "FORBIDDEN",
  "ACTOR_REQUIRED",
  "REQUEST_KEY_REQUIRED",
  "INVALID_AVAILABILITY_STATUS",
  "INVALID_SOURCE",
  "IDEMPOTENCY_KEY_REUSED",
  "PRODUCT_NOT_FOUND",
  "NOT_AUTHORIZED",
  "TARGET_MAKER_MISMATCH",
  "VERSION_CONFLICT",
  "PRODUCT_NOT_PUBLISHED",
  "NO_SELLABLE_VARIANT",
  "PRODUCT_NOT_RESTORABLE",
  "MAKER_NOT_VERIFIED",
  "CONFIRMATION_MISMATCH",
  "PRODUCT_MUST_BE_ARCHIVED",
  "PRODUCT_HAS_REFERENCES",
  "VARIANT_NOT_FOUND",
  "INVALID_QUANTITY",
  "INVALID_MOVEMENT_TYPE",
  "INVENTORY_NOT_FINITE",
  "INSUFFICIENT_STOCK",
  "RELEASE_EXCEEDS_RESERVED",
  "SELL_EXCEEDS_RESERVED",
  "RESERVED_EXCEEDS_ON_HAND",
  "INVALID_RESULT",
  "INTERNAL_ERROR",
] as const;

export type ProductLifecycleErrorCode =
  (typeof productLifecycleErrorCodes)[number];

export class ProductLifecycleCommandError extends Error {
  constructor(
    public readonly code: ProductLifecycleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProductLifecycleCommandError";
  }
}

export function mapProductLifecycleDatabaseError(
  error: { message?: string; code?: string } | null,
): ProductLifecycleCommandError {
  const message = error?.message ?? "";
  const code = productLifecycleErrorCodes.find(
    (candidate) =>
      candidate !== "INVALID_RESULT" &&
      candidate !== "INTERNAL_ERROR" &&
      new RegExp(`(^|\\W)${candidate}(\\W|$)`).test(message),
  );

  if (code) {
    return new ProductLifecycleCommandError(code, code);
  }

  return new ProductLifecycleCommandError(
    "INTERNAL_ERROR",
    "The product command could not be completed.",
  );
}

