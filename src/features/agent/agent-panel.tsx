"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Check, ExternalLink, Send, Sparkles, Trash2, UploadCloud, WalletCards, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Product } from "@/src/domain/product";
import { products } from "@/src/data/products";
import { formatMoney } from "@/src/lib/money";
import { recommendProducts } from "@/src/lib/recommend-products";

type Stage = "discover" | "requirements" | "invoice" | "paying" | "paid";

interface QuoteInput {
  quantity: number;
  finish: string;
  logo: boolean;
  deadline: string;
  note: string;
}

export function AgentPanel({ open, onClose, initialProduct }: { open: boolean; onClose: () => void; initialProduct?: Product }) {
  const [stage, setStage] = useState<Stage>(initialProduct ? "requirements" : "discover");
  const [query, setQuery] = useState("Tôi cần quà cho 50 khách VIP, có logo và giao trong 30 ngày");
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(initialProduct);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [quote, setQuote] = useState<QuoteInput>({ quantity: initialProduct?.minimumOrderQuantity ?? 50, finish: initialProduct?.finishes[0] ?? "Maker's recommendation", logo: false, deadline: "", note: "" });
  const [logoFile, setLogoFile] = useState<{ name: string; url: string } | null>(null);

  const estimate = useMemo(() => (selectedProduct?.priceFrom ?? 0) * quote.quantity, [selectedProduct, quote.quantity]);
  const deposit = estimate * 0.4;

  if (!open) return null;

  function runSearch() {
    setRecommendations(recommendProducts(products, query));
  }

  function chooseProduct(product: Product) {
    setSelectedProduct(product);
    setQuote((current) => ({ ...current, quantity: Math.max(current.quantity, product.minimumOrderQuantity), finish: product.finishes[0] }));
    setStage("requirements");
  }

  function simulatePayment() {
    setStage("paying");
    window.setTimeout(() => setStage("paid"), 1400);
  }

  function selectLogo(file: File | undefined) {
    if (!file) return;
    if (logoFile) URL.revokeObjectURL(logoFile.url);
    setLogoFile({ name: file.name, url: URL.createObjectURL(file) });
    setQuote((current) => ({ ...current, logo: true }));
  }

  function removeLogo() {
    if (logoFile) URL.revokeObjectURL(logoFile.url);
    setLogoFile(null);
    setQuote((current) => ({ ...current, logo: false }));
  }

  return (
    <div className="agent-layer" role="dialog" aria-modal="true" aria-label="LOOMON commerce agent">
      <button className="agent-scrim" onClick={onClose} aria-label="Close agent" />
      <aside className="agent-panel">
        <header className="agent-header">
          <div className="agent-title"><span className="agent-spark"><Sparkles size={17} /></span><div><strong>Maker Agent</strong><small>Discovery to deposit</small></div></div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close agent"><X size={22} /></button>
        </header>

        {stage === "discover" ? (
          <div className="agent-body">
            <p className="agent-message">Tell me the occasion, quantity, budget or deadline. I’ll only show pieces that can realistically fit.</p>
            <label className="agent-composer">
              <span className="sr-only">What are you looking for?</span>
              <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={4} />
              <button onClick={runSearch} type="button" aria-label="Search products"><Send size={18} /></button>
            </label>
            {recommendations.length > 0 ? (
              <div className="agent-results">
                <p className="bracket-label">{`{ 3 feasible matches }`}</p>
                {recommendations.map((product) => (
                  <button className="agent-result" onClick={() => chooseProduct(product)} type="button" key={product.id}>
                    <span className={`result-dot accent-bg-${product.accent}`} />
                    <span><strong>{product.title}</strong><small>MOQ {product.minimumOrderQuantity} · {product.leadTimeMinDays}–{product.leadTimeMaxDays} days</small></span>
                    <em>{formatMoney(product.priceFrom)}</em>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {stage === "requirements" && selectedProduct ? (
          <div className="agent-body quote-requirements">
            <button className="back-link" onClick={() => setStage("discover")} type="button"><ArrowLeft size={16} /> Back to search</button>
            <div className="quote-heading"><p className="bracket-label">{`{ Quote requirements }`}</p><h2>{selectedProduct.title}</h2><p className="muted-copy">Confirm the order details. The agent will prepare everything for the maker.</p></div>
            <div className="form-grid">
              <label><span>Quantity</span><input type="number" min={selectedProduct.minimumOrderQuantity} value={quote.quantity} onChange={(event) => setQuote({ ...quote, quantity: Number(event.target.value) })} /></label>
              <label><span>Finish</span><select value={quote.finish} onChange={(event) => setQuote({ ...quote, finish: event.target.value })}>{selectedProduct.finishes.map((finish) => <option key={finish}>{finish}</option>)}</select></label>
              <label><span>Required by</span><input type="date" value={quote.deadline} onChange={(event) => setQuote({ ...quote, deadline: event.target.value })} /></label>
              <div className="quote-logo field-wide">
                <div className="quote-field-heading"><span>Custom logo</span><small>PNG, JPG or SVG · maximum 5 MB</small></div>
                {logoFile ? (
                  <div className="quote-logo-file">
                    <span className="quote-logo-preview"><Image src={logoFile.url} alt="Uploaded custom logo" width={64} height={64} unoptimized /></span>
                    <span><strong>{logoFile.name}</strong><small>Ready for the maker</small></span>
                    <button type="button" onClick={removeLogo} aria-label="Remove custom logo"><Trash2 size={17} /></button>
                  </div>
                ) : (
                  <label className="quote-logo-upload">
                    <span><UploadCloud size={21} /></span>
                    <span><strong>Upload your logo</strong><small>We’ll place it on the product mockup.</small></span>
                    <em>Choose file</em>
                    <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={(event) => selectLogo(event.target.files?.[0])} />
                  </label>
                )}
              </div>
              <label className="field-wide"><span>Notes for the maker</span><textarea value={quote.note} onChange={(event) => setQuote({ ...quote, note: event.target.value })} placeholder="Packaging, message card, delivery context…" rows={3} /></label>
            </div>
            <div className="quote-preview"><span><small>Estimated order</small><strong>{quote.quantity} pieces</strong></span><strong>{formatMoney(estimate)}</strong><small>Starting estimate · maker confirms the final quote before payment</small></div>
            <button className="gradient-stroke-button full-width" type="button" onClick={() => setStage("invoice")}>Prepare deposit invoice</button>
          </div>
        ) : null}

        {stage === "invoice" && selectedProduct ? (
          <div className="agent-body">
            <button className="back-link" onClick={() => setStage("requirements")} type="button"><ArrowLeft size={16} /> Edit requirements</button>
            <p className="bracket-label">{`{ Deposit invoice }`}</p>
            <h2>{formatMoney(deposit)}</h2>
            <p className="muted-copy">40% deposit to reserve the maker’s production window.</p>
            <dl className="invoice-lines">
              <div><dt>Piece</dt><dd>{selectedProduct.title}</dd></div>
              <div><dt>Quantity</dt><dd>{quote.quantity}</dd></div>
              <div><dt>Finish</dt><dd>{quote.finish}</dd></div>
              <div><dt>Logo</dt><dd>{logoFile ? logoFile.name : quote.logo ? "Requested" : "No"}</dd></div>
              <div><dt>Estimated total</dt><dd>{formatMoney(estimate)}</dd></div>
              <div className="invoice-total"><dt>Deposit due</dt><dd>{formatMoney(deposit)}</dd></div>
            </dl>
            <div className="wallet-summary"><WalletCards size={20} /><span><strong>Arc Wallet</strong><small>684.20 USDC · network fee sponsored</small></span><button type="button">Change</button></div>
            <button className="gradient-stroke-button full-width" type="button" onClick={simulatePayment}>Confirm {formatMoney(deposit)} deposit</button>
            <p className="wallet-note">Demo payment adapter. Architecture is ready for a direct Arc USDC transfer without a custom contract.</p>
          </div>
        ) : null}

        {stage === "paying" ? (
          <div className="agent-state"><span className="payment-loader" /><p className="bracket-label">{`{ Arc Testnet }`}</p><h2>Confirming your deposit.</h2><p>Arc finalizes included transactions in a single confirmation.</p></div>
        ) : null}

        {stage === "paid" && selectedProduct ? (
          <div className="agent-state agent-state--paid"><span className="success-mark"><Check size={34} /></span><p className="bracket-label">{`{ Deposit confirmed }`}</p><h2>Your production window is held.</h2><p>{selectedProduct.makerName} will review the final details. I’ll remind both sides about the next action.</p><div className="paid-actions"><Link href="/app/orders/demo-order" className="gradient-stroke-button">View order</Link><a className="ghost-button" href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">ArcScan <ExternalLink size={15} /></a></div></div>
        ) : null}
      </aside>
    </div>
  );
}
