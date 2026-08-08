"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, ImagePlus, LoaderCircle, ShieldCheck, Sparkles, UploadCloud, WalletCards, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProductVisual } from "@/src/components/product-visual";
import type { Product } from "@/src/domain/product";
import {
  createEmptyCustomizationSession,
  loadCustomization,
  normalizeCustomizationSession,
  saveCustomization,
  type CustomizationSession,
} from "@/src/features/customization/customization-storage";
import { useOrderRequestSubmission } from "@/src/features/quote/use-order-request-submission";
import { useLoomonSession } from "@/src/features/auth/use-loomon-session";
import { formatMoney } from "@/src/lib/money";

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
    () => createEmptyCustomizationSession(product.slug),
  );
  const [loaded, setLoaded] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const order = useOrderRequestSubmission({ product, session });
  const authSession = useLoomonSession();

  const persist = useCallback((next: CustomizationSession) => {
    setSession(next);
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => saveCustomization(next));
  }, []);

  const render = useCallback(async (current: CustomizationSession) => {
    const textToPrint = current.printText.trim();
    const artworkDescription = current.artworkDescription.trim();
    if (!current.file && !textToPrint && !artworkDescription) return;
    const rendering = {
      ...current,
      mode: "choose" as const,
      intent: current.file ? "apply_artwork" as const : "text_only" as const,
      status: "rendering" as const,
      previews: [],
      selectedPreview: undefined,
      renderId: crypto.randomUUID(),
      renderStartedAt: Date.now(),
      updatedAt: Date.now(),
    };
    persist(rendering);
    try {
      if (!(await authSession.ensureSession())) {
        throw new Error("Wallet sign-in required before rendering.");
      }
      const body = new FormData();
      const productImage = await createProductReference(product);
      body.append("productImage", productImage, `${product.slug}-reference.png`);
      if (current.file) body.append("artwork", current.file);
      body.append("intent", current.file ? "apply_artwork" : "text_only");
      body.append("productName", product.title);
      body.append("printText", textToPrint);
      body.append("artworkDescription", artworkDescription);
      body.append("notes", current.notes);
      body.append("renderId", rendering.renderId ?? "");
      const response = await fetch("/api/agent/render", { method: "POST", body });
      if (!response.ok) throw new Error("Render request failed");
      const result = await response.json() as { demo: boolean; images: CustomizationSession["previews"] };
      persist({ ...rendering, status: "ready", previews: result.images, selectedPreview: result.images[1]?.label ?? result.images[0]?.label, renderDemo: result.demo, updatedAt: Date.now() });
    } catch {
      persist({ ...rendering, status: "error", updatedAt: Date.now() });
    }
  }, [authSession, persist, product]);

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

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);

  if (!open) return null;

  function selectFile(file: File | undefined) {
    if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) return;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(URL.createObjectURL(file));
    persist({
      ...session,
      file,
      fileName: file.name,
      intent: "apply_artwork",
      previews: [],
      selectedPreview: undefined,
      renderId: undefined,
      renderStartedAt: undefined,
      submittedAt: undefined,
      status: "idle",
      updatedAt: Date.now(),
    });
  }

  function clearFile() {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl("");
    const { file, fileName, ...next } = session;
    void file;
    void fileName;
    persist({
      ...next,
      intent: next.printText.trim() ? "text_only" : "maker_reference",
      previews: [],
      selectedPreview: undefined,
      renderId: undefined,
      renderStartedAt: undefined,
      status: "idle",
      updatedAt: Date.now(),
    });
  }

  function updatePrintText(value: string) {
    persist({
      ...session,
      printText: value,
      intent: session.file ? "apply_artwork" : value.trim() ? "text_only" : "maker_reference",
      previews: [],
      selectedPreview: undefined,
      renderId: undefined,
      renderStartedAt: undefined,
      status: "idle",
      updatedAt: Date.now(),
    });
  }

  function updateArtworkDescription(value: string) {
    persist({
      ...session,
      artworkDescription: value,
      previews: [],
      selectedPreview: undefined,
      renderId: undefined,
      renderStartedAt: undefined,
      status: "idle",
      updatedAt: Date.now(),
    });
  }

  const selectedPreview = session.previews.find((preview) => preview.label === session.selectedPreview) ?? session.previews[1] ?? session.previews[0];
  const hasRenderInput = Boolean(session.file || session.printText.trim() || session.artworkDescription.trim());
  const renderDisabled = !hasRenderInput || order.isBusy || session.status === "rendering";

  return <div className="custom-studio-layer" role="dialog" aria-modal="true" aria-label={`Customize ${product.title}`}>
    <button className="custom-studio-scrim" type="button" onClick={onClose} aria-label="Close customization studio" />
    <section className="custom-studio">
      <header>
        <div><span><Sparkles size={17} /></span><div><strong>Customize {product.title}</strong><small>{loaded ? "Progress is saved automatically" : "Loading saved draft"}</small></div></div>
        <button type="button" onClick={onClose} aria-label="Close customization studio"><X size={22} /></button>
      </header>

      <div className="custom-studio-body custom-studio-body--single">
        {order.result ? <section className="custom-order-success" role="status">
          <span><Check size={29} /></span>
          <p className="bracket-label">{`{ Order funded on Arc }`}</p>
          <h2>Your order is placed.</h2>
          <p>Your USDC is protected in escrow while {product.makerName} completes the order. The delivery proof NFT is minted only after successful delivery is confirmed.</p>
          <dl>
            <div><dt>Reference</dt><dd>{order.result.orderReference}</dd></div>
            <div><dt>Status</dt><dd>Funded in escrow</dd></div>
          </dl>
          <div className="custom-order-success-actions">
            <Link className="gradient-stroke-button" href="/app/orders">View orders</Link>
            <a className="ghost-button" href={`https://testnet.arcscan.app/tx/${order.result.transactionHash}`} target="_blank" rel="noreferrer">View on Arcscan</a>
            <button className="ghost-button" type="button" onClick={onClose}>Close</button>
          </div>
        </section> : <section className="custom-order-sheet">
          <div className="custom-order-reference">
            {selectedPreview ? <div className="custom-selected-preview custom-selected-preview--hero"><Image src={selectedPreview.url} alt="Selected AI preview" width={720} height={720} unoptimized /><span><Check size={15} /> Selected AI preview</span></div> : <div className="custom-product-reference"><ProductVisual product={product} /><span>Product reference - shape must stay unchanged</span></div>}
          </div>

          <div className="custom-order-form">
            <p className="bracket-label">{`{ Custom order }`}</p>
            <h2>Place your order.</h2>
            <p className="custom-order-subcopy">Only fill what you need. Image, printed text and receive date are optional.</p>

            <div className="custom-simple-fields">
              <div className="custom-artwork-field">
                <span>Image to print on product <small>Optional</small></span>
                {session.file && sourceUrl ? <div className="custom-artwork-file"><Image src={sourceUrl} alt="Uploaded artwork" width={76} height={76} unoptimized /><span><strong>{session.fileName}</strong><small>Will be sent with the order. You can render a preview before ordering.</small></span><label>Replace<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectFile(event.target.files?.[0])} /></label><button type="button" onClick={clearFile}>Remove</button></div> : <label className="custom-artwork-upload"><UploadCloud size={22} /><span><strong>Upload image</strong><small>PNG, JPG or WebP - maximum 5 MB</small></span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectFile(event.target.files?.[0])} /></label>}
              </div>

              <label className="custom-prompt-field">
                <span>Text to print on product <small>Optional</small></span>
                <input
                  value={session.printText}
                  onChange={(event) => updatePrintText(event.target.value)}
                  placeholder="Example: An & Minh 2026"
                />
              </label>

              <label className="custom-prompt-field">
                <span>Describe the artwork or placement <small>Optional</small></span>
                <textarea
                  rows={3}
                  value={session.artworkDescription}
                  onChange={(event) => updateArtworkDescription(event.target.value)}
                  placeholder="Example: place a tiny red lotus mark near the lower right edge, calm souvenir style."
                />
              </label>

              <div className="custom-ai-render-card">
                <div><ImagePlus size={19} /><span><strong>AI preview</strong><small>Optional · 3 images · testnet preview</small></span></div>
                <button className="ghost-button" type="button" disabled={renderDisabled} onClick={() => void render(session)}>
                  {session.status === "rendering" ? <><LoaderCircle className="quote-spinner" size={17} /> Rendering</> : session.previews.length ? "Render 3 new previews" : "Render 3 previews"}
                </button>
                {!hasRenderInput ? <p>Add an image or text first if you want AI previews. You can still place the order without rendering.</p> : null}
              </div>

              {session.status === "error" ? <p className="custom-render-error">AI preview could not finish. Your order details are still saved.</p> : null}
              {session.status === "rendering" ? <div className="custom-render-loading"><i /><i /><i /></div> : null}
              {session.previews.length ? <div className="custom-render-grid custom-render-grid--inline">{session.previews.map((preview) => <button className={(session.selectedPreview ?? selectedPreview?.label) === preview.label ? "active" : ""} type="button" key={preview.label} onClick={() => persist({ ...session, selectedPreview: preview.label, updatedAt: Date.now() })}><Image src={preview.url} alt={preview.label} width={440} height={440} unoptimized /><span><Check size={15} /> {preview.label}</span></button>)}</div> : null}

              <label className="custom-prompt-field">
                <span>Note for the seller <small>Optional</small></span>
                <textarea
                  rows={4}
                  value={session.notes}
                  onChange={(event) => persist({ ...session, notes: event.target.value, updatedAt: Date.now() })}
                  placeholder="Packaging, placement, delivery context, or anything the seller should know."
                />
              </label>

              <div className="custom-order-fields custom-order-fields--compact">
                <label>
                  <span>Quantity</span>
                  <input
                    type="number"
                    min={1}
                    value={session.quantity}
                    onChange={(event) => persist({ ...session, quantity: Number(event.target.value), updatedAt: Date.now() })}
                  />
                  <small>No minimum for the demo</small>
                </label>
                <label>
                  <span>Wanted by <small>Optional</small></span>
                  <input
                    type="date"
                    min={tomorrow()}
                    value={session.requiredBy}
                    onChange={(event) => persist({ ...session, requiredBy: event.target.value, updatedAt: Date.now() })}
                  />
                </label>
              </div>

              <div className="custom-order-estimate">
                <span><strong>Estimated total</strong><small>USDC goes into Arc escrow when you sign.</small></span>
                <strong>{formatMoney(order.estimate)}</strong>
              </div>
              {order.error ? <p className="quote-submit-error" role="alert">{order.error}</p> : null}
              <button className="gradient-stroke-button full-width" type="button" disabled={order.isBusy} onClick={order.placeOrder}>
                {order.isBusy ? <><LoaderCircle className="quote-spinner" size={18} /> {
                  order.submitState === "connecting" ? "Opening wallet"
                    : order.submitState === "signing" ? "Verify wallet"
                      : order.submitState === "uploading" ? "Securing artwork"
                        : order.submitState === "preparing" ? "Preparing escrow"
                          : order.submitState === "switching_network" ? "Switching to Arc"
                            : order.submitState === "funding" ? "Sign order"
                              : "Verifying payment"
                }</> : <><WalletCards size={18} /> Place order</>}
              </button>
              <p className="quote-security-note"><ShieldCheck size={15} /> The seller receives funds only through the escrow rules. Delivery proof NFT is minted after successful delivery confirmation.</p>
            </div>
          </div>
        </section>}
      </div>
    </section>
  </div>;
}
