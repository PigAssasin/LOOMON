"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, FileImage, LoaderCircle, ShieldCheck, Sparkles, Type, UploadCloud, WalletCards, WandSparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProductVisual } from "@/src/components/product-visual";
import type { Product } from "@/src/domain/product";
import {
  createEmptyCustomizationSession,
  loadCustomization,
  normalizeCustomizationSession,
  saveCustomization,
  type CustomizationIntent,
  type CustomizationSession,
} from "@/src/features/customization/customization-storage";
import { formatMoney } from "@/src/lib/money";
import { useOrderRequestSubmission } from "@/src/features/quote/use-order-request-submission";

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function createProductReference(product: Product): Promise<Blob> {
  const response = await fetch(`/images/catalog-sheet-${product.imageSource}.png`);
  if (!response.ok) throw new Error("Product reference could not be loaded");
  const bitmap = await createImageBitmap(await response.blob());
  const sourceWidth = Math.floor(bitmap.width / 2);
  const sourceHeight = Math.floor(bitmap.height / 2);
  const right = product.imagePosition.endsWith("right");
  const bottom = product.imagePosition.startsWith("bottom");
  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Product reference canvas is unavailable");
  context.drawImage(bitmap, right ? sourceWidth : 0, bottom ? sourceHeight : 0, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Product reference could not be prepared")), "image/png"));
}

const intentOptions: Array<{ value: CustomizationIntent; title: string; detail: string; icon: typeof WandSparkles }> = [
  { value: "apply_artwork", title: "Apply my artwork", detail: "Place the uploaded design on this exact product.", icon: WandSparkles },
  { value: "text_only", title: "Text only", detail: "Add a name, message or short line without an image.", icon: Type },
  { value: "maker_reference", title: "Send as maker reference", detail: "Attach the image to the brief. Do not place it on the product.", icon: FileImage },
];

export function ProductCustomizationStudio({
  product,
  open,
  onClose,
}: {
  product: Product;
  open: boolean;
  onClose: () => void;
}) {
  const [session, setSession] = useState<CustomizationSession>(
    () => createEmptyCustomizationSession(product.slug, product.minimumOrderQuantity),
  );
  const [loaded, setLoaded] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const resumeStarted = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const order = useOrderRequestSubmission({ product, session });

  const persist = useCallback((next: CustomizationSession) => {
    setSession(next);
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => saveCustomization(next));
  }, []);

  const render = useCallback(async (current: CustomizationSession) => {
    if (current.intent === "apply_artwork" && !current.file) return;
    if (current.intent === "text_only" && !current.notes.trim()) return;
    if (current.renderStartedAt && current.status !== "rendering") return;
    const rendering = current.status === "rendering" ? current : {
      ...current,
      mode: "agent" as const,
      status: "rendering" as const,
      previews: [],
      selectedPreview: undefined,
      renderId: crypto.randomUUID(),
      renderStartedAt: Date.now(),
      updatedAt: Date.now(),
    };
    persist(rendering);
    try {
      const body = new FormData();
      const productImage = await createProductReference(product);
      body.append("productImage", productImage, `${product.slug}-reference.png`);
      if (current.intent === "apply_artwork" && current.file) body.append("artwork", current.file);
      body.append("intent", current.intent);
      body.append("productName", product.title);
      body.append("notes", current.notes);
      body.append("renderId", rendering.renderId ?? "");
      const response = await fetch("/api/agent/render", { method: "POST", body });
      if (!response.ok) throw new Error("Render request failed");
      const result = await response.json() as { demo: boolean; images: CustomizationSession["previews"] };
      persist({ ...rendering, status: "ready", previews: result.images, renderDemo: result.demo, updatedAt: Date.now() });
    } catch {
      persist({ ...rendering, status: "error", updatedAt: Date.now() });
    }
  }, [persist, product]);

  useEffect(() => {
    let active = true;
    void loadCustomization(product.slug).then((stored) => {
      if (!active) return;
      const next = normalizeCustomizationSession(product.slug, product.minimumOrderQuantity, stored);
      setSession(next);
      if (next.file) setSourceUrl(URL.createObjectURL(next.file));
      setLoaded(true);
    }).catch(() => setLoaded(true));
    return () => { active = false; };
  }, [product]);

  useEffect(() => {
    if (!loaded || session.status !== "rendering" || session.intent === "maker_reference" || resumeStarted.current) return;
    resumeStarted.current = true;
    void render(session);
  }, [loaded, render, session]);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);

  if (!open) return null;

  function selectFile(file: File | undefined) {
    if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) return;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(URL.createObjectURL(file));
    persist({ ...session, file, fileName: file.name, previews: [], selectedPreview: undefined, renderId: undefined, renderStartedAt: undefined, submittedAt: undefined, status: "idle", updatedAt: Date.now() });
  }

  function selectIntent(intent: CustomizationIntent) {
    persist({ ...session, intent, mode: "choose", status: "idle", previews: [], selectedPreview: undefined });
  }

  function submitSelectedPreview() {
    if (!session.selectedPreview) return;
    persist({ ...session, mode: "choose", submittedAt: Date.now(), updatedAt: Date.now() });
  }

  const selectedPreview = session.previews.find((preview) => preview.label === session.selectedPreview);
  const canContinue = session.intent === "text_only" ? Boolean(session.notes.trim()) : Boolean(session.file);
  const canRender = session.intent !== "maker_reference";
  const oneTimeRenderUsedWithoutResult = Boolean(session.renderStartedAt && session.previews.length === 0 && session.status !== "rendering");

  return <div className="custom-studio-layer" role="dialog" aria-modal="true" aria-label={`Customize ${product.title}`}>
    <button className="custom-studio-scrim" type="button" onClick={onClose} aria-label="Close customization studio" />
    <section className="custom-studio">
      <header>
        <div><span><Sparkles size={17} /></span><div><strong>Customize {product.title}</strong><small>Progress is saved automatically</small></div></div>
        <button type="button" onClick={onClose} aria-label="Close customization studio"><X size={22} /></button>
      </header>

      <div className="custom-studio-body">
        {order.result ? <section className="custom-order-success" role="status">
          <span><Check size={29} /></span>
          <p className="bracket-label">{`{ Order funded on Arc }`}</p>
          <h2>Your order is placed.</h2>
          <p>Your USDC is protected in escrow while {product.makerName} completes the order. After you confirm completion, the seller waits seven days before claiming the funds.</p>
          <dl>
            <div><dt>Reference</dt><dd>{order.result.orderReference}</dd></div>
            <div><dt>Status</dt><dd>Funded in escrow</dd></div>
          </dl>
          <div className="custom-order-success-actions">
            <Link className="gradient-stroke-button" href="/app/orders">View orders</Link>
            <a className="ghost-button" href={`https://testnet.arcscan.app/tx/${order.result.transactionHash}`} target="_blank" rel="noreferrer">View on Arcscan</a>
            <button className="ghost-button" type="button" onClick={onClose}>Close</button>
          </div>
        </section> : null}

        {!order.result && session.mode === "choose" ? <section className="custom-setup-step">
          <div className="custom-product-reference"><ProductVisual product={product} /><span>Product reference - shape must stay unchanged</span></div>
          <div className="custom-setup-controls">
            <p className="bracket-label">{`{ Custom brief }`}</p>
            <h2>What should the maker do?</h2>
            <div className="custom-intent-options">{intentOptions.map((option) => {
              const Icon = option.icon;
              return <button className={session.intent === option.value ? "active" : ""} type="button" key={option.value} onClick={() => selectIntent(option.value)}><Icon size={19} /><span><strong>{option.title}</strong><small>{option.detail}</small></span><i>{session.intent === option.value ? <Check size={15} /> : null}</i></button>;
            })}</div>

            {session.intent !== "text_only" ? <div className="custom-artwork-field">
              <span>{session.intent === "apply_artwork" ? "Artwork to place on product" : "Reference file for the maker"}</span>
              {session.file && sourceUrl ? <div className="custom-artwork-file"><Image src={sourceUrl} alt="Uploaded artwork" width={76} height={76} unoptimized /><span><strong>{session.fileName}</strong><small>{session.intent === "maker_reference" ? "Will not be placed on the product" : "Ready to apply"}</small></span><label>Replace<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectFile(event.target.files?.[0])} /></label></div> : <label className="custom-artwork-upload"><UploadCloud size={22} /><span><strong>Upload an image</strong><small>PNG, JPG or WebP - maximum 5 MB</small></span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectFile(event.target.files?.[0])} /></label>}
            </div> : null}

            <label className="custom-prompt-field">
              <span>{session.intent === "text_only" ? "Text and maker notes" : "Maker notes"}</span>
              <textarea
                rows={4}
                value={session.notes}
                onChange={(event) => persist({ ...session, notes: event.target.value, updatedAt: Date.now() })}
                placeholder={session.intent === "text_only" ? "For example: Write An & Minh 2026 in small cobalt letters near the base." : session.intent === "maker_reference" ? "Add material, size, mood, delivery or production notes for the maker." : "Add placement, size, color or production notes for the maker."}
              />
            </label>

            <div className="custom-action-row">
              {canRender ? <button className="ghost-button" type="button" disabled={!canContinue || oneTimeRenderUsedWithoutResult} onClick={() => session.previews.length ? persist({ ...session, mode: "agent", status: "ready", updatedAt: Date.now() }) : void render(session)}>{oneTimeRenderUsedWithoutResult ? "One-time render already used" : session.renderStartedAt ? "View generated previews" : "Render 3 product previews - once"}</button> : null}
            </div>
          </div>
        </section> : null}

        {!order.result && session.mode === "choose" ? <section className={`custom-brief-ready ${selectedPreview ? "custom-preview-submitted" : ""}`}>
          <span><Check size={27} /></span>
          <p className="bracket-label">{selectedPreview ? `{ Preview and order details }` : `{ Order details }`}</p>
          <h2>Review and place your order.</h2>
          {selectedPreview ? <Image src={selectedPreview.url} alt="Selected product preview" width={520} height={520} unoptimized /> : null}
          <p>{selectedPreview ? <><strong>{selectedPreview.label}</strong> will be sent as the approved visual reference.</> : session.intent === "maker_reference" ? <>{session.fileName} will be sent as a separate maker reference.</> : <>No AI preview is required for this order.</>}</p>

          <div className="custom-order-fields">
            <label>
              <span>Quantity</span>
              <input
                type="number"
                min={product.minimumOrderQuantity}
                value={session.quantity}
                onChange={(event) => persist({ ...session, quantity: Number(event.target.value), updatedAt: Date.now() })}
              />
              <small>Minimum {product.minimumOrderQuantity} pieces</small>
            </label>
            <label>
              <span>Needed by <small>Optional</small></span>
              <input
                type="date"
                min={tomorrow()}
                value={session.requiredBy}
                onChange={(event) => persist({ ...session, requiredBy: event.target.value, updatedAt: Date.now() })}
              />
            </label>
            <label className="field-wide">
              <span>Note for the maker</span>
              <textarea
                rows={4}
                value={session.notes}
                onChange={(event) => persist({ ...session, notes: event.target.value, updatedAt: Date.now() })}
                placeholder="Placement, packaging, colors or anything the maker should know…"
              />
            </label>
          </div>

          <div className="custom-order-estimate">
            <span><strong>Estimated order total</strong><small>The confirmed USDC total appears before you sign.</small></span>
            <strong>{formatMoney(order.estimate)}</strong>
          </div>
          {order.error ? <p className="quote-submit-error" role="alert">{order.error}</p> : null}
          <button className="gradient-stroke-button full-width" type="button" disabled={!order.canSubmit} onClick={order.placeOrder}>
            {order.isBusy ? <><LoaderCircle className="quote-spinner" size={18} /> {
              order.submitState === "connecting" ? "Opening wallet"
                : order.submitState === "signing" ? "Verify wallet"
                  : order.submitState === "uploading" ? "Securing artwork"
                    : order.submitState === "preparing" ? "Preparing escrow"
                      : order.submitState === "switching_network" ? "Switching to Arc"
                        : order.submitState === "approving" ? "Allow USDC in wallet"
                          : order.submitState === "funding" ? "Confirm order in wallet"
                            : "Verifying Arc payment"
            }</> : <><WalletCards size={18} /> Place order</>}
          </button>
          <p className="quote-security-note"><ShieldCheck size={15} /> USDC goes into Arc escrow now. The seller can claim only seven days after you confirm completion.</p>
        </section> : null}

        {!order.result && session.mode === "agent" ? <section className="custom-render-step">
          {session.status !== "ready" ? <button className="back-link" type="button" onClick={() => persist({ ...session, mode: "choose", status: "idle", updatedAt: Date.now() })}><ArrowLeft size={16} /> Back to custom brief</button> : null}
          <div className="custom-render-heading"><div><p className="bracket-label">{`{ Product-locked render }`}</p><h2>{session.status === "rendering" ? "Applying your design." : session.status === "ready" ? "Choose a product preview." : "Ready to try again."}</h2></div><div className="custom-render-reference"><ProductVisual product={product} /><small>Locked product</small></div></div>
          {session.status === "rendering" ? <><div className="custom-render-loading"><i /><i /><i /></div><p className="custom-render-note">The product shape, material and color are locked. Only the requested artwork or text may change.</p></> : null}
          {session.status === "ready" ? <><div className="custom-render-grid">{session.previews.map((preview) => <button className={session.selectedPreview === preview.label ? "active" : ""} type="button" key={preview.label} onClick={() => persist({ ...session, selectedPreview: preview.label, updatedAt: Date.now() })}><Image src={preview.url} alt={preview.label} width={440} height={440} unoptimized /><span><Check size={15} /> {session.selectedPreview === preview.label ? `${preview.label} selected` : preview.label}</span></button>)}</div><div className="custom-preview-confirm"><span>{session.selectedPreview ? `${session.selectedPreview} will be sent with the maker brief.` : "Select one preview to continue."}</span><button className="gradient-stroke-button" type="button" disabled={!session.selectedPreview} onClick={submitSelectedPreview}>Use this preview</button></div></> : null}
          {session.status === "error" ? <p className="custom-render-error">The render stopped. The product reference and your brief are still saved.</p> : null}
          {session.status === "error" ? <p className="custom-render-note">This one-time render could not finish. Return to the brief to keep the original artwork for the maker.</p> : null}
        </section> : null}
      </div>
    </section>
  </div>;
}
