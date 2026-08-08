# LOOMON Order Wallet Regression Fix Plan

## Context

After tightening wallet auth, two regressions can appear in the order workspace:

1. A connected buyer may not see older prepaid Arc orders because the browser now holds a wallet-bridge Supabase session, while older orders can be attached to a different Supabase user id. Arc orders are still keyed by the buyer wallet in `payments.escrow_instances`.
2. Seller actions such as Accept and Mark delivered feel like they apply to every row because the client uses a global busy state for all row buttons. The server confirm route also needs to require the same wallet session check as the read routes.

## Goals

- Buyer order history must be visible whenever the connected wallet is the escrow buyer, even if the Supabase user id changed.
- Seller actions must be scoped to one order id from UI state through server projection.
- Escrow confirm must reject spoofed `walletAddress` values and require an authenticated wallet session.
- Tests must cover workspace merging and single-order status updates.

## Implementation Plan

1. Add domain helpers for order-safe workspace merging:
   - Deduplicate by `kind:id`.
   - Prefer fresher rows by `updatedAt`.
   - Preserve requests and orders independently.
2. Update the Orders page loader:
   - When a wallet is connected, always load the wallet-native workspace.
   - Merge Supabase RPC workspace with wallet workspace.
   - For the single demo seller, merge seller wallet workspace too.
   - Keep the empty-state behavior only after all relevant sources fail.
3. Tighten escrow confirm:
   - Require `walletAddress` in the request.
   - Validate the address has an active LOOMON wallet session using `requireWalletSession`.
   - Continue verifying tx sender, pool address, event name, and event `orderId`.
4. Make row action busy state explicit:
   - Disable/loading only the row being acted on.
   - Keep sibling rows visually unchanged except for a small "another order is signing" hint.
   - Guard action handlers against concurrent submissions.
5. Add regression tests:
   - Merging a wallet workspace restores buyer orders when session workspace is empty.
   - A newer copy of the same order wins during merge.
   - Escrow action optimistic update only changes the target order.
6. Validate and deploy:
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`
   - `npm run build`
   - Push to `origin/main` after approval if required.

