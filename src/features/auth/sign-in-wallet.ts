import type { Connector } from "wagmi";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/lib/supabase/database.types";

type WalletProvider = {
  request(args: {
    method: "personal_sign";
    params: readonly [string, `0x${string}`];
  }): Promise<unknown>;
};

async function signInWithBridge(
  supabase: SupabaseClient<Database>,
  connector: Connector,
  address: `0x${string}`,
) {
  const challengeResponse = await fetch(
    `/api/auth/wallet/challenge?address=${encodeURIComponent(address)}`,
  );
  const challenge = await challengeResponse.json();
  if (
    !challengeResponse.ok
    || typeof challenge?.message !== "string"
    || typeof challenge?.token !== "string"
  ) {
    throw new Error(challenge?.error ?? "Wallet challenge could not be created");
  }

  const provider = (await connector.getProvider()) as WalletProvider;
  const signature = await provider.request({
    method: "personal_sign",
    params: [challenge.message, address],
  });
  if (typeof signature !== "string") throw new Error("Wallet signature was not returned");

  const confirmationResponse = await fetch("/api/auth/wallet/challenge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, signature, token: challenge.token }),
  });
  const confirmation = await confirmationResponse.json();
  if (!confirmationResponse.ok) {
    throw new Error(confirmation?.error ?? "Wallet session could not be created");
  }
  if (
    typeof confirmation?.accessToken !== "string"
    || typeof confirmation?.refreshToken !== "string"
  ) {
    throw new Error("Wallet session tokens were not returned");
  }
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: confirmation.accessToken,
    refresh_token: confirmation.refreshToken,
  });
  if (sessionError) throw sessionError;
}

export async function ensureWalletSession({
  address,
  connector,
  statement,
  supabase,
}: {
  address: `0x${string}`;
  connector: Connector;
  statement: string;
  supabase: SupabaseClient<Database>;
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return session;

  const wallet = await connector.getProvider();
  const { data, error } = await supabase.auth.signInWithWeb3({
    chain: "ethereum",
    statement,
    wallet: wallet as never,
  });
  if (!error && data.session) return data.session;

  if (!/web3|provider|disabled|not enabled|unsupported/i.test(error?.message ?? "")) {
    throw error ?? new Error("Wallet sign-in did not finish");
  }

  await signInWithBridge(supabase, connector, address);
  const {
    data: { session: bridgedSession },
    error: bridgedSessionError,
  } = await supabase.auth.getSession();
  if (bridgedSessionError || !bridgedSession) {
    throw bridgedSessionError ?? new Error("Wallet session did not persist");
  }
  return bridgedSession;
}
