import type { Product, ProductCategory, ProductImagePosition, ProductImageSource } from "@/src/domain/product";

type Seed = Omit<Product, "id" | "versionId" | "currency" | "imageSource" | "imagePosition">;

const imageCycle: Array<[ProductImageSource, ProductImagePosition]> = [
  ["loomon-demo", "top-left"],
  ["loomon-demo", "top-right"],
  ["loomon-demo", "bottom-left"],
  ["loomon-demo", "bottom-right"],
];

const catalog: Seed[] = [
  {
    slug: "celadon-tea-cups",
    title: "Celadon Tea Cups",
    category: "Drinkware",
    makerName: "Lò Mây",
    province: "Bát Tràng",
    priceFrom: 3,
    minimumOrderQuantity: 1,
    leadTimeMinDays: 10,
    leadTimeMaxDays: 18,
    customizable: true,
    materials: ["Stoneware"],
    finishes: ["Celadon crackle glaze"],
    occasions: ["Tea gift", "Wedding favor", "Corporate souvenir"],
    customizationCapabilities: ["2D logo print", "Raised 3D mark", "Name personalization"],
    story: "A pair of calm celadon cups for names, logos and small symbols — simple enough for daily use, personal enough to keep.",
    aspect: "portrait",
    accent: "green",
  },
  {
    slug: "blue-lotus-tea-set",
    title: "Blue Lotus Tea Set",
    category: "Tea",
    makerName: "Lò Mây",
    province: "Bát Tràng",
    priceFrom: 7,
    minimumOrderQuantity: 1,
    leadTimeMinDays: 14,
    leadTimeMaxDays: 24,
    customizable: true,
    materials: ["Porcelain"],
    finishes: ["Cobalt lotus underglaze"],
    occasions: ["VIP gift", "Tea ceremony", "Family keepsake"],
    customizationCapabilities: ["Monogram", "Custom motif", "Gift message"],
    story: "A blue-and-white tea set inspired by Vietnamese porcelain, made for a personal mark across pot and cups.",
    aspect: "landscape",
    accent: "blue",
  },
  {
    slug: "speckled-rice-bowl",
    title: "Speckled Rice Bowl",
    category: "Tableware",
    makerName: "Lò Mây",
    province: "Bát Tràng",
    priceFrom: 4,
    minimumOrderQuantity: 1,
    leadTimeMinDays: 10,
    leadTimeMaxDays: 18,
    customizable: true,
    materials: ["Speckled stoneware"],
    finishes: ["Satin ash glaze"],
    occasions: ["Housewarming", "Restaurant gift", "Daily table"],
    customizationCapabilities: ["Bottom logo", "Rim text", "Subtle 3D stamp"],
    story: "A warm stoneware bowl with a quiet handmade surface, designed for small marks, dates and meaningful inscriptions.",
    aspect: "square",
    accent: "green",
  },
  {
    slug: "lotus-cup-coasters",
    title: "Lotus Cup Coasters",
    category: "Tableware",
    makerName: "Lò Mây",
    province: "Bát Tràng",
    priceFrom: 2,
    minimumOrderQuantity: 1,
    leadTimeMinDays: 7,
    leadTimeMaxDays: 14,
    customizable: true,
    materials: ["Glazed ceramic"],
    finishes: ["Celadon and indigo lotus glaze"],
    occasions: ["Cafe souvenir", "Event gift", "Desk keepsake"],
    customizationCapabilities: ["2D logo print", "Raised 3D motif", "Full-surface artwork"],
    story: "Small ceramic coasters that turn a logo, event mark or illustrated symbol into an affordable collectible souvenir.",
    aspect: "square",
    accent: "blue",
  },
];

export const products: Product[] = catalog.map((seed, index) => ({
  ...seed,
  id: `product-${String(index + 1).padStart(2, "0")}`,
  versionId: `product-version-${String(index + 1).padStart(2, "0")}-v1`,
  currency: "USDC",
  imageSource: imageCycle[index % imageCycle.length][0],
  imagePosition: imageCycle[index % imageCycle.length][1],
}));

export const categories: Array<"All" | ProductCategory> = [
  "All",
  "Drinkware",
  "Tableware",
  "Tea",
];

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}
