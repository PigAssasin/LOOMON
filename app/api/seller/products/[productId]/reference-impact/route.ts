import { NextResponse } from "next/server";
import {
  sellerProductRouteParamSchema,
  sellerReferenceImpactQuerySchema,
} from "@/src/domain/product-lifecycle-api";
import { getProductReferenceImpact } from "@/src/server/catalog/product-lifecycle-commands";
import { sellerProductErrorResponse } from "@/src/server/http/seller-product-response";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { productId: rawProductId } = await context.params;
    const { productId } = sellerProductRouteParamSchema.parse({
      productId: rawProductId,
    });
    const url = new URL(request.url);
    const query = sellerReferenceImpactQuerySchema.parse({
      makerId: url.searchParams.get("makerId"),
    });
    const result = await getProductReferenceImpact({
      makerId: query.makerId,
      productId,
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    return sellerProductErrorResponse(error);
  }
}
