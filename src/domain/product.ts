export type ProductCategory =
  | "Drinkware"
  | "Tableware"
  | "Decor"
  | "Tea"
  | "Gifts";

export type ProductImageSource = "ceramics" | "gifts";
export type ProductImagePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface Product {
  id: string;
  versionId: string;
  slug: string;
  title: string;
  category: ProductCategory;
  makerName: string;
  province: string;
  priceFrom: number;
  currency: "USDC";
  minimumOrderQuantity: number;
  leadTimeMinDays: number;
  leadTimeMaxDays: number;
  customizable: boolean;
  materials: string[];
  finishes: string[];
  occasions: string[];
  customizationCapabilities: string[];
  story: string;
  imageSource: ProductImageSource;
  imagePosition: ProductImagePosition;
  aspect: "portrait" | "square" | "landscape";
  accent: "green" | "orange" | "pink" | "lilac" | "blue";
}
