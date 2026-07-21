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
  { slug: "lam-xuong", name: "Lam Xưởng", initials: "LX", province: "Huế", accent: "blue", story: "A porcelain workshop preserving Huế painting traditions through contemporary forms, careful production planning and direct custom collaboration.", specialties: ["Painted porcelain", "Tea ware", "Custom motifs"], orders: 126, rating: 4.9, reviews: 84, onTimeRate: 98, responseTime: "Within 2 hours" },
  { slug: "lo-may", name: "Lò Mây", initials: "LM", province: "Bát Tràng", accent: "green", story: "A small kiln studio making quiet stoneware forms in measured batches for homes, dining and thoughtful gifts.", specialties: ["Stoneware", "Celadon", "Small-batch gifts"], orders: 94, rating: 4.8, reviews: 61, onTimeRate: 97, responseTime: "Within 3 hours" },
  { slug: "dat-studio", name: "Đất Studio", initials: "ĐS", province: "Hội An", accent: "orange", story: "Functional pottery shaped around warm mineral surfaces and the everyday Vietnamese table.", specialties: ["Tableware", "Speckled clay", "Hospitality"], orders: 78, rating: 4.8, reviews: 52, onTimeRate: 96, responseTime: "Within 4 hours" },
  { slug: "nang-gom", name: "Nắng Gốm", initials: "NG", province: "Bình Dương", accent: "orange", story: "Honest terracotta and smoke-fired objects made with local clay and a strong sense of place.", specialties: ["Terracotta", "Decor", "Custom dimensions"], orders: 65, rating: 4.7, reviews: 39, onTimeRate: 95, responseTime: "Within 5 hours" },
  { slug: "moc-nhien", name: "Mộc Nhiên", initials: "MN", province: "Đà Lạt", accent: "lilac", story: "A mountain studio making tactile small-batch ceramics with ash glaze and restrained natural color.", specialties: ["Small ceramics", "Ash glaze", "Custom gifts"], orders: 88, rating: 4.9, reviews: 57, onTimeRate: 98, responseTime: "Within 3 hours" },
  { slug: "tre-may-collective", name: "Tre Mây Collective", initials: "TM", province: "Hà Nội", accent: "pink", story: "A family-led collective connecting rattan weaving, linen finishing and contemporary gift presentation.", specialties: ["Rattan", "Gift boxes", "Corporate gifts"], orders: 112, rating: 4.8, reviews: 73, onTimeRate: 97, responseTime: "Within 2 hours" },
];

export function makerSlug(name: string) {
  return stores.find((store) => store.name === name)?.slug ?? name.toLowerCase().replace(/\s+/g, "-");
}

export function getStoreBySlug(slug: string) {
  return stores.find((store) => store.slug === slug);
}

export function getStoreProducts(name: string) {
  return products.filter((product) => product.makerName === name);
}
