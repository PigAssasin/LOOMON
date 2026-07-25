import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  sellerProductLifecycleRequestSchema,
  sellerProductRouteParamSchema,
} from "@/src/domain/product-lifecycle-api";
import {
  archiveProduct,
  deleteProductDraft,
  getProductReferenceImpact,
  restoreArchivedProduct,
  setProductAvailability,
} from "@/src/server/catalog/product-lifecycle-commands";
import { readSellerCommandJson } from "@/src/server/http/json-request";
import {
  rejectCrossSiteMutation,
  sellerProductErrorResponse,
} from "@/src/server/http/seller-product-response";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const crossSiteResponse = rejectCrossSiteMutation(request);
  if (crossSiteResponse) return crossSiteResponse;

  try {
    const { productId: rawProductId } = await context.params;
    const { productId } = sellerProductRouteParamSchema.parse({
      productId: rawProductId,
    });
    const command = sellerProductLifecycleRequestSchema.parse(
      await readSellerCommandJson(request),
    );
    const impact = await getProductReferenceImpact({
      makerId: command.makerId,
      productId,
    });

    const result =
      command.action === "set_availability"
        ? await setProductAvailability({
            ...command,
            productId,
            source: "seller",
          })
        : command.action === "archive"
          ? await archiveProduct({ ...command, productId, source: "seller" })
          : command.action === "restore"
            ? await restoreArchivedProduct({ ...command, productId })
            : await deleteProductDraft({ ...command, productId });

    revalidatePath("/app");
    revalidatePath("/app/seller/products");
    revalidatePath(`/app/products/${impact.slug}`);
    revalidatePath(`/products/${impact.slug}`);

    return NextResponse.json({ data: result });
  } catch (error) {
    return sellerProductErrorResponse(error);
  }
}
