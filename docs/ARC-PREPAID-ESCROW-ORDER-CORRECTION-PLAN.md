# LOOMON — Arc Prepaid Escrow Order Correction Plan

Status: approved for execution by the user's 2026-07-25 request
Owner: Codex
Scope: checkout, Arc Testnet escrow, Supabase projection, seven-day settlement hold

## Root cause

Production `Place order` does not call Arc. It signs into Supabase, uploads the
customization asset, and calls `public.submit_customization_quote`. That RPC
creates a quote waiting for seller acceptance. There is no Wagmi/Viem
`writeContract` call.

The existing Solidity contract has the same obsolete assumption:
`merchant.accept()` is required before `fund()`.

This correction replaces that lifecycle with:

`review inline -> fund Arc escrow -> order exists -> seller fulfils -> buyer
confirms completion -> seven-day hold -> seller claims`.

## Master-plan alignment

- Corrects Phases 9 and 10 of `docs/PLAN.md`.
- Supersedes seller acceptance in `docs/contract-order-lifecycle.md` for the
  custom-souvenir MVP.
- Order Proof NFT still mints only after seller delivery and buyer confirmation.
- Agent orders still require typed intent and bounded wallet delegation.

## Locked decisions

1. `Place order` is a real Arc Testnet payment.
2. Payment uses Arc USDC ERC-20 at
   `0x3600000000000000000000000000000000000000`, with 6 decimals.
3. A first purchase can require exact allowance approval, then escrow deposit.
   The UI presents both honestly as one checkout operation.
4. Chain is authoritative for funding/settlement. Supabase is the rich order
   store and indexed chain projection.
5. Canonical order creation occurs only after server receipt/event verification.
6. Seller acceptance is removed.
7. The seven-day clock begins when buyer confirms successful completion.
8. Seller claims only after that clock and when no dispute is active.
9. Needed-by is optional.
10. All fields are editable in one review surface. `Edit brief` and the extra
    brief navigation step are removed.
11. A maker needs one verified active Arc payout destination. Missing seller
    wallets never silently route to a platform placeholder.
12. Demo commerce has one seller: the `Lò Mây` shop, owned by Arc wallet
    `0xd59aa8db407d4219fe4b104ca4142df14301dec4`. Every demo product is assigned
    to this maker; every other connected wallet is buyer-only.
13. The seller wallet cannot buy its own products.

## Target shared escrow pool

| State | Actor | Meaning |
| --- | --- | --- |
| `Funded` | buyer | Exact USDC is held |
| `InProduction` | seller | Work started |
| `Delivered` | seller | Demo delivery ready |
| `CompletionHold` | buyer | Confirmed; seven-day hold starts |
| `Released` | seller | Hold elapsed and funds claimed |
| `Refunded` | permitted flow | Funds returned to buyer |
| `Disputed` | buyer/seller | Settlement frozen |
| `Resolved` | resolver | Refund/split recorded |

Commands:

- `placeOrder(orderId, seller, amountAtomic, termsHash)`
- `startProduction(orderId)`
- `markDelivered(orderId, evidenceHash)`
- `confirmCompletion(orderId, evidenceHash)`
- `claimSellerFunds(orderId)`
- `cancelBeforeProduction(orderId, reasonHash)`
- `refundBuyer(orderId, reasonHash)`
- `raiseDispute(orderId, reasonHash)`
- `resolveDispute(orderId, buyerAmountAtomic, sellerAmountAtomic, decisionHash)`
- `withdrawResolvedFunds(orderId)`

Safety:

- one order key funds once; immutable buyer/seller/amount/terms after funding;
- checks-effects-interactions and reentrancy guard every transfer;
- dispute freezes claim;
- buyer cancellation only before production;
- seller alone starts, delivers or issues full refund;
- resolver alone splits disputed funds;
- all money transitions emit indexed events;
- no arbitrary admin withdrawal or upgrade.

## Normalized Supabase changes

Migration suite: `0027_arc_prepaid_escrow_orders.sql` through
`0036_revoke_obsolete_demo_seller_claims.sql`.

- `payments.maker_payout_destinations`: maker, verified wallet, chain,
  activation/revocation; one active destination per maker.
- `commerce.checkout_sessions`: buyer, exact product/version/brief snapshot,
  quantity, optional date, atomic amount, payout destination, terms hash,
  on-chain order key, idempotency key and expiry.
- Reuse/extend `payments.payment_intents`, `payments.transactions`,
  `payments.escrow_instances`, and `payments.chain_events`.
- `server_prepare_prepaid_checkout` validates canonical price, availability,
  version, MOQ, payout and idempotency; returns typed calldata.
- `server_confirm_prepaid_order` is server-only and atomically records verified
  transaction, event, escrow, order, history, thread and project state.
- Buyers see only their rows; maker members see only their maker rows; browser
  roles cannot insert confirmed payment/event/order data.
- Unique transaction, log and idempotency constraints prevent replay.
- Obsolete demo-seller claim RPCs are unavailable to browser roles; checkout
  verification is executable only by `service_role`.

## One-surface checkout

1. Choose intent.
2. Upload a source/reference when relevant.
3. Optionally render/select an Agent preview.
4. Edit quantity, optional date and maker note inline.
5. Review exact USDC total and seven-day protection.
6. Press `Place order`.

There is no `Edit brief`. Agent Render remains optional and inline.

Transaction sequence:

1. connect wallet and enforce Arc Testnet;
2. authenticate/link wallet;
3. upload selected asset;
4. prepare checkout server-side;
5. read allowance and request exact approval only when needed;
6. call pool `placeOrder`;
7. wait for Arc receipt;
8. send checkout ID and transaction hash to server;
9. verify address, event, buyer, seller, amount, key, terms and replay;
10. create canonical order and show order reference plus Arcscan link.

Wallet rejection keeps the draft. A submitted transaction can resume
verification. Reverted/mismatched receipts never create a funded order.
Duplicate confirmation returns the existing order.

## Checkpoints

### A — Baseline and failing tests

- [x] Record TypeScript, lint, Vitest, build and Foundry baseline.
- [x] Add failing contract tests for prepaid placement and seven-day hold.
- [x] Add failing API/domain tests proving no seller acceptance.
- [x] Add UI/domain coverage proving Arc writes and no `Edit brief`.

Exit: failures describe missing target behavior, not setup.

### B — Escrow pool

- [x] Implement `LoomonEscrowPool`.
- [x] Test authorization, replay, hold, refund and dispute.
- [x] Add versioned Arc Testnet deploy script and record.

Exit: Foundry passes; no seller-acceptance path remains.

### C — Database

- [x] Add migration 0027.
- [x] Add constraint, idempotency, RLS and lifecycle tests.
- [x] Apply to connected Supabase after review.
- [x] Verify active payout destinations.
- [x] Consolidate all demo products, memberships and payout under the single
      `Lò Mây` seller wallet, and reject self-purchases.

Exit: production migration is recorded and replay-safe.

### D — Typed checkout/verifier

- [x] Add Zod schemas, ABI and Arc constants.
- [x] Add prepare and confirm endpoints.
- [x] Verify exact escrow event, not a generic transfer.
- [x] Persist recovery metadata without secrets.
- [x] Add a signed-wallet session bridge so checkout is not blocked when the
      hosted Supabase project has not enabled its optional Ethereum provider.

Exit: wrong chain/contract/actor/amount/key/hash and replay fail safely.

### E — Unified UX

- [x] Merge brief and review into one editable surface.
- [x] Remove `Edit brief`, seller-review and no-charge copy.
- [x] Add wallet/network/approval/deposit/verification progress.
- [x] Add success, rejection, insufficient funds and retry states.

Exit: desktop/mobile placement needs no second form.

### F — Fulfilment and release

- [x] Replace seller accept/reject with start production/refund.
- [x] Wire delivery, buyer confirmation, dispute, seven-day countdown and claim
      to verified contract calls/events.
- [x] Preserve delivered + buyer-confirmed NFT mint gate.

Exit: buyer/seller views match chain state and claim timestamp.

### G — Release

- [x] Run typecheck, lint, Vitest, DB tests, Foundry and production build.
- [x] Execute one Arc Testnet prepaid order.
- [x] Reconcile Arcscan and Supabase payment/escrow/order/history.
- [x] Push, deploy Vercel and test production.

Exit: production creates one funded escrow and one matching order without
seller acceptance.

## Deployment and rollback

Order: contract test -> Arc pool deploy -> additive DB migration -> environment
configuration -> server verifier -> UI -> production E2E.

Rollback disables new checkout preparation and the active contract version,
reverts the web deployment, and preserves funded orders/events. The pool stays
available for completion, dispute, refund and claim.

## Verification evidence

- Baseline: the obsolete quote-only checkout was reproduced and replaced.
- Foundry: 19/19 tests pass, including prepaid placement and seven-day hold.
- Database migration: production records migrations 0027 through 0036.
- Supabase RLS: browser roles cannot execute checkout verification or obsolete
  seller-claim RPCs; server verification is restricted to `service_role`.
- Arc Testnet pool: `0x71C23BACE617d0CDfD2F4dEC31D81f5eb08216C7`.
- Arc test order: `LM-26-07-152FDE`; funded by buyer transaction
  `0xd181afe26fee95839cdecfefd63efea438b43e29cc17f0149abb911a75d6e6da`,
  then refunded by the Lò Mây seller transaction
  `0x943a988ded6063e3af00ff1f9925a75af9e30c36744637a759d546d3afeeb4c5`.
- Typecheck/lint/Vitest/build: pass; 41/41 Vitest tests; 74 routes built.
- Git commit/push: `c0671ab`, pushed to `codex/phase-2-agent-commerce`
  and fast-forwarded to `main`.
- Vercel deployment: production is READY at `https://loomon.vercel.app`
  from deployment `dpl_3MEoAJrNZCJ6imgDS1YmefCLLP27`; `/app` returned HTTP
  200, wallet challenge returned HTTP 200, and no runtime errors were found in
  the checked production window.
