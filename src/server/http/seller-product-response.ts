import "server-only";

import { NextResponse } from "next/server";
import {
  isSameOriginMutation,
  mapProductLifecycleHttpError,
} from "@/src/domain/product-lifecycle-api";
import { JsonRequestError } from "@/src/server/http/json-request";

export function rejectCrossSiteMutation(request: Request) {
  if (isSameOriginMutation(request.url, request.headers.get("origin"))) {
    return null;
  }
  return NextResponse.json(
    {
      error: {
        code: "CROSS_SITE_REQUEST",
        message: "Cross-site seller commands are not allowed.",
      },
    },
    { status: 403 },
  );
}

export function sellerProductErrorResponse(error: unknown) {
  if (error instanceof JsonRequestError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  const mapped = mapProductLifecycleHttpError(error);
  return NextResponse.json(mapped.body, { status: mapped.status });
}

