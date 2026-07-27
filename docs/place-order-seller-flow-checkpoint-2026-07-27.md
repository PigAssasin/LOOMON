# LOOMON place order + seller flow checkpoint — 2026-07-27

## Overall plan alignment

This checkpoint belongs to Phase 2: database + contract-backed commerce.

Target flow:

1. Buyer chooses a product.
2. Buyer opens Customize with agent.
3. Buyer optionally uploads artwork, enters print text, notes, quantity and wanted-by date.
4. Buyer presses Place order.
5. App signs wallet identity if needed, prepares a Supabase quote/checkout, then calls Arc escrow `placeOrder`.
6. USDC enters the LOOMON escrow pool immediately.
7. Seller sees the funded order, custom brief and attached/generated image.
8. Seller can start production or refund/reject from the order detail.
9. Buyer confirms completion after delivery.
10. NFT proof is minted only after successful delivery/completion.

## Findings

- Production Supabase migrations are applied through `order_proof_server_readers`.
- Active seller is correctly mapped:
  - Maker: `lo-may`
  - Wallet: `0xd59aa8db407d4219fe4b104ca4142df14301dec4`
  - Membership: active owner
  - Payout destination: active
- Active escrow contract is configured:
  - `LoomonEscrowPool`
  - `0x71c23bace617d0cdfd2f4dec31d81f5eb08216c7`
- The latest failed attempt created a quote request but no checkout session.
- The latest buyer wallet was the same as the single seller wallet, which violates the checkout constraint `buyer_address <> seller_address`.
- Current UI hides this failure too poorly: users can see no wallet transaction because the app fails before `approve/placeOrder`.
- Seller list UI still has old request-first assumptions and does not surface prepaid funded orders clearly enough.
- Customization assets are stored in a private bucket; seller needs a server-signed URL path to view buyer uploaded/generated images.

## Fix checkpoints

- [x] Block seller wallet from buyer checkout before quote creation.
- [x] Make Place order always produce a visible result instead of silent disabled state.
- [x] Update seller list copy/actions for prepaid escrow orders.
- [x] Add participant-safe order brief asset signed URLs.
- [x] Verify typecheck/build.
- [ ] Deploy and push.

## Verification

- `npm.cmd run typecheck` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Supabase production migration `order_brief_asset_access` applied successfully.
