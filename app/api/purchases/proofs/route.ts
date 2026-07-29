import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { parseOrderProofRecord } from "@/src/domain/order-proof";
import { listPurchasedOrderProofs } from "@/src/server/commerce/order-proof-service";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { createClient } from "@/src/lib/supabase/server";

type WalletProofRow = Record<string, unknown> & {
  orders?: { order_number?: string } | null;
};

export async function GET(request: Request) {
  const rawAddress = new URL(request.url).searchParams.get("address");
  if (rawAddress) {
    try {
      const address = getAddress(rawAddress).toLowerCase();
      const admin = createAdminClient();
      const query = (
        admin.schema as unknown as (schema: string) => {
          from: (table: string) => {
            select: (columns: string) => {
              eq: (column: string, value: string) => {
                order: (
                  column: string,
                  options: { ascending: boolean },
                ) => Promise<{ data: WalletProofRow[] | null; error: Error | null }>;
              };
            };
          };
        }
      )("commerce");
      const { data, error } = await query
        .from("order_proof_nfts")
        .select("*, orders!inner(order_number)")
        .eq("recipient_wallet_address", address)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const proofs = (data ?? []).map((row) => ({
        ...parseOrderProofRecord(row),
        orderNumber:
          typeof row.orders?.order_number === "string"
            ? row.orders.order_number
            : "LOOMON demo order",
      }));
      return NextResponse.json({ proofs });
    } catch {
      return NextResponse.json({ error: "Wallet proofs are temporarily unavailable." }, { status: 500 });
    }
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const proofs = await listPurchasedOrderProofs(user.id);
    return NextResponse.json({ proofs });
  } catch {
    return NextResponse.json(
      { error: "Purchased proofs are temporarily unavailable." },
      { status: 500 },
    );
  }
}
