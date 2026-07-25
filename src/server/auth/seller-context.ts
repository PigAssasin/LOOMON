import "server-only";

import {
  SELLER_PRODUCT_ROLES,
  SellerAccessError,
  selectSellerContext,
  type SellerMembership,
  type SellerProductRole,
} from "@/src/domain/seller-access";
import type { Database } from "@/src/lib/supabase/database.types";
import { createClient } from "@/src/lib/supabase/server";

type SellerMembershipRow =
  Database["public"]["Functions"]["get_my_seller_memberships"]["Returns"][number];

function isSellerProductRole(value: string): value is SellerProductRole {
  return SELLER_PRODUCT_ROLES.some((role) => role === value);
}

function mapMembershipRow(
  row: SellerMembershipRow,
): SellerMembership | null {
  if (
    row.membership_status !== "active" ||
    !isSellerProductRole(row.membership_role)
  ) {
    return null;
  }

  return {
    makerId: row.maker_id,
    makerSlug: row.maker_slug,
    makerName: row.maker_name,
    role: row.membership_role,
    status: "active",
  };
}

export async function resolveSellerContext(requestedMakerId?: number) {
  const supabase = await createClient();

  if (!supabase) {
    throw new SellerAccessError(
      "UNAUTHENTICATED",
      "Supabase authentication is not configured.",
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new SellerAccessError(
      "UNAUTHENTICATED",
      "Sign in before managing seller products.",
    );
  }

  const { data, error: membershipError } = await supabase.rpc(
    "get_my_seller_memberships",
  );

  if (membershipError) {
    throw new Error("Unable to resolve the seller membership.");
  }

  const memberships = (data ?? [])
    .map(mapMembershipRow)
    .filter((membership): membership is SellerMembership =>
      Boolean(membership),
    );

  return selectSellerContext(user.id, memberships, requestedMakerId);
}

