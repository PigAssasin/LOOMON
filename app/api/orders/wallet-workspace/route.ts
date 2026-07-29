import "server-only";

import { NextResponse } from "next/server";
import { getAddress } from "viem";
import {
  commerceWorkspaceSchema,
  emptyCommerceWorkspace,
} from "@/src/domain/commerce-workspace";
import { createAdminClient } from "@/src/lib/supabase/admin";

const querySchema = /^0x[0-9a-fA-F]{40}$/;

export async function GET(request: Request) {
  const rawAddress = new URL(request.url).searchParams.get("address");
  if (!rawAddress || !querySchema.test(rawAddress)) {
    return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 });
  }

  const address = getAddress(rawAddress).toLowerCase();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_wallet_buyer_workspace" as never, {
    p_wallet_address: address,
  } as never);

  if (error) {
    return NextResponse.json(emptyCommerceWorkspace);
  }

  const parsed = commerceWorkspaceSchema.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Wallet workspace is malformed" }, { status: 500 });
  }

  return NextResponse.json(parsed.data);
}
