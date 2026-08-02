import type { ProductCollection } from "@/src/domain/collection";

export const productCollections: ProductCollection[] = [
  {
    id: "bat-trang-tea",
    title: "Bát Tràng Tea Collection",
    image: "/images/collection-hue.png",
    productSlugs: [
      "blue-lotus-teapot",
      "heritage-tea-service",
      "celadon-tea-cups",
      "blue-leaf-breakfast-set",
      "celadon-tea-cups",
      "lotus-indigo-plate",
    ],
  },
  {
    id: "ceramic-table",
    title: "Ceramic Table Collection",
    image: "/images/collection-cups.png",
    productSlugs: [
      "river-speckle-serving-bowl",
      "lotus-sharing-platter",
      "morning-rice-bowl-set",
      "petal-snack-plate",
      "terra-field-vase",
    ],
  },
];
