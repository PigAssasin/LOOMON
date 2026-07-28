import "server-only";

import { NextResponse } from "next/server";
import { getAddress } from "viem";
import {
  commerceWorkspaceSchema,
  emptyCommerceWorkspace,
} from "@/src/domain/commerce-workspace";
import { createAdminClient } from "@/src/lib/supabase/admin";

const SINGLE_DEMO_SELLER_ADDRESS = "0xd59aa8db407d4219fe4b104ca4142df14301dec4";

export async function GET(request: Request) {
  const rawAddress = new URL(request.url).searchParams.get("address");
  if (!rawAddress) {
    return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
  }

  let address: string;
  try {
    address = getAddress(rawAddress).toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  if (address !== SINGLE_DEMO_SELLER_ADDRESS) {
    return NextResponse.json(emptyCommerceWorkspace);
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_single_demo_seller_workspace" as never, {
    p_wallet_address: address,
  } as never);

  if (error) {
    return NextResponse.json({ error: "Seller workspace could not be loaded" }, { status: 500 });
  }

  const parsed = commerceWorkspaceSchema.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Seller workspace is malformed" }, { status: 500 });
  }

  return NextResponse.json(parsed.data);
}
