import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Product } from "@/src/domain/product";
import { formatMoney } from "@/src/lib/money";
import { ProductVisual } from "./product-visual";

export function ProductCard({ product, onSelect, index = 0 }: { product: Product; onSelect?: (product: Product, origin: DOMRect) => void; index?: number }) {
  const content = (
    <>
      <ProductVisual product={product} />
      <div className="product-card-overlay">
        <div>
          <p>{product.makerName}</p>
          <h3>{product.title}</h3>
          <span>{product.story}</span>
        </div>
        <div className="product-card-overlay-bottom"><strong>From {formatMoney(product.priceFrom)}</strong><ArrowUpRight size={20} /></div>
      </div>
    </>
  );

  return (
    <article className={`product-card product-card--pattern-${index % 8}`}>
      {onSelect ? (
        <button className="product-card-link" type="button" aria-label={`Preview ${product.title}`} onClick={(event) => onSelect(product, event.currentTarget.getBoundingClientRect())}>
          {content}
        </button>
      ) : (
        <Link href={`/app/products/${product.slug}`} className="product-card-link" aria-label={`View ${product.title}`}>{content}</Link>
      )}
    </article>
  );
}
