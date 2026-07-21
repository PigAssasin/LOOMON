import { describe, expect, it } from "vitest";
import { productDraftSchema } from "@/src/domain/product-draft";

const validDraft = {
  title: "Celadon Tea Cups",
  category: "Tea" as const,
  story: "Hand-thrown cups fired in small batches by a verified ceramic studio.",
  material: "Stoneware",
  finish: "Celadon",
  priceFrom: 12,
  minimumOrderQuantity: 20,
  leadTimeMinDays: 14,
  leadTimeMaxDays: 24,
  customizable: true,
  customizationCapabilities: ["Logo decal"],
};

describe("productDraftSchema", () => {
  it("accepts normalized seller data", () => expect(productDraftSchema.safeParse(validDraft).success).toBe(true));
  it("rejects an inverted lead-time range", () => {
    expect(productDraftSchema.safeParse({ ...validDraft, leadTimeMaxDays: 5 }).success).toBe(false);
  });
});
