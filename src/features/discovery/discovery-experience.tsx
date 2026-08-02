"use client";

import Link from "next/link";
import { ArrowUpRight, Check, Clock3, MapPin, Package2, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, X } from "lucide-react";
import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAgent } from "@/src/features/agent/agent-provider";
import { CollectionCard } from "@/src/components/collection-card";
import { ProductCard } from "@/src/components/product-card";
import { SiteHeader } from "@/src/components/site-header";
import { ProductVisual } from "@/src/components/product-visual";
import { productCollections } from "@/src/data/collections";
import { categories, products } from "@/src/data/products";
import { getStoreBySlug, makerSlug } from "@/src/data/stores";
import type { ProductCollection } from "@/src/domain/collection";
import type { Product } from "@/src/domain/product";
import { formatMoney } from "@/src/lib/money";

type ProductFocus = { product: Product; origin: DOMRect };

const hotSearches = [
  { label: "All", query: "" },
  { label: "Celadon", query: "celadon" },
  { label: "Blue & white", query: "blue white lotus" },
  { label: "Coasters", query: "coaster" },
  { label: "Tea service", query: "tea service" },
  { label: "Cups", query: "cups" },
  { label: "Bowls", query: "bowl" },
  { label: "Tableware", query: "tableware" },
  { label: "Custom logo", query: "logo" },
  { label: "Souvenirs", query: "souvenir" },
] as const;

const sortOptions = [
  { value: "recommended", label: "Recommended", detail: "Best match first" },
  { value: "price-low", label: "Price: low to high", detail: "Lowest unit price first" },
  { value: "price-high", label: "Price: high to low", detail: "Highest unit price first" },
] as const;

export function DiscoveryExperience() {
  const { openAgent } = useAgent();
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<"recommended" | "price-low" | "price-high">("recommended");
  const [focus, setFocus] = useState<ProductFocus | null>(null);
  const [activeHotSearch, setActiveHotSearch] = useState("All");
  const [activeCollection, setActiveCollection] = useState<ProductCollection | null>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    if (!filtersOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setFiltersOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [filtersOpen]);

  const filtered = useMemo(() => {
    const needle = activeCollection ? "" : deferredSearch.trim().toLowerCase();
    const matches = products.filter((product) => {
      const matchesCategory = category === "All" || product.category === category;
      const matchesCollection = !activeCollection || activeCollection.productSlugs.includes(product.slug);
      const matchesText = !needle || [product.title, product.makerName, product.province, ...product.materials, ...product.occasions].join(" ").toLowerCase().includes(needle);
      return matchesCategory && matchesCollection && matchesText;
    });
    if (sort === "price-low") return matches.toSorted((a, b) => a.priceFrom - b.priceFrom);
    if (sort === "price-high") return matches.toSorted((a, b) => b.priceFrom - a.priceFrom);
    return matches;
  }, [activeCollection, category, deferredSearch, sort]);

  const showCollections = !activeCollection && !deferredSearch.trim() && category === "All" && sort === "recommended";
  const selectCollection = (collection: ProductCollection) => {
    setActiveCollection(collection);
    setCategory("All");
    setSearch(collection.title);
    setActiveHotSearch("");
  };

  return (
    <main>
      <SiteHeader>
        <div className="discovery-search-header">
          <div className="discovery-search-box"><Search size={20} /><input aria-label="Search the marketplace" value={search} onChange={(event) => { setActiveCollection(null); setSearch(event.target.value); setActiveHotSearch(""); }} placeholder="Search products, makers, materials…" />{search ? <button type="button" onClick={() => { setActiveCollection(null); setSearch(""); setActiveHotSearch("All"); }} aria-label="Clear search"><X size={18} /></button> : null}<button className={category !== "All" || sort !== "recommended" || activeCollection ? "discovery-search-filter active" : "discovery-search-filter"} type="button" onClick={() => setFiltersOpen(true)} aria-label="Filter and sort products"><SlidersHorizontal size={20} /></button></div>
          <nav className="discovery-hot-searches" aria-label="Popular searches">{hotSearches.map((item) => <button className={activeHotSearch === item.label ? "active" : ""} key={item.label} type="button" onClick={() => { setActiveCollection(null); setCategory("All"); setSearch(item.query); setActiveHotSearch(item.label); }}>{item.label}</button>)}</nav>
        </div>
      </SiteHeader>
      <section className="discovery-section" id="discover">
        <h1 className="sr-only">Discover Vietnamese craft</h1>
        {filtersOpen ? <div className="catalog-filter-layer">
          <button className="catalog-filter-backdrop" type="button" onClick={() => setFiltersOpen(false)} aria-label="Close product filters" />
          <aside className="catalog-filter-drawer" role="dialog" aria-modal="true" aria-label="Product filters">
            <header className="catalog-filter-header"><div><strong>Filter & sort</strong><span>{filtered.length} pieces available</span></div><button className="catalog-filter-close" type="button" onClick={() => setFiltersOpen(false)} aria-label="Close product filters"><X size={21} /></button></header>

            <div className="catalog-filter-body">
              <section className="catalog-filter-group" aria-labelledby="filter-category-title">
                <div className="catalog-filter-group-title"><h2 id="filter-category-title">Category</h2><span>Choose one</span></div>
                <div className="catalog-filter-list" role="radiogroup" aria-label="Product categories">
                  {categories.map((item) => {
                    const count = item === "All" ? products.length : products.filter((product) => product.category === item).length;
                    return <button className={category === item ? "active" : ""} onClick={() => { setActiveCollection(null); setSearch(""); setCategory(item); }} role="radio" aria-checked={category === item} key={item} type="button"><span><strong>{item}</strong><small>{count} pieces</small></span><i>{category === item ? <Check size={16} /> : null}</i></button>;
                  })}
                </div>
              </section>

              <section className="catalog-filter-group" aria-labelledby="filter-sort-title">
                <div className="catalog-filter-group-title"><h2 id="filter-sort-title">Sort by</h2><span>Set the order</span></div>
                <div className="catalog-filter-list" role="radiogroup" aria-label="Sort products">
                  {sortOptions.map((item) => <button className={sort === item.value ? "active" : ""} onClick={() => setSort(item.value)} role="radio" aria-checked={sort === item.value} key={item.value} type="button"><span><strong>{item.label}</strong><small>{item.detail}</small></span><i>{sort === item.value ? <Check size={16} /> : null}</i></button>)}
                </div>
              </section>
            </div>

            <footer className="catalog-filter-footer"><button type="button" onClick={() => { setActiveCollection(null); setSearch(""); setCategory("All"); setSort("recommended"); }}>Reset</button><button className="gradient-stroke-button" type="button" onClick={() => setFiltersOpen(false)}>Show {filtered.length} pieces</button></footer>
          </aside>
        </div> : null}
        <div className="masonry-feed visual-wall">
          {filtered.map((product, index) => <Fragment key={product.id}>
            <ProductCard product={product} index={index} onSelect={(selected, origin) => setFocus({ product: selected, origin })} />
            {showCollections && index === 1 ? <CollectionCard collection={productCollections[0]} onSelect={selectCollection} /> : null}
            {showCollections && index === 7 ? <CollectionCard collection={productCollections[1]} onSelect={selectCollection} /> : null}
          </Fragment>)}
        </div>
        {filtered.length === 0 ? <div className="empty-state"><h3>No exact piece yet.</h3><p>Ask the agent to widen the search without losing your commercial constraints.</p><button className="ghost-button" onClick={() => openAgent({ goal: `Find alternatives for “${search || category}” without losing my requirements.`, contextLabel: "Marketplace search" })} type="button">Ask the agent</button></div> : null}
      </section>

      {focus ? <ProductFocusView focus={focus} onClose={() => setFocus(null)} /> : null}
    </main>
  );
}

function ProductFocusView({ focus, onClose }: { focus: ProductFocus; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const product = focus.product;
  const seller = getStoreBySlug(makerSlug(product.makerName));
  const scaleX = focus.origin.width / window.innerWidth;
  const scaleY = focus.origin.height / window.innerHeight;
  const close = useCallback(() => {
    setExpanded(false);
    window.setTimeout(onClose, 460);
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => setExpanded(true));
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close]);

  return (
    <div className={expanded ? "product-focus-layer is-expanded" : "product-focus-layer"} role="dialog" aria-modal="true" aria-label={`${product.title} quick view`}>
      <button className="product-focus-backdrop" type="button" onClick={close} aria-label="Close product preview" />
      <article className="product-focus-shell" style={{ "--focus-x": `${focus.origin.left}px`, "--focus-y": `${focus.origin.top}px`, "--focus-scale-x": scaleX, "--focus-scale-y": scaleY } as React.CSSProperties}>
        <button className="product-focus-close" type="button" onClick={close} aria-label="Close product preview"><X size={22} /></button>
        <ProductVisual product={product} className="product-focus-visual" />
        <div className="product-focus-content">
          <div className="product-focus-heading">
            <div><span className="product-focus-context">{product.category} · {product.province}</span><Link href={`/app/stores/${makerSlug(product.makerName)}`}>{product.makerName} <ArrowUpRight size={15} /></Link><h2>{product.title}</h2><p>{product.story}</p></div>
            <div className="product-focus-price"><small>From</small><strong>{formatMoney(product.priceFrom)}</strong><span>per piece</span></div>
          </div>
          <div className="product-focus-facts">
            <span><Package2 size={18} /><small>Order size</small><strong>From 1 piece</strong></span>
            <span><Clock3 size={18} /><small>Lead time</small><strong>{product.leadTimeMinDays}–{product.leadTimeMaxDays} days</strong></span>
            <span><small>Material</small><strong>{product.materials.join(", ")}</strong></span>
            <span><small>Finish</small><strong>{product.finishes.join(", ")}</strong></span>
          </div>
          <dl className="product-focus-specs">
            <div><dt>Suitable for</dt><dd>{product.occasions.join(", ")}</dd></div>
            <div><dt>Custom options</dt><dd>{product.customizable ? product.customizationCapabilities.join(", ") : "Made as shown"}</dd></div>
            <div><dt>Payment</dt><dd>USDC on Arc · Agent-assisted order milestones</dd></div>
          </dl>
          {seller ? <section className="product-focus-seller"><div className={`product-focus-seller-avatar accent-bg-${seller.accent}`}>{seller.initials}</div><div className="product-focus-seller-copy"><span><ShieldCheck size={15} /> Verified workshop</span><h3><Link href={`/app/stores/${seller.slug}`}>{seller.name} <ArrowUpRight size={17} /></Link></h3><p>{seller.story}</p><div><span><MapPin size={15} /> {seller.province}</span><span><Star size={15} fill="currentColor" /> {seller.rating} · {seller.reviews} reviews</span><span><Check size={15} /> {seller.onTimeRate}% on-time</span></div></div></section> : null}
          <div className="product-focus-actions">
            <Link className="gradient-stroke-button" href={`/app/products/${product.slug}?customize=1`}><Sparkles size={17} /> Customize with agent</Link>
          </div>
        </div>
      </article>
    </div>
  );
}
