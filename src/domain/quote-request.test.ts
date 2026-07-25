import { describe, expect, it } from "vitest";
import {
  buildCustomizationAssetPath,
  isApprovedCustomizationBrief,
  quoteSubmissionResultSchema,
  sanitizeCustomizationFileName,
} from "@/src/domain/quote-request";
import type { CustomizationSession } from "@/src/features/customization/customization-storage";

const approvedBrief: CustomizationSession = {
  schemaVersion: 4,
  productSlug: "celadon-tea-cups",
  mode: "brief",
  intent: "text_only",
  status: "ready",
  notes: "Write LOOMON near the base.",
  previews: [],
  renderDemo: false,
  submittedAt: 1,
  updatedAt: 1,
};

describe("quote request domain", () => {
  it("accepts only a submitted brief", () => {
    expect(isApprovedCustomizationBrief(approvedBrief)).toBe(true);
    expect(isApprovedCustomizationBrief({ ...approvedBrief, mode: "choose" })).toBe(false);
    expect(isApprovedCustomizationBrief({ ...approvedBrief, submittedAt: undefined })).toBe(false);
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
