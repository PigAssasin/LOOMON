import type { Product } from "@/src/domain/product";
import { cn } from "@/src/lib/cn";

const positionMap = {
  "top-left": "0% 0%",
  "top-right": "100% 0%",
  "bottom-left": "0% 100%",
  "bottom-right": "100% 100%",
} as const;

export function ProductVisual({ product, className }: { product: Product; className?: string }) {
  return (
    <div
      className={cn("product-visual", `product-visual--${product.aspect}`, className)}
      role="img"
      aria-label={`${product.title}, crafted by ${product.makerName}`}
      style={{
        backgroundImage: `url(/images/catalog-sheet-${product.imageSource}.png)`,
        backgroundPosition: positionMap[product.imagePosition],
      }}
    />
  );
}
