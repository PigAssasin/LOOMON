import { describe, expect, it } from "vitest";
import {
  SellerAccessError,
  selectSellerContext,
  type SellerMembership,
} from "@/src/domain/seller-access";

const membership: SellerMembership = {
  makerId: 12,
  makerSlug: "lo-may",
  makerName: "Lò Mây",
  role: "owner",
  status: "active",
};

function expectAccessError(
  operation: () => unknown,
  code: SellerAccessError["code"],
) {
  try {
    operation();
    throw new Error("Expected SellerAccessError.");
  } catch (error) {
    expect(error).toBeInstanceOf(SellerAccessError);
    expect((error as SellerAccessError).code).toBe(code);
  }
}

describe("selectSellerContext", () => {
  it("requires an authenticated user", () => {
    expectAccessError(
      () => selectSellerContext(null, []),
      "UNAUTHENTICATED",
    );
  });

  it("requires an active seller membership", () => {
    expectAccessError(
      () => selectSellerContext("buyer-id", []),
      "MEMBERSHIP_REQUIRED",
    );
  });

  it("denies an explicitly requested maker outside the seller memberships", () => {
    expectAccessError(
      () => selectSellerContext("seller-id", [membership], 999),
      "FORBIDDEN",
    );
  });

  it("requires explicit selection when one user manages multiple makers", () => {
    const secondMembership: SellerMembership = {
      ...membership,
      makerId: 13,
      makerSlug: "lam-xuong",
      makerName: "Lam Xưởng",
      role: "manager",
    };

    expectAccessError(
      () =>
        selectSellerContext("seller-id", [membership, secondMembership]),
      "MAKER_SELECTION_REQUIRED",
    );
  });

  it("returns the authorized maker context", () => {
    expect(selectSellerContext("seller-id", [membership], 12)).toEqual({
      userId: "seller-id",
      maker: {
        id: 12,
        slug: "lo-may",
        name: "Lò Mây",
      },
      role: "owner",
    });
  });
});

