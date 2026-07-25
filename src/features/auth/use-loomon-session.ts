"use client";

import { useCallback, useMemo, useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect } from "wagmi";
import { ensureWalletSession } from "@/src/features/auth/sign-in-wallet";
import { createClient } from "@/src/lib/supabase/client";

export function useLoomonSession() {
  const { address, connector, isConnected } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const supabase = useMemo(() => createClient(), []);

  const ensureSession = useCallback(async () => {
    setError("");
    if (!supabase) {
      setError("LOOMON is temporarily unavailable.");
      return false;
    }
    if (!isConnected || !connector || !address) {
      openConnectModal?.();
      return false;
    }

    setBusy(true);
    try {
      await ensureWalletSession({
        address,
        connector,
        statement: "Sign in to LOOMON to manage your profile and orders.",
        supabase,
      });

      const { error: walletError } = await supabase.rpc("sync_my_web3_wallet", {
        p_address: address,
      });
      if (walletError) throw walletError;
      return true;
    } catch {
      setError("We could not verify your wallet. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [address, connector, isConnected, openConnectModal, supabase]);

  const signOut = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await supabase?.auth.signOut();
      await disconnectAsync();
    } finally {
      setBusy(false);
    }
  }, [disconnectAsync, supabase]);

  return {
    address,
    busy,
    ensureSession,
    error,
    isConnected,
    openConnectModal,
    signOut,
    supabase,
  };
}
