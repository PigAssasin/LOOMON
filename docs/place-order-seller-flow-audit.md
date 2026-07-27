# Place order and seller flow audit

Date: 2026-07-27

## Problem

Buyer reports that `Place order` does not open any wallet transaction even when the account has enough testnet funds.

## What must be true

1. Buyer can click `Place order`.
2. If wallet is not connected, Rainbow opens.
3. If wallet is connected, the app verifies wallet auth.
4. Supabase creates or reuses the quote/order request.
5. Supabase prepares the prepaid checkout with the single active seller wallet:
   - `0xd59aa8db407d4219fe4b104ca4142df14301dec4`
6. If allowance is insufficient, wallet opens USDC approval.
7. Wallet opens the escrow `placeOrder` transaction.
8. After confirmation, database marks the order as funded.
9. Seller workspace can see the buyer order.
10. Seller can view customization image/AI preview assets, then accept/reject/refund according to current demo rules.

## Audit checkpoints

- [ ] Check frontend button disabled/guard conditions.
- [ ] Check wallet/session/auth path for silent failures.
- [ ] Check Supabase RPC inputs and error handling.
- [ ] Check contract config and deployed pool/USDC addresses.
- [ ] Check product-to-seller mapping in DB.
- [ ] Check seller workspace filters and actions.
- [ ] Fix discovered issues.
- [ ] Run typecheck, lint/tests, build.
- [ ] Push and deploy.
