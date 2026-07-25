import "server-only";

import { z } from "zod";
import {
  adjustVariantInventoryCommandSchema,
  archiveProductCommandSchema,
  deleteProductDraftCommandSchema,
  deleteProductDraftResultSchema,
  inventoryResultSchema,
  mapProductLifecycleDatabaseError,
  productAvailabilityResultSchema,
  productLifecycleResultSchema,
  productReferenceImpactCommandSchema,
  productReferenceImpactResultSchema,
  restoreProductCommandSchema,
  setProductAvailabilityCommandSchema,
  ProductLifecycleCommandError,
  type AdjustVariantInventoryCommand,
  type ArchiveProductCommand,
  type DeleteProductDraftCommand,
  type ProductReferenceImpactCommand,
  type RestoreProductCommand,
  type SetProductAvailabilityCommand,
} from "@/src/domain/product-lifecycle";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { resolveSellerContext } from "@/src/server/auth/seller-context";

type ProductCommandName =
  | "set_product_availability"
  | "archive_product"
  | "restore_archived_product"
  | "delete_product_draft"
  | "adjust_variant_inventory"
  | "get_product_reference_impact";

type ProductCommandLog = {
  command: ProductCommandName;
  makerId: number;
  productId?: number;
  variantId?: number;
  requestKey?: string;
  outcome: "succeeded" | "failed";
  errorCode?: string;
};

function logProductCommand(entry: ProductCommandLog) {
  console.info("product_lifecycle_command", entry);
}

function parseResult<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ProductLifecycleCommandError(
      "INVALID_RESULT",
      "The database returned an invalid product command result.",
    );
  }
  return parsed.data;
}

function logAndThrow(
  command: ProductCommandName,
  metadata: Omit<ProductCommandLog, "command" | "outcome" | "errorCode">,
  error: { message?: string; code?: string } | null,
): never {
  const mapped = mapProductLifecycleDatabaseError(error);
  logProductCommand({
    command,
    ...metadata,
    outcome: "failed",
    errorCode: mapped.code,
  });
  throw mapped;
}

export async function setProductAvailability(
  rawCommand: SetProductAvailabilityCommand,
) {
  const command = setProductAvailabilityCommandSchema.parse(rawCommand);
  const context = await resolveSellerContext(command.makerId);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("server_set_product_availability", {
    actor_user_id: context.userId,
    expected_maker_id: context.maker.id,
    target_product_id: command.productId,
    target_status: command.status,
    reason: command.reason,
    expected_available_at:
      command.expectedAvailableAt as unknown as string,
    expected_version: command.expectedVersion,
    request_key: command.requestKey,
    source: command.source,
  });
  const metadata = {
    makerId: context.maker.id,
    productId: command.productId,
    requestKey: command.requestKey,
  };
  if (error) logAndThrow("set_product_availability", metadata, error);
  const result = parseResult(productAvailabilityResultSchema, data);
  logProductCommand({
    command: "set_product_availability",
    ...metadata,
    outcome: "succeeded",
  });
  return result;
}

export async function archiveProduct(rawCommand: ArchiveProductCommand) {
  const command = archiveProductCommandSchema.parse(rawCommand);
  const context = await resolveSellerContext(command.makerId);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("server_archive_product", {
    actor_user_id: context.userId,
    expected_maker_id: context.maker.id,
    target_product_id: command.productId,
    reason: command.reason,
    request_key: command.requestKey,
    source: command.source,
  });
  const metadata = {
    makerId: context.maker.id,
    productId: command.productId,
    requestKey: command.requestKey,
  };
  if (error) logAndThrow("archive_product", metadata, error);
  const result = parseResult(productLifecycleResultSchema, data);
  logProductCommand({
    command: "archive_product",
    ...metadata,
    outcome: "succeeded",
  });
  return result;
}

export async function restoreArchivedProduct(
  rawCommand: RestoreProductCommand,
) {
  const command = restoreProductCommandSchema.parse(rawCommand);
  const context = await resolveSellerContext(command.makerId);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(
    "server_restore_archived_product",
    {
      actor_user_id: context.userId,
      expected_maker_id: context.maker.id,
      target_product_id: command.productId,
      request_key: command.requestKey,
    },
  );
  const metadata = {
    makerId: context.maker.id,
    productId: command.productId,
    requestKey: command.requestKey,
  };
  if (error) logAndThrow("restore_archived_product", metadata, error);
  const result = parseResult(productLifecycleResultSchema, data);
  logProductCommand({
    command: "restore_archived_product",
    ...metadata,
    outcome: "succeeded",
  });
  return result;
}

export async function deleteProductDraft(
  rawCommand: DeleteProductDraftCommand,
) {
  const command = deleteProductDraftCommandSchema.parse(rawCommand);
  const context = await resolveSellerContext(command.makerId);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("server_delete_product_draft", {
    actor_user_id: context.userId,
    expected_maker_id: context.maker.id,
    target_product_id: command.productId,
    confirmation_slug: command.confirmationSlug,
    request_key: command.requestKey,
  });
  const metadata = {
    makerId: context.maker.id,
    productId: command.productId,
    requestKey: command.requestKey,
  };
  if (error) logAndThrow("delete_product_draft", metadata, error);
  const result = parseResult(deleteProductDraftResultSchema, data);
  logProductCommand({
    command: "delete_product_draft",
    ...metadata,
    outcome: "succeeded",
  });
  return result;
}

export async function adjustVariantInventory(
  rawCommand: AdjustVariantInventoryCommand,
) {
  const command = adjustVariantInventoryCommandSchema.parse(rawCommand);
  const context = await resolveSellerContext(command.makerId);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("server_adjust_variant_inventory", {
    actor_user_id: context.userId,
    expected_maker_id: context.maker.id,
    target_variant_id: command.variantId,
    movement_type: command.movement,
    quantity: command.quantity,
    reason: command.reason,
    expected_version: command.expectedVersion,
    request_key: command.requestKey,
    target_order_id: command.orderId ?? undefined,
    source: command.source,
  });
  const metadata = {
    makerId: context.maker.id,
    variantId: command.variantId,
    requestKey: command.requestKey,
  };
  if (error) logAndThrow("adjust_variant_inventory", metadata, error);
  const result = parseResult(inventoryResultSchema, data);
  logProductCommand({
    command: "adjust_variant_inventory",
    ...metadata,
    outcome: "succeeded",
  });
  return result;
}

export async function getProductReferenceImpact(
  rawCommand: ProductReferenceImpactCommand,
) {
  const command = productReferenceImpactCommandSchema.parse(rawCommand);
  const context = await resolveSellerContext(command.makerId);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(
    "server_get_product_reference_impact",
    {
      actor_user_id: context.userId,
      expected_maker_id: context.maker.id,
      target_product_id: command.productId,
    },
  );
  const metadata = {
    makerId: context.maker.id,
    productId: command.productId,
  };
  if (error) logAndThrow("get_product_reference_impact", metadata, error);
  const result = parseResult(productReferenceImpactResultSchema, data);
  logProductCommand({
    command: "get_product_reference_impact",
    ...metadata,
    outcome: "succeeded",
  });
  return result;
}

