export const SELLER_PRODUCT_ROLES = [
  "owner",
  "manager",
  "catalog_editor",
] as const;

export type SellerProductRole = (typeof SELLER_PRODUCT_ROLES)[number];

export type SellerMembership = {
  makerId: number;
  makerSlug: string;
  makerName: string;
  role: SellerProductRole;
  status: "active";
};

export type SellerContext = {
  userId: string;
  maker: {
    id: number;
    slug: string;
    name: string;
  };
  role: SellerProductRole;
};

export type SellerAccessErrorCode =
  | "UNAUTHENTICATED"
  | "MEMBERSHIP_REQUIRED"
  | "MAKER_SELECTION_REQUIRED"
  | "FORBIDDEN";

export class SellerAccessError extends Error {
  constructor(
    public readonly code: SellerAccessErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SellerAccessError";
  }
}

export function selectSellerContext(
  userId: string | null,
  memberships: SellerMembership[],
  requestedMakerId?: number,
): SellerContext {
  if (!userId) {
    throw new SellerAccessError(
      "UNAUTHENTICATED",
      "Sign in before managing seller products.",
    );
  }

  if (memberships.length === 0) {
    throw new SellerAccessError(
      "MEMBERSHIP_REQUIRED",
      "An active seller membership is required.",
    );
  }

  let membership: SellerMembership | undefined;

  if (requestedMakerId !== undefined) {
    membership = memberships.find((item) => item.makerId === requestedMakerId);
    if (!membership) {
      throw new SellerAccessError(
        "FORBIDDEN",
        "You cannot manage products for this maker.",
      );
    }
  } else if (memberships.length === 1) {
    membership = memberships[0];
  } else {
    throw new SellerAccessError(
      "MAKER_SELECTION_REQUIRED",
      "Select which maker you want to manage.",
    );
  }

  return {
    userId,
    maker: {
      id: membership.makerId,
      slug: membership.makerSlug,
      name: membership.makerName,
    },
    role: membership.role,
  };
}

