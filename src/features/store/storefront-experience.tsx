"use client";

import { Check, Clock3, Heart, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import type { StoreProfile } from "@/src/data/stores";
import { getStoreProducts } from "@/src/data/stores";
import { ProductCard } from "@/src/components/product-card";
import { SiteHeader } from "@/src/components/site-header";
import { useAgent } from "@/src/features/agent/agent-provider";
import { useFollowedStores } from "@/src/hooks/use-followed-stores";
import { useLoomonSession } from "@/src/features/auth/use-loomon-session";

export function StorefrontExperience({ store }: { store: StoreProfile }) {
  const { openAgent } = useAgent();
  const { followed, toggleFollow } = useFollowedStores();
  const session = useLoomonSession();
  const storeProducts = getStoreProducts(store.name);
  const isFollowing = followed.includes(store.slug);

  return (
    <main>
      <div className="static-header-wrap"><SiteHeader /></div>
      <section className="storefront">
        <header className="storefront-hero">
          <div className={`storefront-avatar accent-bg-${store.accent}`}>{store.initials}</div>
          <div className="storefront-title">
            <p><ShieldCheck size={16} /> Verified workshop</p>
            <h1>{store.name}</h1>
            <div><span><MapPin size={15} /> {store.province}</span><span><Clock3 size={15} /> {store.responseTime}</span></div>
          </div>
          <div className="storefront-actions">
            <button className={isFollowing ? "ghost-button following" : "gradient-stroke-button"} type="button" onClick={async () => { if (await session.ensureSession()) await toggleFollow(store.slug); }}>{isFollowing ? <Check size={18} /> : <Heart size={18} />}{isFollowing ? "Following" : "Follow store"}</button>
            <button className="storefront-agent-button" type="button" onClick={() => openAgent({ goal: `Review ${store.name}, compare their products and help me prepare an order.`, contextLabel: store.name })}><Sparkles size={18} /> Ask the agent</button>
          </div>
        </header>

        <div className="storefront-overview">
          <p>{store.story}</p>
          <dl>
            <div><dt>Published pieces</dt><dd>{storeProducts.length}</dd></div>
            <div><dt>Order history</dt><dd>Private</dd></div>
            <div><dt>Buyer rating</dt><dd>Not available</dd></div>
            <div><dt>Reviews</dt><dd>0</dd></div>
          </dl>
        </div>

        <section className="storefront-products">
          <header><div><h2>Made by {store.name}</h2><p>{storeProducts.length} pieces available</p></div><span>{store.specialties.join(" · ")}</span></header>
          <div className="store-product-grid">{storeProducts.map((product) => <ProductCard product={product} key={product.id} />)}</div>
        </section>

        <section className="storefront-reviews storefront-reviews--empty">
          <header><div><strong>Reviews</strong><span>Verified reviews will appear after real completed orders.</span></div><h2>No buyer reviews yet.</h2></header>
        </section>
      </section>
    </main>
  );
}
