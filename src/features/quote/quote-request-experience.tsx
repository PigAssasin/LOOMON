"use client";

import Link from "next/link";
import { ArrowLeft, Check, ImageIcon, LoaderCircle, ShieldCheck, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { Product } from "@/src/domain/product";
import { ProductVisual } from "@/src/components/product-visual";
import { SiteHeader } from "@/src/components/site-header";
import {
  loadCustomization,
  type CustomizationSession,
} from "@/src/features/customization/customization-storage";
import { createClient } from "@/src/lib/supabase/client";
import { formatMoney } from "@/src/lib/money";
import {
  buildCustomizationAssetPath,
  isApprovedCustomizationBrief,
  quoteSubmissionResultSchema,
  sanitizeCustomizationFileName,
  type QuoteSubmissionResult,
} from "@/src/domain/quote-request";

type SubmitState = "idle" | "signing" | "uploading" | "submitting" | "success" | "error";

const QUOTE_DRAFT_PREFIX = "loomon-quote-draft:";

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function sha256(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function approvedAsset(session: CustomizationSession) {
  const preview = session.previews.find((item) => item.label === session.selectedPreview);
  if (preview) {
    const response = await fetch(preview.url);
    if (!response.ok) throw new Error("The selected AI preview could not be prepared.");
    const blob = await response.blob();
    return {
      blob,
      role: "agent_render" as const,
      fileName: `${session.productSlug}-${sanitizeCustomizationFileName(preview.label)}.png`,
      previewLabel: preview.label,
    };
  }

  if (session.file) {
    return {
      blob: session.file,
      role: "artwork" as const,
      fileName: session.fileName ?? session.file.name,
      previewLabel: undefined,
    };
  }

  return undefined;
}

export function QuoteRequestExperience({ product }: { product: Product }) {
  const { address, connector, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [session, setSession] = useState<CustomizationSession>();
  const [loaded, setLoaded] = useState(false);
  const [quantity, setQuantity] = useState(product.minimumOrderQuantity);
  const [requiredBy, setRequiredBy] = useState("");
  const [notes, setNotes] = useState("");
  const [requestKey, setRequestKey] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<QuoteSubmissionResult>();
  const [resumeAfterConnect, setResumeAfterConnect] = useState(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    void loadCustomization(product.slug)
      .then((stored) => {
        if (!active) return;
        setSession(stored);
        setNotes(stored?.notes ?? "");
        const storageKey = `${QUOTE_DRAFT_PREFIX}${product.slug}`;
        const saved = window.localStorage.getItem(storageKey);
        const draft = saved ? JSON.parse(saved) as {
          quantity?: number;
          requiredBy?: string;
          requestKey?: string;
        } : {};
        setQuantity(Math.max(product.minimumOrderQuantity, draft.quantity ?? product.minimumOrderQuantity));
        setRequiredBy(draft.requiredBy ?? "");
        setRequestKey(draft.requestKey ?? crypto.randomUUID());
      })
      .catch(() => setError("The saved brief could not be loaded. Return to the product and review it again."))
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [product]);

  useEffect(() => {
    if (!requestKey) return;
    window.localStorage.setItem(
      `${QUOTE_DRAFT_PREFIX}${product.slug}`,
      JSON.stringify({ quantity, requiredBy, requestKey }),
    );
  }, [product.slug, quantity, requestKey, requiredBy]);

  useEffect(() => {
    if (!resumeAfterConnect || !isConnected || !connector || !address) return;
    const frame = window.requestAnimationFrame(() => {
      setResumeAfterConnect(false);
      submitButtonRef.current?.click();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [address, connector, isConnected, resumeAfterConnect]);

  const estimate = useMemo(() => quantity * product.priceFrom, [product.priceFrom, quantity]);
  const isBusy = submitState === "signing" || submitState === "uploading" || submitState === "submitting";
  const canSubmit = Boolean(
    loaded
      && session
      && isApprovedCustomizationBrief(session)
      && quantity >= product.minimumOrderQuantity
      && requestKey
      && !isBusy,
  );

  async function submitQuote() {
    if (!canSubmit || !session) return;
    if (!isConnected || !connector) {
      setResumeAfterConnect(true);
      openConnectModal?.();
      return;
    }

    setError("");
    const supabase = createClient();
    if (!supabase) {
      setSubmitState("error");
      setError("We could not verify your wallet. Try again in a moment.");
      return;
    }

    let uploadedPath: string | undefined;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setSubmitState("signing");
        const wallet = await connector.getProvider();
        const { error: authError } = await supabase.auth.signInWithWeb3({
          chain: "ethereum",
          statement: "Sign in to LOOMON to submit this maker brief and quote request.",
          wallet: wallet as never,
        });
        if (authError) throw new Error(authError.message);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Wallet sign-in did not create a LOOMON session.");
      if (!address) throw new Error("Connect your wallet to continue.");

      const { error: walletSyncError } = await supabase.rpc("sync_my_web3_wallet", {
        p_address: address,
      });
      if (walletSyncError) throw new Error(walletSyncError.message);

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
        uploadedPath = buildCustomizationAssetPath({
          userId: user.id,
          requestKey,
          fileName: asset.fileName,
        });
        const { error: uploadError } = await supabase.storage
          .from("customization-assets")
          .upload(uploadedPath, asset.blob, { contentType: mimeType, upsert: false });
        if (uploadError && !uploadError.message.toLowerCase().includes("already exists")) {
          throw new Error(uploadError.message);
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
        p_notes: notes,
        p_quantity: quantity,
        p_required_by: requiredBy || undefined,
        p_client_request_key: requestKey,
        ...assetInput,
      });
      if (submitError) throw new Error(submitError.message);

      const submitted = quoteSubmissionResultSchema.parse(data);
      setResult(submitted);
      setSubmitState("success");
      window.localStorage.removeItem(`${QUOTE_DRAFT_PREFIX}${product.slug}`);
    } catch (cause) {
      setSubmitState("error");
      const message = cause instanceof Error ? cause.message : "The quote request could not be submitted.";
      setError(
        /web3|provider|disabled|not enabled|wallet_identity/i.test(message)
          ? "We could not verify your wallet. Your brief is saved—please try again."
          : message,
      );
    }
  }

  if (submitState === "success" && result) {
    return (
      <main>
        <div className="static-header-wrap"><SiteHeader /></div>
        <section className="quote-page-shell quote-success">
          <span><Check size={29} /></span>
          <p className="bracket-label">{`{ Quote request submitted }`}</p>
          <h1>The maker has your brief.</h1>
          <p>{product.makerName} can now review the approved customization and prepare a final quote.</p>
          <dl>
            <div><dt>Project</dt><dd>{result.projectReference}</dd></div>
            <div><dt>Status</dt><dd>Waiting for seller review</dd></div>
          </dl>
          <div>
            <Link className="gradient-stroke-button" href="/app/orders">View orders</Link>
            <Link className="ghost-button" href="/app">Keep browsing</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <div className="static-header-wrap"><SiteHeader /></div>
      <section className="quote-page-shell">
        <Link className="back-link" href={`/app/products/${product.slug}?customize=1`}>
          <ArrowLeft size={16} /> Back to brief
        </Link>
        <div className="quote-page-grid">
          <aside className="quote-product-summary">
            <ProductVisual product={product} />
            <div>
              <span>{product.category}</span>
              <h2>{product.title}</h2>
              <p>{product.makerName} · {product.province}</p>
            </div>
          </aside>

          <section className="quote-requirements">
            <header className="quote-heading">
              <p className="bracket-label">{`{ Review your request }`}</p>
              <h1>Send this brief to the maker.</h1>
              <p className="muted-copy">Nothing is charged now. The seller reviews feasibility and sends the final quote first.</p>
            </header>

            {!loaded ? <div className="quote-loading"><LoaderCircle size={22} /> Loading saved brief…</div> : !isApprovedCustomizationBrief(session) || !session ? <div className="quote-missing-brief"><strong>No approved brief was found.</strong><p>Return to the product, finish the customization brief, then continue again.</p></div> : <>
              <div className="quote-brief-summary">
                <span>{session.selectedPreview ? <ImageIcon size={18} /> : <Check size={18} />}</span>
                <div><strong>{session.selectedPreview ? `${session.selectedPreview} approved` : "Maker brief approved"}</strong><p>{session.fileName ?? (session.intent === "text_only" ? "Text-only customization" : "Customization reference attached")}</p></div>
              </div>

              <div className="form-grid">
                <label><span>Quantity</span><input type="number" min={product.minimumOrderQuantity} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
                <label><span>Needed by <small>Optional</small></span><input type="date" min={tomorrow()} value={requiredBy} onChange={(event) => setRequiredBy(event.target.value)} /></label>
                <label className="field-wide"><span>Notes for the maker</span><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Packaging, placement, size, color or production context…" /></label>
              </div>

              <div className="quote-preview">
                <span><strong>Starting estimate</strong><small>Seller confirms the final quote before any Arc payment.</small></span>
                <strong>{formatMoney(estimate)}</strong>
              </div>

              {error ? <p className="quote-submit-error" role="alert">{error}</p> : null}
              <button ref={submitButtonRef} className="gradient-stroke-button full-width" type="button" disabled={!canSubmit} onClick={submitQuote}>
                {isBusy ? <><LoaderCircle className="quote-spinner" size={18} /> {submitState === "signing" ? "Confirm in wallet" : submitState === "uploading" ? "Securing brief" : "Sending request"}</> : isConnected ? "Submit quote request" : <><WalletCards size={18} /> Connect wallet to submit</>}
              </button>
              <p className="quote-security-note"><ShieldCheck size={15} /> You are sending a request. Nothing is charged.</p>
            </>}
          </section>
        </div>
      </section>
    </main>
  );
}
