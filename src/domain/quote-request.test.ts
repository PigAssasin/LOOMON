import { describe, expect, it } from "vitest";
import {
  buildCustomizationAssetPath,
  isApprovedCustomizationBrief,
  quoteSubmissionResultSchema,
  sanitizeCustomizationFileName,
} from "@/src/domain/quote-request";
import type { CustomizationSession } from "@/src/features/customization/customization-storage";

const approvedBrief: CustomizationSession = {
  schemaVersion: 6,
  productSlug: "celadon-tea-cups",
  mode: "choose",
  intent: "text_only",
  status: "ready",
  printText: "",
  notes: "Write LOOMON near the base.",
  quantity: 20,
  requiredBy: "",
  previews: [],
  renderDemo: false,
  submittedAt: 1,
  updatedAt: 1,
};

describe("quote request domain", () => {
  it("accepts an order sheet even when customization is optional", () => {
    expect(isApprovedCustomizationBrief(approvedBrief)).toBe(true);
    expect(isApprovedCustomizationBrief({ ...approvedBrief, notes: "" })).toBe(true);
    expect(
      isApprovedCustomizationBrief({ ...approvedBrief, quantity: 0 }),
    ).toBe(false);
  });

  it("builds an owner-scoped storage path", () => {
    expect(
      buildCustomizationAssetPath({
        userId: "11111111-1111-4111-8111-111111111111",
        requestKey: "22222222-2222-4222-8222-222222222222",
        fileName: "My Logo (Final).PNG",
      }),
    ).toBe(
      "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/my-logo-final-.png",
    );
  });

  it("uses a safe fallback file name", () => {
    expect(sanitizeCustomizationFileName("%%%")).toBe("customization.png");
  });

  it("validates the canonical RPC response", () => {
    expect(
      quoteSubmissionResultSchema.parse({
        quoteRequestId: "11111111-1111-4111-8111-111111111111",
        projectId: "22222222-2222-4222-8222-222222222222",
        projectReference: "LM-PJ-AB12CD34",
        threadId: "33333333-3333-4333-8333-333333333333",
        status: "submitted",
        idempotent: false,
      }),
    ).toMatchObject({ status: "submitted", idempotent: false });
  });
});
