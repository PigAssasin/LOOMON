"use client";

import Link from "next/link";
import { Check, Clock3, MapPin, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import type { Product } from "@/src/domain/product";
import { ProductVisual } from "@/src/components/product-visual";
import { SiteHeader } from "@/src/components/site-header";
import { useAgent } from "@/src/features/agent/agent-provider";
import { formatMoney } from "@/src/lib/money";
import { makerSlug } from "@/src/data/stores";
import { ProductCustomizationStudio } from "@/src/features/customization/product-customization-studio";

export function ProductDetailExperience({ product, initialCustomizing = false }: { product: Product; initialCustomizing?: boolean }) {
  const { openAgent } = useAgent();
  const [customizing, setCustomizing] = useState(initialCustomizing);
  const openCustomization = () => {
    setCustomizing(true);
    const url = new URL(window.location.href);
    url.searchParams.set("customize", "1");
    window.history.replaceState({}, "", url);
  };
  const closeCustomization = () => {
    setCustomizing(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("customize");
    window.history.replaceState({}, "", url);
  };

  return (
    <main>
      <div className="static-header-wrap"><SiteHeader /></div>
      <section className="product-detail">
        <div className="product-detail-media"><ProductVisual product={product} className="product-detail-visual" /></div>
        <div className="product-detail-copy">
          <p className="product-location">{product.category}<span />{product.province}</p>
          <h1>{product.title}</h1>
          <p className="product-story">{product.story}</p>

          <div className="purchase-panel">
            <div className="product-price"><span>From</span><strong>{formatMoney(product.priceFrom)}</strong><small>per piece</small></div>
            <button className="gradient-stroke-button full-width" onClick={openCustomization} type="button"><Sparkles size={18} /> Customize with agent</button>
            <dl className="product-facts">
              <div><dt><PackageCheck size={17} /> Minimum</dt><dd>{product.minimumOrderQuantity} pieces</dd></div>
              <div><dt><Clock3 size={17} /> Lead time</dt><dd>{product.leadTimeMinDays}–{product.leadTimeMaxDays} days</dd></div>
            </dl>
          </div>

          <dl className="product-specs">
            <div><dt>Material</dt><dd>{product.materials.join(", ")}</dd></div>
            <div><dt>Finish</dt><dd>{product.finishes.join(", ")}</dd></div>
            {product.customizable ? <div><dt>Custom options</dt><dd>{product.customizationCapabilities.join(", ")}</dd></div> : null}
          </dl>

          <SellerDetail product={product} onAsk={() => openAgent({ goal: `Tell me whether ${product.makerName} is the right maker for my order.`, contextLabel: product.makerName })} />
        </div>
      </section>
      <ProductCustomizationStudio
        product={product}
        open={customizing}
        onClose={closeCustomization}
      />
    </main>
  );
}

function SellerDetail({ product, onAsk }: { product: Product; onAsk: () => void }) {
  const initials = product.makerName.split(" ").map((part) => part[0]).join("").slice(0, 2);

  return (
    <section className="seller-detail">
      <header><span className={`seller-avatar accent-bg-${product.accent}`}>{initials}</span><div><h2><Link href={`/app/stores/${makerSlug(product.makerName)}`}>{product.makerName}</Link></h2><p><ShieldCheck size={15} /> Verified workshop</p></div></header>
      <p>A small independent workshop known for considered forms, reliable production data and direct collaboration on custom orders.</p>
      <dl><div><dt><MapPin size={16} /> Based in</dt><dd>{product.province}</dd></div><div><dt><Clock3 size={16} /> Usually replies</dt><dd>Within 2 hours</dd></div><div><dt><Check size={16} /> Specializes in</dt><dd>{product.materials.join(" · ")}</dd></div></dl>
      <button className="seller-agent-link" type="button" onClick={onAsk}><Sparkles size={17} /> Ask the agent about this seller</button>
    </section>
  );
}
