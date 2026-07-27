"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { erc20Abi, getAddress } from "viem";
import type { Product } from "@/src/domain/product";
import {
  prepaidCheckoutSchema,
  prepaidOrderResultSchema,
  type PrepaidOrderResult,
} from "@/src/domain/prepaid-checkout";
import {
  buildCustomizationAssetPath,
  isApprovedCustomizationBrief,
  quoteSubmissionResultSchema,
  sanitizeCustomizationFileName,
} from "@/src/domain/quote-request";
import type { CustomizationSession } from "@/src/features/customization/customization-storage";
import { ensureWalletSession } from "@/src/features/auth/sign-in-wallet";
import { ARC_TESTNET } from "@/src/lib/arc";
import { loomonEscrowPoolAbi } from "@/src/lib/payments/escrow-pool";
import { createClient } from "@/src/lib/supabase/client";

export type OrderSubmitState =
  | "idle"
  | "connecting"
  | "signing"
  | "uploading"
  | "preparing"
  | "switching_network"
  | "approving"
  | "funding"
  | "verifying"
  | "success"
  | "error";

const REQUEST_KEY_PREFIX = "loomon-order-request-key:";
const PENDING_PAYMENT_PREFIX = "loomon-pending-escrow:";
const SINGLE_DEMO_SELLER_ADDRESS = "0xd59aa8db407d4219fe4b104ca4142df14301dec4";

async function sha256(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function approvedAsset(session: CustomizationSession) {
  const preview = session.previews.find((item) => item.label === session.selectedPreview);
  if (preview) {
    const response = await fetch(preview.url);
    if (!response.ok) throw new Error("The selected preview could not be prepared.");
    return {
      blob: await response.blob(),
      role: "agent_render" as const,
      fileName: `${session.productSlug}-${sanitizeCustomizationFileName(preview.label)}.png`,
      previewLabel: preview.label,
    };
  }
  if (!session.file) return undefined;
  return {
    blob: session.file,
    role: "artwork" as const,
    fileName: session.fileName ?? session.file.name,
    previewLabel: undefined,
  };
}

function submissionIntent(session: CustomizationSession) {
  return session.file || session.selectedPreview ? "apply_artwork" : "text_only";
}

function submissionNotes(session: CustomizationSession) {
  const parts = [
    session.printText.trim() ? `Text to print: ${session.printText.trim()}` : "",
    session.notes.trim() ? `Seller notes: ${session.notes.trim()}` : "",
  ].filter(Boolean);
  return parts.join("\n\n") || "No customization requested. Standard product order.";
}

function friendlyOrderError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  if (/buyer_seller_same|checkout_buyer_seller_different/i.test(message)) {
    return "This wallet manages the LOOMON demo shop. Switch to a buyer wallet to place an order.";
  }
  if (/user rejected|user denied|rejected the request/i.test(message)) {
    return "Order not placed. Your brief is saved and no new payment was made.";
  }
  if (/insufficient funds|exceeds balance/i.test(message)) {
    return "Your Arc wallet does not have enough USDC for the order and network fee.";
  }
  if (/seller_payment_setup_required/i.test(message)) {
    return "This maker has not connected a payout wallet yet, so prepaid orders are temporarily unavailable.";
  }
  if (/product_not_available|authoritative_price_unavailable/i.test(message)) {
    return "This product is not available at a confirmed price right now.";
  }
  if (/web3|provider|disabled|not enabled|wallet_identity|sign|signature/i.test(message)) {
    return "We could not verify your wallet. Your order details are still saved.";
  }
  if (/network|fetch|timeout/i.test(message)) {
    return "The connection stopped. If the Arc transaction was submitted, press Place order again to verify it.";
  }
  if (/duplicate|already exists/i.test(message)) {
    return "This order is already being processed. Open Orders to check it.";
  }
  return message || "The order could not be placed. Your details are still saved.";
}

async function confirmFunding(checkoutId: string, transactionHash: string) {
  const response = await fetch("/api/checkout/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ checkoutId, transactionHash }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string" ? body.error : "Escrow funding verification failed",
    );
  }
  return prepaidOrderResultSchema.parse(body);
}

export function useOrderRequestSubmission({
  product,
  session,
}: {
  product: Product;
  session: CustomizationSession;
}) {
  const { address, connector, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: ARC_TESTNET.id });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { connectModalOpen, openConnectModal } = useConnectModal();
  const [requestKey, setRequestKey] = useState("");
  const [submitState, setSubmitState] = useState<OrderSubmitState>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<PrepaidOrderResult>();
  const [resumeAfterConnect, setResumeAfterConnect] = useState(false);
  const connectModalWasOpen = useRef(false);

  useEffect(() => {
    const storageKey = `${REQUEST_KEY_PREFIX}${product.slug}`;
    const existing = window.localStorage.getItem(storageKey);
    const next = existing || crypto.randomUUID();
    window.localStorage.setItem(storageKey, next);
    window.queueMicrotask(() => setRequestKey(next));
  }, [product.slug]);

  const ensureRequestKey = useCallback(() => {
    const storageKey = `${REQUEST_KEY_PREFIX}${product.slug}`;
    const existing = window.localStorage.getItem(storageKey);
    const next = existing || crypto.randomUUID();
    window.localStorage.setItem(storageKey, next);
    if (requestKey !== next) setRequestKey(next);
    return next;
  }, [product.slug, requestKey]);

  const isBusy = [
    "connecting",
    "signing",
    "uploading",
    "preparing",
    "switching_network",
    "approving",
    "funding",
    "verifying",
  ].includes(submitState);
  const canSubmit = Boolean(
    requestKey
      && isApprovedCustomizationBrief(session)
      && session.quantity >= product.minimumOrderQuantity
      && !isBusy,
  );
  const estimate = useMemo(
    () => session.quantity * product.priceFrom,
    [product.priceFrom, session.quantity],
  );

  const submitAuthenticated = useCallback(async (activeRequestKey = ensureRequestKey()) => {
    if (!activeRequestKey || !isApprovedCustomizationBrief(session)) {
      setSubmitState("error");
      setError("Complete the customization details before placing the order.");
      return;
    }
    if (!connector || !address || !publicClient) {
      setSubmitState("error");
      setError("Your Arc wallet is still connecting. Please try again.");
      return;
    }
    if (getAddress(address) === getAddress(SINGLE_DEMO_SELLER_ADDRESS)) {
      setSubmitState("error");
      setError("This is the seller wallet for the demo shop. Switch to a buyer wallet to place an order.");
      return;
    }

    setError("");
    const supabase = createClient();
    if (!supabase) {
      setSubmitState("error");
      setError("Checkout is not configured.");
      return;
    }

    const pendingKey = `${PENDING_PAYMENT_PREFIX}${product.slug}`;
    try {
      const pendingRaw = window.localStorage.getItem(pendingKey);
      if (pendingRaw) {
        const pending = JSON.parse(pendingRaw) as {
          checkoutId?: string;
          transactionHash?: string;
        };
        if (pending.checkoutId && pending.transactionHash) {
          setSubmitState("verifying");
          const resumed = await confirmFunding(
            pending.checkoutId,
            pending.transactionHash,
          );
          setResult(resumed);
          setSubmitState("success");
          window.localStorage.removeItem(pendingKey);
          window.localStorage.removeItem(`${REQUEST_KEY_PREFIX}${product.slug}`);
          return;
        }
      }

      setSubmitState("signing");
      await ensureWalletSession({
        address,
        connector,
        statement: "Sign in to LOOMON to place this prepaid Arc order.",
        supabase,
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Wallet sign-in did not finish.");

      const { error: walletSyncError } = await supabase.rpc("sync_my_web3_wallet", {
        p_address: address,
      });
      if (walletSyncError) throw walletSyncError;

      const asset = await approvedAsset(session);
      let assetInput: {
        p_asset_path?: string;
        p_asset_role?: "agent_render" | "artwork";
        p_file_name?: string;
        p_mime_type?: string;
        p_asset_bytes?: number;
        p_checksum_sha256?: string;
        p_preview_label?: string;
      } = {};

      if (asset) {
        setSubmitState("uploading");
        const mimeType = asset.blob.type || "image/png";
        const uploadedPath = buildCustomizationAssetPath({
          userId: user.id,
          requestKey: activeRequestKey,
          fileName: asset.fileName,
        });
        const { error: uploadError } = await supabase.storage
          .from("customization-assets")
          .upload(uploadedPath, asset.blob, { contentType: mimeType, upsert: false });
        if (uploadError && !uploadError.message.toLowerCase().includes("already exists")) {
          throw uploadError;
        }
        assetInput = {
          p_asset_path: uploadedPath,
          p_asset_role: asset.role,
          p_file_name: asset.fileName,
          p_mime_type: mimeType,
          p_asset_bytes: asset.blob.size,
          p_checksum_sha256: await sha256(asset.blob),
          p_preview_label: asset.previewLabel,
        };
      }

      setSubmitState("preparing");
      const { data: quoteData, error: quoteError } = await supabase.rpc(
        "submit_customization_quote",
        {
          p_product_slug: product.slug,
          p_intent: submissionIntent(session),
          p_notes: submissionNotes(session),
          p_quantity: session.quantity,
          p_required_by: session.requiredBy || null,
          p_client_request_key: activeRequestKey,
          ...assetInput,
        },
      );
      if (quoteError) throw quoteError;
      const quote = quoteSubmissionResultSchema.parse(quoteData);

      const { data: checkoutData, error: checkoutError } = await supabase.rpc(
        "prepare_prepaid_checkout",
        {
          p_buyer_address: address,
          p_client_request_key: activeRequestKey,
          p_quote_request_id: quote.quoteRequestId,
        },
      );
      if (checkoutError) throw checkoutError;
      const checkout = prepaidCheckoutSchema.parse(checkoutData);

      if (chainId !== ARC_TESTNET.id) {
        setSubmitState("switching_network");
        await switchChainAsync({ chainId: ARC_TESTNET.id });
      }

      const buyer = getAddress(address);
      const pool = getAddress(checkout.poolAddress);
      const amountAtomic = BigInt(checkout.amountAtomic);
      const allowance = await publicClient.readContract({
        address: getAddress(ARC_TESTNET.usdcAddress),
        abi: erc20Abi,
        functionName: "allowance",
        args: [buyer, pool],
      });

      if (allowance < amountAtomic) {
        setSubmitState("approving");
        const approvalHash = await writeContractAsync({
          address: getAddress(ARC_TESTNET.usdcAddress),
          abi: erc20Abi,
          functionName: "approve",
          args: [pool, amountAtomic],
          chainId: ARC_TESTNET.id,
        });
        const approvalReceipt = await publicClient.waitForTransactionReceipt({
          hash: approvalHash,
        });
        if (approvalReceipt.status !== "success") {
          throw new Error("USDC approval transaction reverted.");
        }
      }

      setSubmitState("funding");
      const transactionHash = await writeContractAsync({
        address: pool,
        abi: loomonEscrowPoolAbi,
        functionName: "placeOrder",
        args: [
          checkout.onchainOrderId as `0x${string}`,
          getAddress(checkout.sellerAddress),
          amountAtomic,
          checkout.termsHash as `0x${string}`,
        ],
        chainId: ARC_TESTNET.id,
      });
      window.localStorage.setItem(
        pendingKey,
        JSON.stringify({ checkoutId: checkout.checkoutId, transactionHash }),
      );

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: transactionHash,
      });
      if (receipt.status !== "success") {
        window.localStorage.removeItem(pendingKey);
        throw new Error("Arc escrow transaction reverted.");
      }

      setSubmitState("verifying");
      const confirmed = await confirmFunding(checkout.checkoutId, transactionHash);
      setResult(confirmed);
      setSubmitState("success");
      window.localStorage.removeItem(pendingKey);
      window.localStorage.removeItem(`${REQUEST_KEY_PREFIX}${product.slug}`);
    } catch (cause) {
      setSubmitState("error");
      setError(friendlyOrderError(cause));
    }
  }, [
    address,
    chainId,
    connector,
    ensureRequestKey,
    product.slug,
    publicClient,
    session,
    switchChainAsync,
    writeContractAsync,
  ]);

  useEffect(() => {
    if (resumeAfterConnect && connectModalOpen) connectModalWasOpen.current = true;
    if (
      resumeAfterConnect
      && connectModalWasOpen.current
      && !connectModalOpen
      && !isConnected
    ) {
      window.queueMicrotask(() => {
        setResumeAfterConnect(false);
        setSubmitState("error");
        setError("Order not placed. Connect your wallet when you are ready.");
      });
    }
  }, [connectModalOpen, isConnected, resumeAfterConnect]);

  useEffect(() => {
    if (!resumeAfterConnect || !isConnected || !connector || !address) return;
    window.queueMicrotask(() => {
      setResumeAfterConnect(false);
      void submitAuthenticated();
    });
  }, [address, connector, isConnected, resumeAfterConnect, submitAuthenticated]);

  const placeOrder = useCallback(() => {
    const activeRequestKey = ensureRequestKey();
    setError("");
    if (session.quantity < product.minimumOrderQuantity) {
      setSubmitState("error");
      setError(`Minimum order is ${product.minimumOrderQuantity} pieces.`);
      return;
    }
    if (!isApprovedCustomizationBrief(session)) {
      setSubmitState("error");
      setError("Add your note, text, artwork, or leave the brief as a standard product order.");
      return;
    }
    if (!isConnected) {
      if (!openConnectModal) {
        setSubmitState("error");
        setError("The wallet chooser is unavailable. Refresh and try again.");
        return;
      }
      connectModalWasOpen.current = false;
      setResumeAfterConnect(true);
      setSubmitState("connecting");
      openConnectModal();
      return;
    }
    if (address && getAddress(address) === getAddress(SINGLE_DEMO_SELLER_ADDRESS)) {
      setSubmitState("error");
      setError("This is the seller wallet for the demo shop. Switch to a buyer wallet to place an order.");
      return;
    }
    void submitAuthenticated(activeRequestKey);
  }, [
    address,
    ensureRequestKey,
    isConnected,
    openConnectModal,
    product.minimumOrderQuantity,
    session,
    submitAuthenticated,
  ]);

  return {
    canSubmit,
    error,
    estimate,
    isBusy,
    isConnected,
    placeOrder,
    result,
    submitState,
  };
}
