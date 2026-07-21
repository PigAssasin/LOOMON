"use client";

import { Check, Clock3, Heart, MapPin, MessageCircle, ShieldCheck, Sparkles, Star } from "lucide-react";
import { useState } from "react";
import type { StoreProfile } from "@/src/data/stores";
import { getStoreProducts } from "@/src/data/stores";
import { ProductCard } from "@/src/components/product-card";
import { SiteHeader } from "@/src/components/site-header";
import { AgentPanel } from "@/src/features/agent/agent-panel";
import { useFollowedStores } from "@/src/hooks/use-followed-stores";

const reviewCopy = [
  ["Mai Anh", "The pieces arrived exactly as approved, and the agent kept our team updated through every production milestone."],
  ["Daniel K.", "Beautiful cobalt work. Lead time and packaging were both accurate, which made a 60-piece client order easy."],
  ["Khánh Linh", "Lam Xưởng adapted our motif without losing the handmade quality we chose them for."],
];

export function StorefrontExperience({ store }: { store: StoreProfile }) {
  const [agentOpen, setAgentOpen] = useState(false);
  const { followed, toggleFollow } = useFollowedStores();
  const storeProducts = getStoreProducts(store.name);
  const isFollowing = followed.includes(store.slug);

  return (
    <main>
      <div className="static-header-wrap"><SiteHeader onOpenAgent={() => setAgentOpen(true)} /></div>
      <section className="storefront">
        <header className="storefront-hero">
          <div className={`storefront-avatar accent-bg-${store.accent}`}>{store.initials}</div>
          <div className="storefront-title">
            <p><ShieldCheck size={16} /> Verified workshop</p>
            <h1>{store.name}</h1>
            <div><span><MapPin size={15} /> {store.province}</span><span><Clock3 size={15} /> {store.responseTime}</span></div>
          </div>
          <div className="storefront-actions">
            <button className={isFollowing ? "ghost-button following" : "gradient-stroke-button"} type="button" onClick={() => toggleFollow(store.slug)}>{isFollowing ? <Check size={18} /> : <Heart size={18} />}{isFollowing ? "Following" : "Follow store"}</button>
            <button className="storefront-agent-button" type="button" onClick={() => setAgentOpen(true)}><Sparkles size={18} /> Ask the agent</button>
          </div>
        </header>

        <div className="storefront-overview">
          <p>{store.story}</p>
          <dl>
            <div><dt>Orders fulfilled</dt><dd>{store.orders}</dd></div>
            <div><dt>Buyer rating</dt><dd>{store.rating}<Star size={17} fill="currentColor" /></dd></div>
            <div><dt>On-time</dt><dd>{store.onTimeRate}%</dd></div>
            <div><dt>Reviews</dt><dd>{store.reviews}</dd></div>
          </dl>
        </div>

        <section className="storefront-products">
          <header><div><h2>Made by {store.name}</h2><p>{storeProducts.length} pieces available</p></div><span>{store.specialties.join(" · ")}</span></header>
          <div className="store-product-grid">{storeProducts.map((product) => <ProductCard product={product} key={product.id} />)}</div>
        </section>

        <section className="storefront-reviews">
          <header><div><Star size={22} fill="currentColor" /><strong>{store.rating}</strong><span>from {store.reviews} verified orders</span></div><h2>Buyers return for the craft—and the reliability.</h2></header>
          <div>{reviewCopy.map(([name, copy]) => <article key={name}><MessageCircle size={19} /><p>“{copy}”</p><span>{name}<small>Verified buyer</small></span></article>)}</div>
        </section>
      </section>
      <AgentPanel open={agentOpen} onClose={() => setAgentOpen(false)} />
    </main>
  );
}
