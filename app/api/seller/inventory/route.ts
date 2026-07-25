import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { sellerInventoryRequestSchema } from "@/src/domain/product-lifecycle-api";
import { adjustVariantInventory } from "@/src/server/catalog/product-lifecycle-commands";
import { readSellerCommandJson } from "@/src/server/http/json-request";
import {
  rejectCrossSiteMutation,
  sellerProductErrorResponse,
} from "@/src/server/http/seller-product-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const crossSiteResponse = rejectCrossSiteMutation(request);
  if (crossSiteResponse) return crossSiteResponse;

  try {
    const command = sellerInventoryRequestSchema.parse(
      await readSellerCommandJson(request),
    );
    const result = await adjustVariantInventory({
      ...command,
      source: "seller",
    });
    revalidatePath("/app");
    revalidatePath("/app/seller/products");
    return NextResponse.json({ data: result });
  } catch (error) {
    return sellerProductErrorResponse(error);
  }
}
