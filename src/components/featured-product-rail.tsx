import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { products } from "@/src/data/products";
import { ProductVisual } from "@/src/components/product-visual";
import { formatMoney } from "@/src/lib/money";

const featuredProducts = products;

export function FeaturedProductRail() {
  return (
    <section className="featured-rail" aria-label="Featured products">
      <div className="featured-rail-label"><span>Featured</span><i /></div>
      <div className="featured-rail-viewport">
        <div className="featured-rail-track">
          <FeaturedGroup />
          <FeaturedGroup duplicate />
        </div>
      </div>
    </section>
  );
}

function FeaturedGroup({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <div className="featured-rail-group" aria-hidden={duplicate || undefined}>
      {featuredProducts.map((product) => (
        <Link className="featured-product" href={`/app/products/${product.slug}`} key={`${duplicate ? "copy" : "main"}-${product.id}`} tabIndex={duplicate ? -1 : undefined}>
          <ProductVisual product={product} />
          <div className="featured-product-copy"><span>Featured</span><strong>{product.title}</strong><small>{formatMoney(product.priceFrom)} <ArrowUpRight size={13} /></small></div>
        </Link>
      ))}
    </div>
  );
}
