import "server-only";

import { getAddress } from "viem";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { createClient } from "@/src/lib/supabase/server";

export async function requireWalletSession(rawAddress: string) {
  const address = getAddress(rawAddress).toLowerCase();
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const metadataAddress =
    typeof user.app_metadata?.wallet_address === "string"
      ? user.app_metadata.wallet_address
      : typeof user.user_metadata?.wallet_address === "string"
        ? user.user_metadata.wallet_address
        : undefined;
  if (metadataAddress?.toLowerCase() === address) {
    return { address, userId: user.id };
  }

  const admin = createAdminClient();
  const { data: wallet } = await admin
    .schema("wallet" as never)
    .from("accounts" as never)
    .select("user_id" as never)
    .eq("user_id" as never, user.id)
    .eq("address" as never, address)
    .maybeSingle();

  return wallet ? { address, userId: user.id } : null;
}
