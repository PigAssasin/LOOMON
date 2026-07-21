export function formatMoney(amount: number | string, currency = "USDC") {
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount)) + ` ${currency}`;
}

export function toUsdcAtomic(amount: number | string): bigint {
  const [whole = "0", fraction = ""] = String(amount).split(".");
  const normalizedFraction = `${fraction}000000`.slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(normalizedFraction);
}
