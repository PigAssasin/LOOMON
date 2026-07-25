"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { Product } from "@/src/domain/product";
import type { CustomizationSession } from "@/src/features/customization/customization-storage";
import { createClient } from "@/src/lib/supabase/client";
import {
  buildCustomizationAssetPath,
  isApprovedCustomizationBrief,
  quoteSubmissionResultSchema,
  sanitizeCustomizationFileName,
  type QuoteSubmissionResult,
} from "@/src/domain/quote-request";

export type OrderSubmitState =
  | "idle"
  | "connecting"
  | "signing"
  | "uploading"
  | "submitting"
  | "success"
  | "error";

const REQUEST_KEY_PREFIX = "loomon-order-request-key:";

async function sha256(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
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

function friendlyOrderError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  if (/web3|provider|disabled|not enabled|wallet_identity|sign|signature/i.test(message)) {
    return "We could not verify your wallet. Your order details are still saved.";
  }
  if (/network|fetch|timeout/i.test(message)) {
    return "The connection stopped before the order was placed. Please try again.";
  }
  if (/duplicate|already exists/i.test(message)) {
    return "This order request is already being processed. Open Orders to check it.";
  }
  return message || "The order request could not be placed. Your details are still saved.";
}

export function useOrderRequestSubmission({
  product,
  session,
}: {
  product: Product;
  session: CustomizationSession;
}) {
  const { address, connector, isConnected } = useAccount();
  const { connectModalOpen, openConnectModal } = useConnectModal();
  const [requestKey, setRequestKey] = useState("");
  const [submitState, setSubmitState] = useState<OrderSubmitState>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<QuoteSubmissionResult>();
  const [resumeAfterConnect, setResumeAfterConnect] = useState(false);
  const connectModalWasOpen = useRef(false);

  useEffect(() => {
    const storageKey = `${REQUEST_KEY_PREFIX}${product.slug}`;
    const existing = window.localStorage.getItem(storageKey);
    const next = existing || crypto.randomUUID();
    window.localStorage.setItem(storageKey, next);
    window.queueMicrotask(() => setRequestKey(next));
  }, [product.slug]);

  const isBusy = ["connecting", "signing", "uploading", "submitting"].includes(submitState);
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

  const submitAuthenticated = useCallback(async () => {
    if (!requestKey || !isApprovedCustomizationBrief(session)) {
      setSubmitState("error");
      setError("Finish the customization brief before placing the order.");
      return;
    }
    if (!connector || !address) {
      setSubmitState("error");
      setError("Your wallet is still connecting. Please try again.");
      return;
    }

    setError("");
    const supabase = createClient();
    if (!supabase) {
      setSubmitState("error");
      setError("We could not verify your wallet. Try again in a moment.");
      return;
    }

    try {
      const { data: currentSession } = await supabase.auth.getSession();
      if (!currentSession.session) {
        setSubmitState("signing");
        const wallet = await connector.getProvider();
        const { error: authError } = await supabase.auth.signInWithWeb3({
          chain: "ethereum",
          statement: "Sign in to LOOMON to place this custom order request.",
          wallet: wallet as never,
        });
        if (authError) throw authError;
      }

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
          requestKey,
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

      setSubmitState("submitting");
      const { data, error: submitError } = await supabase.rpc("submit_customization_quote", {
        p_product_slug: product.slug,
        p_intent: session.intent,
        p_notes: session.notes,
        p_quantity: session.quantity,
        p_required_by: session.requiredBy || undefined,
        p_client_request_key: requestKey,
        ...assetInput,
      });
      if (submitError) throw submitError;

      const submitted = quoteSubmissionResultSchema.parse(data);
      setResult(submitted);
      setSubmitState("success");
      window.localStorage.removeItem(`${REQUEST_KEY_PREFIX}${product.slug}`);
    } catch (cause) {
      setSubmitState("error");
      setError(friendlyOrderError(cause));
    }
  }, [address, connector, product.slug, requestKey, session]);

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
    setError("");
    if (!canSubmit) {
      setSubmitState("error");
      setError("Check the quantity and finish the customization brief first.");
      return;
    }
    if (!isConnected) {
      if (!openConnectModal) {
        setSubmitState("error");
        setError("The wallet chooser is unavailable. Refresh the page and try again.");
        return;
      }
      connectModalWasOpen.current = false;
      setResumeAfterConnect(true);
      setSubmitState("connecting");
      openConnectModal();
      setSubmitState("idle");
      return;
    }
    void submitAuthenticated();
  }, [canSubmit, isConnected, openConnectModal, submitAuthenticated]);

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
