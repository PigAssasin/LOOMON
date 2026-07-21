import { describe, expect, it } from "vitest";
import { toUsdcAtomic } from "@/src/lib/money";

describe("toUsdcAtomic", () => {
  it("converts display USDC into six-decimal contract units", () => {
    expect(toUsdcAtomic("12.345678")).toBe(12_345_678n);
    expect(toUsdcAtomic("40")).toBe(40_000_000n);
  });
});
