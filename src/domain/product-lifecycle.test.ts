import { describe, expect, it } from "vitest";
import {
  mapProductLifecycleDatabaseError,
  productAvailabilityResultSchema,
  setProductAvailabilityCommandSchema,
} from "@/src/domain/product-lifecycle";

const validCommand = {
  makerId: 1,
  productId: 2,
  status: "paused",
  reason: "Kiln maintenance",
  expectedAvailableAt: "2026-08-10T02:00:00.000Z",
  expectedVersion: 3,
  requestKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  source: "seller",
} as const;

describe("product lifecycle contracts", () => {
  it("accepts a complete availability command", () => {
    expect(setProductAvailabilityCommandSchema.parse(validCommand)).toEqual(
      validCommand,
    );
  });

  it("rejects unknown command fields", () => {
    expect(() =>
      setProductAvailabilityCommandSchema.parse({
        ...validCommand,
        actorUserId: "browser-controlled",
      }),
    ).toThrow();
  });

  it("rejects malformed idempotency keys", () => {
    expect(() =>
      setProductAvailabilityCommandSchema.parse({
        ...validCommand,
        requestKey: "retry-me",
      }),
    ).toThrow();
  });

  it("validates the database result shape", () => {
    expect(
      productAvailabilityResultSchema.parse({
        product_id: 2,
        status: "paused",
        expected_available_at: "2026-08-10T02:00:00+00:00",
        version: 4,
      }),
    ).toEqual({
      product_id: 2,
      status: "paused",
      expected_available_at: "2026-08-10T02:00:00+00:00",
      version: 4,
    });
  });

  it("maps known database errors to stable codes", () => {
    expect(
      mapProductLifecycleDatabaseError({
        message: "VERSION_CONFLICT",
      }).code,
    ).toBe("VERSION_CONFLICT");
  });

  it("does not expose unknown database errors", () => {
    const error = mapProductLifecycleDatabaseError({
      message: "connection details and internal query",
    });
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.message).not.toContain("connection details");
  });
});

