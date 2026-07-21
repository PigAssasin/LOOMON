import { describe, expect, it } from "vitest";
import { products } from "@/src/data/products";
import { recommendProducts } from "@/src/lib/recommend-products";

describe("recommendProducts", () => {
  it("uses normalized commercial product attributes", () => {
    const matches = recommendProducts(products, "qua tang doanh nghiep co logo", 3);
    expect(matches).toHaveLength(3);
    expect(matches.some((product) => product.customizationCapabilities.some((capability) => capability.toLowerCase().includes("logo")))).toBe(true);
  });
});
