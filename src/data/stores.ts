import { products } from "@/src/data/products";

export type StoreProfile = {
  slug: string;
  name: string;
  initials: string;
  province: string;
  accent: "green" | "orange" | "pink" | "lilac" | "blue";
  story: string;
  specialties: string[];
  orders: number;
  rating: number;
  reviews: number;
  onTimeRate: number;
  responseTime: string;
};

export const stores: StoreProfile[] = [
  {
    slug: "lo-may",
    name: "Lò Mây",
    initials: "LM",
    province: "Bát Tràng",
    accent: "green",
    story:
      "A small Vietnamese ceramic studio focused on custom tea ware, tableware and keepsake objects. LOOMON uses this single shop for the Arc demo so buyer, seller, escrow and proof NFT flows are easy to understand.",
    specialties: ["Ceramic tea ware", "Custom porcelain", "Proof-backed demo orders"],
    orders: 94,
    rating: 4.8,
    reviews: 61,
    onTimeRate: 97,
    responseTime: "Within 3 hours",
  },
];

export function makerSlug(name: string) {
  return stores.find((store) => store.name === name)?.slug ?? "lo-may";
}

export function getStoreBySlug(slug: string) {
  return stores.find((store) => store.slug === slug);
}

export function getStoreProducts(name: string) {
  return products.filter((product) => product.makerName === name);
}
