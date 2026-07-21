import type { Product } from "@/src/domain/product";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function recommendProducts(products: Product[], query: string, limit = 3) {
  const tokens = normalize(query).split(/\s+/).filter((token) => token.length > 2);
  return products
    .map((product) => {
      const haystack = normalize([
        product.title,
        product.category,
        product.makerName,
        product.province,
        ...product.occasions,
        ...product.materials,
        ...product.finishes,
        ...product.customizationCapabilities,
      ].join(" "));
      const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      return { product, score };
    })
    .toSorted((a, b) => b.score - a.score || a.product.priceFrom - b.product.priceFrom)
    .slice(0, limit)
    .map(({ product }) => product);
}
