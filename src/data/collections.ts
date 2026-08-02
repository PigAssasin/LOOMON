import type { ProductCollection } from "@/src/domain/collection";

export const productCollections: ProductCollection[] = [
  {
    id: "bat-trang-tea",
    title: "Bát Tràng Tea Set",
    image: "/images/catalog-sheet-loomon-teaware.png",
    productSlugs: [
      "blue-lotus-tea-set",
      "lotus-gaiwan-cup",
      "celadon-fairness-pitcher",
      "celadon-tasting-cups",
      "blue-rim-lotus-cups",
    ],
  },
  {
    id: "daily-ceramic-table",
    title: "Daily Ceramic Table",
    image: "/images/catalog-sheet-loomon-bowls.png",
    productSlugs: [
      "speckled-rice-bowl",
      "nested-ash-rice-bowls",
      "celadon-noodle-bowl",
      "lotus-dipping-bowls",
      "indigo-rim-serving-bowl",
      "lotus-cup-coasters",
    ],
  },
];
