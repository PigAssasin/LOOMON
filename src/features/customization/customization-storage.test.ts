import { describe, expect, it } from "vitest";
import {
  createEmptyCustomizationSession,
  normalizeCustomizationSession,
  type CustomizationSession,
} from "@/src/features/customization/customization-storage";

describe("customization order draft", () => {
  it("starts with the product MOQ and optional date empty", () => {
    const draft = createEmptyCustomizationSession("celadon-tea-cups", 20);
    expect(draft.schemaVersion).toBe(6);
    expect(draft.quantity).toBe(20);
    expect(draft.requiredBy).toBe("");
    expect(draft.printText).toBe("");
  });

  it("upgrades a saved v4 brief without losing its approved preview", () => {
    const legacy = {
      schemaVersion: 4,
      productSlug: "celadon-tea-cups",
      mode: "brief",
      intent: "apply_artwork",
      status: "ready",
      notes: "Place near the base",
      previews: [{ label: "Preview 1", url: "data:image/png;base64,AA==" }],
      selectedPreview: "Preview 1",
      submittedAt: 123,
      renderDemo: false,
      updatedAt: 123,
    } as unknown as CustomizationSession;

    const upgraded = normalizeCustomizationSession("celadon-tea-cups", 20, legacy);
    expect(upgraded.schemaVersion).toBe(6);
    expect(upgraded.mode).toBe("choose");
    expect(upgraded.selectedPreview).toBe("Preview 1");
    expect(upgraded.quantity).toBe(20);
    expect(upgraded.requiredBy).toBe("");
  });

  it("never restores a quantity below the product MOQ", () => {
    const draft = {
      ...createEmptyCustomizationSession("celadon-tea-cups", 20),
      quantity: 1,
    };
    expect(normalizeCustomizationSession("celadon-tea-cups", 20, draft).quantity).toBe(20);
  });
});
