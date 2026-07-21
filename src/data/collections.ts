import type { ProductCollection } from "@/src/domain/collection";

export const productCollections: ProductCollection[] = [
  {
    id: "hue",
    title: "Huế Collection",
    image: "/images/collection-hue.png",
    productSlugs: [
      "blue-lotus-teapot",
      "lotus-indigo-plate",
      "heritage-tea-service",
      "indigo-desk-cup",
      "lotus-sharing-platter",
      "blue-leaf-breakfast-set",
    ],
  },
  {
    id: "cups",
    title: "Cup Collection",
    image: "/images/collection-cups.png",
    productSlugs: [
      "celadon-tea-cups",
      "indigo-desk-cup",
      "orchard-sake-cups",
      "celadon-tea-pair",
      "ash-glaze-flower-cup",
    ],
  },
];
