import { describe, expect, it } from "vitest";
import {
  createEmptyCustomizationSession,
  normalizeCustomizationSession,
  type CustomizationSession,
} from "@/src/features/customization/customization-storage";

describe("customization order draft", () => {
  it("starts at one piece and optional date empty", () => {
    const draft = createEmptyCustomizationSession("celadon-tea-cups");
    expect(draft.schemaVersion).toBe(7);
    expect(draft.quantity).toBe(1);
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
    expect(upgraded.schemaVersion).toBe(7);
    expect(upgraded.mode).toBe("choose");
    expect(upgraded.selectedPreview).toBe("Preview 1");
    expect(upgraded.quantity).toBe(1);
    expect(upgraded.requiredBy).toBe("");
  });

  it("never restores a quantity below one piece", () => {
    const draft = {
      ...createEmptyCustomizationSession("celadon-tea-cups"),
      quantity: 0,
    };
    expect(normalizeCustomizationSession("celadon-tea-cups", 20, draft).quantity).toBe(1);
  });
});
