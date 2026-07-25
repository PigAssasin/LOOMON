import { describe, expect, it } from "vitest";
import {
  isSameOriginMutation,
  mapProductLifecycleHttpError,
  sellerProductLifecycleRequestSchema,
  sellerProductRouteParamSchema,
} from "@/src/domain/product-lifecycle-api";
import { ProductLifecycleCommandError } from "@/src/domain/product-lifecycle";
import { SellerAccessError } from "@/src/domain/seller-access";

const pauseRequest = {
  action: "set_availability",
  makerId: 1,
  status: "paused",
  reason: "Kiln maintenance",
  expectedAvailableAt: "2026-08-10T02:00:00.000Z",
  expectedVersion: 2,
  requestKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
} as const;

describe("seller product lifecycle HTTP contract", () => {
  it("accepts a strict lifecycle command without actor or product IDs", () => {
    expect(
      sellerProductLifecycleRequestSchema.parse(pauseRequest),
    ).toEqual(pauseRequest);
  });

  it("rejects browser-provided actor IDs", () => {
    expect(() =>
      sellerProductLifecycleRequestSchema.parse({
        ...pauseRequest,
        actorUserId: "attacker",
      }),
    ).toThrow();
  });

  it("rejects a body-provided product ID because the route owns it", () => {
    expect(() =>
      sellerProductLifecycleRequestSchema.parse({
        ...pauseRequest,
        productId: 9,
      }),
    ).toThrow();
  });

  it("rejects browser-provided agent audit sources", () => {
    expect(() =>
      sellerProductLifecycleRequestSchema.parse({
        ...pauseRequest,
        source: "agent_confirmed",
      }),
    ).toThrow();
  });

  it("validates route product IDs", () => {
    expect(sellerProductRouteParamSchema.parse({ productId: "12" })).toEqual({
      productId: 12,
    });
    expect(() =>
      sellerProductRouteParamSchema.parse({ productId: "not-a-product" }),
    ).toThrow();
  });

  it("accepts only same-origin mutations", () => {
    expect(
      isSameOriginMutation(
        "https://loomon.vercel.app/api/seller/products/1/lifecycle",
        "https://loomon.vercel.app",
      ),
    ).toBe(true);
    expect(
      isSameOriginMutation(
        "https://loomon.vercel.app/api/seller/products/1/lifecycle",
        "https://attacker.example",
      ),
    ).toBe(false);
    expect(isSameOriginMutation("https://loomon.vercel.app/api", null)).toBe(
      false,
    );
  });

  it("maps authentication and authorization errors", () => {
    expect(
      mapProductLifecycleHttpError(
        new SellerAccessError("UNAUTHENTICATED", "private detail"),
      ),
    ).toMatchObject({
      status: 401,
      body: { error: { code: "UNAUTHENTICATED" } },
    });
    expect(
      mapProductLifecycleHttpError(
        new SellerAccessError("FORBIDDEN", "private detail"),
      ),
    ).toMatchObject({
      status: 403,
      body: { error: { code: "FORBIDDEN" } },
    });
  });

  it("maps stale writes to conflict without leaking database messages", () => {
    const response = mapProductLifecycleHttpError(
      new ProductLifecycleCommandError(
        "VERSION_CONFLICT",
        "sensitive database detail",
      ),
    );
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("VERSION_CONFLICT");
    expect(response.body.error.message).not.toContain("sensitive");
  });

  it("hides unknown internal errors", () => {
    const response = mapProductLifecycleHttpError(
      new Error("database host and query"),
    );
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(response.body.error.message).not.toContain("database host");
  });
});
