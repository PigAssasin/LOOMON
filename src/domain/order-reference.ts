export const DEMO_ORDER_REFERENCE = "PM-26-07-K7M4Q2";

export const ORDER_REFERENCE_PATTERN = /^PM-\d{2}-\d{2}-[A-Z2-9]{6}$/;

export function isOrderReference(value: string) {
  return ORDER_REFERENCE_PATTERN.test(value);
}
