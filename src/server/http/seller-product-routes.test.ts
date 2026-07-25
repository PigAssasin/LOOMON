import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/src/server/catalog/product-lifecycle-commands", () => ({
  archiveProduct: vi.fn(),
  deleteProductDraft: vi.fn(),
  getProductReferenceImpact: vi.fn(),
  restoreArchivedProduct: vi.fn(),
  setProductAvailability: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { POST } from "@/app/api/seller/products/[productId]/lifecycle/route";
import {
  getProductReferenceImpact,
  setProductAvailability,
} from "@/src/server/catalog/product-lifecycle-commands";

const validBody = {
  action: "set_availability",
  makerId: 1,
  status: "paused",
  reason: "Kiln maintenance",
  expectedAvailableAt: "2026-08-10T02:00:00.000Z",
  expectedVersion: 2,
  requestKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

function request(body: unknown, origin = "https://loomon.vercel.app") {
  return new Request(
    "https://loomon.vercel.app/api/seller/products/12/lifecycle",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
      },
      body: JSON.stringify(body),
    },
  );
}

const context = {
  params: Promise.resolve({ productId: "12" }),
};

describe("seller product lifecycle route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProductReferenceImpact).mockResolvedValue({
      product_id: 12,
      maker_id: 1,
      slug: "celadon-tea-cups",
      editorial_status: "published",
      published_version_id: 20,
      availability_status: "available",
      availability_version: 2,
      references: {
        quotes: 0,
        customization_projects: 0,
        orders: 0,
      },
      can_hard_delete: false,
      recommended_action: "archive",
    });
    vi.mocked(setProductAvailability).mockResolvedValue({
      product_id: 12,
      status: "paused",
      expected_available_at: "2026-08-10T02:00:00.000Z",
      version: 3,
    });
  });

  it("rejects a cross-site request before calling the command layer", async () => {
    const response = await POST(
      request(validBody, "https://attacker.example"),
      context,
    );
    expect(response.status).toBe(403);
    expect(getProductReferenceImpact).not.toHaveBeenCalled();
    expect(setProductAvailability).not.toHaveBeenCalled();
  });

  it("rejects non-JSON command bodies", async () => {
    const response = await POST(
      new Request(
        "https://loomon.vercel.app/api/seller/products/12/lifecycle",
        {
          method: "POST",
          headers: {
            "content-type": "text/plain",
            origin: "https://loomon.vercel.app",
          },
          body: "pause",
        },
      ),
      context,
    );
    expect(response.status).toBe(415);
    expect(getProductReferenceImpact).not.toHaveBeenCalled();
  });

  it("rejects browser-provided actor identity", async () => {
    const response = await POST(
      request({ ...validBody, actorUserId: "attacker" }),
      context,
    );
    expect(response.status).toBe(400);
    expect(getProductReferenceImpact).not.toHaveBeenCalled();
  });

  it("passes a valid same-origin command without an actor field", async () => {
    const response = await POST(request(validBody), context);
    expect(response.status).toBe(200);
    expect(setProductAvailability).toHaveBeenCalledWith({
      ...validBody,
      productId: 12,
      source: "seller",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/app/seller/products");
    expect(revalidatePath).toHaveBeenCalledWith(
      "/app/products/celadon-tea-cups",
    );
  });
});

