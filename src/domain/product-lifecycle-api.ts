import { z } from "zod";
import {
  ProductLifecycleCommandError,
  availabilityStatusSchema,
  inventoryMovementSchema,
} from "@/src/domain/product-lifecycle";
import { SellerAccessError } from "@/src/domain/seller-access";

const makerId = z.number().int().positive();
const expectedVersion = z.number().int().positive();
const requestKey = z.string().uuid();
const reason = z.string().trim().min(1).max(500);

export const sellerProductRouteParamSchema = z.object({
  productId: z.coerce.number().int().positive(),
});

export const sellerProductLifecycleRequestSchema = z.discriminatedUnion(
  "action",
  [
    z
      .object({
        action: z.literal("set_availability"),
        makerId,
        status: availabilityStatusSchema,
        reason,
        expectedAvailableAt: z
          .string()
          .datetime({ offset: true })
          .nullable(),
        expectedVersion,
        requestKey,
      })
      .strict(),
    z
      .object({
        action: z.literal("archive"),
        makerId,
        reason,
        requestKey,
      })
      .strict(),
    z
      .object({
        action: z.literal("restore"),
        makerId,
        requestKey,
      })
      .strict(),
    z
      .object({
        action: z.literal("delete_draft"),
        makerId,
        confirmationSlug: z
          .string()
          .trim()
          .min(1)
          .max(160)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        requestKey,
      })
      .strict(),
  ],
);

export const sellerInventoryRequestSchema = z
  .object({
    makerId,
    variantId: z.number().int().positive(),
    movement: inventoryMovementSchema,
    quantity: z.number().int().positive(),
    reason,
    expectedVersion,
    requestKey,
    orderId: z.string().uuid().nullable().default(null),
  })
  .strict();

export const sellerReferenceImpactQuerySchema = z
  .object({
    makerId: z.coerce.number().int().positive(),
  })
  .strict();

export type ProductLifecycleHttpError = {
  status: number;
  body: {
    error: {
      code: string;
      message: string;
    };
  };
};

const publicErrorMessages: Record<string, string> = {
  UNAUTHENTICATED: "Sign in before managing seller products.",
  MEMBERSHIP_REQUIRED: "An active seller membership is required.",
  MAKER_SELECTION_REQUIRED: "Select which shop you want to manage.",
  FORBIDDEN: "You cannot manage this shop.",
  NOT_AUTHORIZED: "You cannot perform this product action.",
  TARGET_MAKER_MISMATCH: "This product does not belong to the selected shop.",
  PRODUCT_NOT_FOUND: "The product was not found.",
  VARIANT_NOT_FOUND: "The product variant was not found.",
  VERSION_CONFLICT: "This product changed elsewhere. Reload it before retrying.",
  IDEMPOTENCY_KEY_REUSED: "This request key was already used for another action.",
  PRODUCT_HAS_REFERENCES:
    "This product is already referenced and cannot be permanently deleted.",
  PRODUCT_MUST_BE_ARCHIVED:
    "This product must be removed from the shop instead of deleted.",
  CONFIRMATION_MISMATCH: "The product confirmation does not match.",
  PRODUCT_NOT_PUBLISHED: "Only a published product can be made available.",
  PRODUCT_NOT_RESTORABLE: "This product cannot be restored.",
  MAKER_NOT_VERIFIED: "The shop must be verified before restoring this product.",
  NO_SELLABLE_VARIANT: "This product has no sellable variant.",
  INSUFFICIENT_STOCK: "There is not enough available stock.",
  RELEASE_EXCEEDS_RESERVED: "The release exceeds reserved stock.",
  SELL_EXCEEDS_RESERVED: "The sale exceeds reserved stock.",
  RESERVED_EXCEEDS_ON_HAND: "Reserved stock cannot exceed stock on hand.",
  INVENTORY_NOT_FINITE: "This variant does not use finite inventory.",
  INVALID_RESULT: "The server received an invalid database result.",
  INTERNAL_ERROR: "The product action could not be completed.",
};

export function isSameOriginMutation(requestUrl: string, origin: string | null) {
  if (!origin) return false;
  try {
    return new URL(requestUrl).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

export function mapProductLifecycleHttpError(
  error: unknown,
): ProductLifecycleHttpError {
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: "INVALID_REQUEST",
          message: "The product request is invalid.",
        },
      },
    };
  }

  const code =
    error instanceof SellerAccessError ||
    error instanceof ProductLifecycleCommandError
      ? error.code
      : "INTERNAL_ERROR";

  const status =
    code === "UNAUTHENTICATED"
      ? 401
      : [
            "MEMBERSHIP_REQUIRED",
            "FORBIDDEN",
            "NOT_AUTHORIZED",
            "TARGET_MAKER_MISMATCH",
          ].includes(code)
        ? 403
        : ["PRODUCT_NOT_FOUND", "VARIANT_NOT_FOUND"].includes(code)
          ? 404
          : [
                "MAKER_SELECTION_REQUIRED",
                "VERSION_CONFLICT",
                "IDEMPOTENCY_KEY_REUSED",
                "PRODUCT_HAS_REFERENCES",
                "PRODUCT_MUST_BE_ARCHIVED",
                "PRODUCT_NOT_PUBLISHED",
                "PRODUCT_NOT_RESTORABLE",
                "MAKER_NOT_VERIFIED",
                "NO_SELLABLE_VARIANT",
                "INSUFFICIENT_STOCK",
                "RELEASE_EXCEEDS_RESERVED",
                "SELL_EXCEEDS_RESERVED",
                "RESERVED_EXCEEDS_ON_HAND",
              ].includes(code)
            ? 409
            : ["INVALID_RESULT", "INTERNAL_ERROR"].includes(code)
              ? 500
              : 400;

  return {
    status,
    body: {
      error: {
        code,
        message:
          publicErrorMessages[code] ??
          "The product request could not be completed.",
      },
    },
  };
}
