# LOOMON — Buyer/Seller Order and Profile Correction Plan

Status: approved for execution  
Date: 2026-07-25  
Primary rulebook: `codex.md`  
Compared against:

- `docs/PLAN.md`
- `docs/BASIC-COMMERCE-COMPLETION-PLAN.md`
- `docs/ARC-DEMO-NFT-ORDER-PROOF-PLAN.md`
- `docs/AGENT-COMMERCE-FLOW.md`
- `design.md/DESIGN.md`
- `design.md/theme.css`
- `design.md/variables.css`
- `design.md/tokens.json`

## 1. Outcome

Replace the remaining browser-only demo behavior with one simple, canonical
Supabase-backed flow:

```text
buyer selects the product
-> buyer approves a customization brief
-> buyer clicks Submit request
-> Rainbow opens only when the wallet/session must be verified
-> one request is created for the selected seller
-> seller sees it in Selling / Incoming
-> seller accepts, rejects, or requests changes
-> acceptance creates one canonical demo order
-> seller marks the demo order delivered
-> buyer confirms receipt
-> exactly one non-transferable Arc Testnet proof NFT is minted to the buyer
-> both sides see the same order and can communicate in its thread
```

The requested date is optional. Physical delivery is represented as a demo
workflow event rather than carrier-verified fulfillment. Future funded Arc
escrow remains a separate extension.

## 2. Audit findings

### 2.1 Production database

Read-only inspection of Supabase project `tmrmvdqtkuoxforqulid` on 2026-07-25:

| Entity | Rows |
|---|---:|
| `commerce.quote_requests` | 0 |
| `commerce.orders` | 0 |
| `commerce.order_proof_nfts` | 0 |
| `catalog.maker_memberships` | 0 |
| `public.profiles` | 0 |

The migrations exist, but the current buyer/seller screens are not yet driving
the canonical data path.

### 2.2 Quote submission

Current behavior:

- `src/features/quote/quote-request-experience.tsx` calls
  `supabase.auth.signInWithWeb3`.
- Supabase Web3 Auth is not enabled, so the buyer sees an infrastructure error.
- The brief remains local and no quote request reaches the database.
- The error copy tells a normal buyer to enable a Supabase provider.

Target behavior:

- One commerce action: `Submit request`.
- If the wallet is disconnected, Rainbow opens.
- If the wallet is connected but the LOOMON session is missing, the app requests
  one plain wallet signature and silently establishes the Supabase session.
- Infrastructure/provider names never appear in buyer-facing copy.
- Retry is idempotent and cannot create duplicate requests.
- `required_by` remains nullable and the UI labels it `Needed by (optional)`.

### 2.3 Orders

Current behavior:

- `src/features/orders/orders-center.tsx` uses a fixed demo order reference.
- Buyer and seller lists, counts, deposit, dates, and product information are
  hardcoded.
- Seller Accept and Decline only change local React state.
- There is no participant-scoped list API/RPC for Buying and Selling.
- There is no real withdraw, request-changes, reject, cancel, or refund action.

Target behavior:

- Buying and Selling are two projections of the same canonical records.
- Every action is a validated server/database command.
- Tabs, counts, empty states, and detail pages come from Supabase.
- The UI exposes only actions valid for the current role and state.

### 2.4 Profile

Current behavior:

- Profile fields are loaded from and saved to `localStorage`.
- Products, Orders, Rating, and On-time contain static/demo values.
- Following is browser-local.
- Only Purchased proof NFTs use a real endpoint.
- There is no wallet disconnect/logout action.

Target behavior:

- Profile and commerce summary come from Supabase.
- No fake rating, order count, or on-time percentage is displayed.
- Buyer and seller capabilities can coexist on one account.
- Wallet disconnect is beside Edit profile and clears the wallet-backed session,
  not the user's canonical orders or drafts.

### 2.5 NFT rule conflict

The approved NFT plan currently requires:

```text
verified payment -> mint proof -> completed demo
```

The approved product rule is:

```text
seller accepts demo request
-> seller marks delivered
-> buyer confirms received
-> mint proof
```

The token means **Buyer Confirmed Demo Delivery**. It does not prove payment,
authenticity, legal title, product quality, or investment value.

The existing NFT contract does not need a redesign or redeployment for this
semantic change. The deterministic eligibility command, metadata copy, database
projection, and tests must change.

## 3. UX decisions

### 3.1 Submit request

The quote footer contains:

- quantity;
- optional needed-by date;
- seller note;
- starting estimate;
- one `Submit request` outline control.

Below the control, use plain copy:

`You are sending a request. Nothing is charged.`

Wallet behavior:

1. Connected and authenticated: submit immediately.
2. Disconnected: open Rainbow; after connection, request the authentication
   signature and continue automatically.
3. User rejects connection/signature: keep the brief and show
   `Request not sent. Connect your wallet to continue.`
4. Provider/configuration failure: keep the brief and show
   `We could not verify your wallet. Try again in a moment.`

No Supabase, RLS, Web3 provider, nonce, or signature implementation language is
shown by default.

### 3.2 Orders information architecture

One `/app/orders` route, with an explicit role switch:

#### Buying

- `Requests`: waiting for seller, changes requested, rejected.
- `Active`: accepted, in progress, or awaiting delivery confirmation.
- `History`: delivered/proof minted, withdrawn, cancelled, or refunded.

#### Selling

- `Incoming`: submitted requests needing action.
- `Active`: accepted demo orders through delivery confirmation.
- `History`: delivered/proof minted, rejected, cancelled, or refunded.

Each card shows only:

- product image and title;
- shop/buyer display name appropriate to the viewer;
- public request/order reference;
- current plain-language status;
- latest update time;
- one primary next action.

The detail page shows the full brief, selected preview/source file, notes,
optional date, quantity, event timeline, participant thread, and valid actions.

### 3.3 State-specific actions

| State | Buyer actions | Seller actions |
|---|---|---|
| Submitted | Withdraw request, message | Accept, reject, request changes, message |
| Changes requested | Update brief, withdraw, message | Review update, reject, message |
| Rejected | Duplicate/revise request, view reason | View history |
| Accepted / in progress | View status, cancel request, message | Mark delivered, cancel, message |
| Marked delivered | Confirm received, report issue, message | View status, message |
| Receipt confirmed / mint pending | View status, message | View status, message |
| Proof minted | View NFT and history | View NFT and history |
| Cancelled | View history | View history |
| Funded escrow (future) | Request refund | Approve/contest per policy |
| Refunded (future) | View refund proof | View refund proof |

`Refund` must not appear for an unfunded demo order. In the current demo, the
correct action is `Cancel order`. A true refund control is introduced only when
the order has a verified funded escrow/payment record.

### 3.4 Profile layout

Keep the existing LOOMON design language; do not introduce a new visual system.

Clean layout:

1. Identity header:
   - avatar;
   - display name;
   - wallet state/address;
   - Edit profile;
   - Disconnect wallet;
   - Settings.
2. Capability summary:
   - Buying requests/orders from database;
   - Selling requests/orders only if the user owns/manages a shop;
   - Published products from database;
   - Purchased proofs from database/Arc.
3. Content sections:
   - Purchased;
   - Your shop/products when seller capability exists;
   - Following.

Rules:

- Edit remains inline, then Save/Cancel.
- Use `Not available yet` instead of invented rating/on-time statistics.
- Hide rating and on-time metrics until normalized review/fulfillment data
  exists.
- For a new user, lead with name, wallet status, and the next useful action;
  do not present an empty seller dashboard unless they create a shop.
- Disconnect invokes both wagmi disconnect and Supabase sign-out.
- Disconnect never deletes profiles, requests, orders, messages, or NFTs.

## 4. Canonical data and state design

### 4.1 Identity and seller capability

- `auth.users` remains the application identity.
- `wallet.accounts` links a verified Arc wallet to that identity.
- `public.profiles` stores display name, email, locale, location/bio, and
  notification consent.
- Buyer is a default capability for every authenticated user.
- Seller capability requires an active `catalog.maker_memberships` row.
- A connected wallet cannot accept an order for an arbitrary maker.
- Open seller onboarding creates or claims a maker and an owner membership
  through one audited command.

### 4.2 Request and order state machine

Request:

```text
submitted
-> seller_review
-> changes_requested -> submitted
-> accepted | rejected | withdrawn
```

Demo order:

```text
seller_accepted
-> in_progress
-> seller_marked_delivered
-> buyer_confirmed_received
-> proof_pending
-> proof_minted
```

Side exit:

```text
seller_accepted/in_progress -> cancelled
seller_marked_delivered -> delivery_disputed -> resolved_cancelled
seller_marked_delivered -> delivery_disputed -> buyer_confirmed_received
```

Future funded path:

```text
payment_pending -> funded -> released
                         -> refund_requested -> refunded
```

Implementation must not reuse `deposit_paid` or `completed` to imply events
that did not happen. Add explicit demo acceptance/proof states or a normalized
demo lifecycle projection rather than mislabeling payment/fulfillment states.

### 4.3 Seller acceptance transaction

Create one security-definer/server-only command that atomically:

1. derives the authenticated seller;
2. locks the request;
3. verifies active maker membership and `order_manager` permission;
4. verifies the request is still actionable;
5. updates request status to accepted;
6. creates one canonical order and immutable item/brief snapshot;
7. allocates the public `LM-YY-MM-XXXXXX` order reference;
8. appends order/request history;
9. ensures the buyer and seller thread exists;
10. prepares the delivery lifecycle without creating a proof;
11. writes notification/outbox events;
12. returns the new order summary.

The command uses a client request key and unique constraints so double-clicks,
retries, and two browser tabs cannot create two orders or two NFTs.

### 4.4 Rejection, changes, withdrawal, and cancellation

Each mutation is a dedicated typed command with:

- actor derived from the authenticated session;
- participant/role check;
- allowed-from-state check;
- mandatory reason where relevant;
- idempotency key;
- append-only history event;
- notification/outbox event.

Rejected and cancelled records are retained. They are never hard-deleted.

### 4.5 Proof eligibility

Replace the database proof gate:

- old: paid invoice and verified payment required;
- new demo gate: canonical order with a seller-delivered event followed by an
  explicit buyer receipt-confirmation event, verified primary buyer Arc wallet,
  no existing proof, supported chain and contract.

Add an immutable proof reason/version, for example:

- `proof_kind = 'buyer_confirmed_demo_delivery'`;
- `eligibility_version = 2`.

NFT/application copy:

- `Confirmed Delivery Order Proof`;
- `Arc Testnet · Demo`;
- `No payment or delivery claim`.

Confirmation must not automatically rewrite the order as physically
`completed`. It advances only the proof state/projection.

## 5. Application services

Add participant-safe read models and commands rather than exposing raw tables:

- `get_my_commerce_summary()`;
- `list_my_order_requests(role, stage, cursor)`;
- `get_my_order_detail(reference)`;
- `seller_accept_request(request_id, request_key)`;
- `seller_reject_request(request_id, reason, request_key)`;
- `seller_request_changes(request_id, note, request_key)`;
- `buyer_withdraw_request(request_id, reason, request_key)`;
- `cancel_demo_order(order_id, reason, request_key)`;
- `seller_mark_order_delivered(order_id, note, request_key)`;
- `buyer_confirm_order_received(order_id, request_key)`;
- `buyer_report_delivery_issue(order_id, reason, request_key)`;
- `get_my_profile()` / `update_my_profile(...)`;
- `create_or_claim_my_shop(...)`;
- participant-safe message list/send commands.

Next.js routes validate payloads with Zod, derive identity server-side, and
return stable error codes mapped to plain UI copy.

The Personal Agent must call the same commands. It must not receive a separate
shortcut that bypasses state, authorization, or idempotency.

## 6. Checkpoints

### C0 — Product and plan lock

Status: complete.

- Lock buyer-confirmed-delivery NFT semantics.
- Approve optional needed-by date.
- Approve contextual Cancel versus Refund behavior.
- Record the override in `codex.md`, `docs/PLAN.md`,
  `docs/BASIC-COMMERCE-COMPLETION-PLAN.md`, and
  `docs/ARC-DEMO-NFT-ORDER-PROOF-PLAN.md`.

Exit: documentation has one non-contradictory demo order/NFT lifecycle.

### C1 — Wallet auth and profile foundation

Status: complete.

- Enable Supabase Web3 wallet provider for the production project.
- Add wallet-to-user linking/session tests.
- Add profile read/update and commerce summary commands.
- Add open seller onboarding/claim command.
- Remove profile `localStorage` as the source of truth.

Exit:

- a new wallet can create one LOOMON session;
- reconnect resolves the same identity;
- logout clears both wallet and Supabase sessions;
- profile survives another browser/device;
- no profile metric is hardcoded.

Rollback:

- retain existing wallet/account rows;
- feature flag the new profile reader;
- do not delete canonical user data.

### C2 — Request/order command layer

Status: complete.

- Add migration for request transitions, explicit demo order/proof states,
  history, idempotency, and participant projections.
- Implement accept/reject/request-changes/withdraw/cancel commands.
- Add RLS and pgTAP coverage.
- Regenerate TypeScript database types.

Exit:

- wrong buyer/seller/maker cannot read or mutate an order;
- double acceptance creates one order;
- accept and reject races have one deterministic winner;
- all transitions append history;
- requested date may be null.

Rollback:

- preserve created records;
- disable command grants/endpoints;
- do not reverse confirmed chain mints.

### C3 — Buyer and seller Orders UI

Status: complete.

- Replace `DEMO_ORDER_REFERENCE` and local action state.
- Implement real Buying/Selling lists, counts, details, and empty/error states.
- Add valid contextual controls.
- Add participant message thread using canonical messaging rows.
- Preserve the centered global Agent control.

Exit:

- seller receives a newly submitted request without seeded local state;
- seller acceptance/rejection is visible to buyer after refresh and realtime
  update;
- buyer and seller see the same reference/state;
- refund is absent when no money exists.

Rollback:

- retain old route behind a temporary local-only flag until production smoke
  tests pass;
- no database rollback needed for UI-only failure.

### C4 — Delivery-confirmation proof mint

Status: complete in database, contract, API and UI; production secret activation remains in C6.

- Add seller-delivered and buyer-received transitions.
- Change proof eligibility and metadata version.
- Stop proof confirmation from marking physical completion.
- Queue or invoke mint only after buyer receipt confirmation.
- Make retry safe and visible.
- Update Purchased copy.

Exit:

- seller acceptance alone never mints;
- seller delivery declaration alone never mints;
- only the participating buyer can confirm receipt;
- one confirmed delivery mints at most one token;
- wrong seller or buyer cannot trigger mint;
- failed mint can retry without a second order/token;
- NFT clearly states buyer-confirmed demo delivery and no payment/authenticity claim;
- buyer sees it under Purchased after Arc confirmation.

Rollback:

- stop the mint worker/route;
- retain pending/failed proof records for recovery;
- never attempt to erase an already minted token.

### C5 — Profile redesign

Status: complete.

- Apply the clean identity/action/summary/content hierarchy.
- Add Disconnect wallet next to Edit profile.
- Show only real Supabase counts.
- Hide unsupported rating/on-time metrics.
- Make buyer-only, seller-only, dual-capability, disconnected, empty, loading,
  and error states explicit.

Exit:

- a new buyer understands the page without seller noise;
- a seller sees their real shop/products and selling totals;
- logout is keyboard-accessible and leaves canonical data intact;
- desktop/mobile follow the locked design system.

### C6 — Verification and release

Status: production deployed; two-wallet signed E2E pending.

Completed evidence:

- Supabase production migrations `0021` through `0026` are applied.
- Ethereum wallet authentication and production/local redirect allowlists are enabled.
- The legacy pre-delivery proof gate is removed.
- Only `service_role` can prepare a delivered-order proof.
- Seller delivery alone is rejected; buyer-confirmed receipt is required.
- Orders and buyer/seller messages are in Supabase Realtime.
- Arc Testnet proof contract is deployed and all 13 Foundry tests pass.
- TypeScript, ESLint, 35 Vitest tests, and the Next.js production build pass.

Production release evidence:

- `SUPABASE_SERVICE_ROLE_KEY` is present as a Sensitive Vercel Production
  variable and is never committed or exposed to the browser bundle.
- Deployment `dpl_55hcQapfB2WG1avVAovzdmV3PXz2` is Ready and aliased to
  `https://loomon.vercel.app`.
- Production quote, Orders, Profile and Gemini Personal Agent surfaces were
  smoke-tested in Chrome.
- Vercel reported no error/fatal runtime logs in the checked release window.

Remaining signed E2E:

- use distinct buyer and seller wallets to create, accept, deliver and confirm
  one production order, then verify the minted token in Purchased and ArcScan.

Required checks:

- TypeScript, ESLint, Vitest, Next production build;
- pgTAP migration/state/RLS tests;
- wallet connect, reject signature, reconnect, and disconnect tests;
- Playwright buyer submit -> seller accept/reject -> buyer status flows;
- proof idempotency and Arc receipt reconciliation;
- direct URL, refresh, two-tab race, and mobile tests;
- Supabase Security Advisor: no errors;
- production smoke test with one buyer wallet and a different seller wallet;
- verify no Supabase/service error wording is exposed to normal users.

Deployment order:

1. documentation and feature flags;
2. additive Supabase migration;
3. server commands/routes;
4. wallet auth configuration;
5. Orders/Profile UI;
6. proof eligibility worker/service;
7. preview deployment;
8. production deployment;
9. production E2E and monitoring.

Release exit gates:

- Supabase contains one real profile, maker membership, request, order, history,
  conversation, and proof from the production smoke path;
- all list/detail counts equal database facts;
- seller can accept/reject and buyer can withdraw/cancel;
- NFT is triggered only after seller delivery and buyer receipt confirmation;
- no fake order, rating, on-time, refund, or payment data remains.

## 7. Deliberately deferred

- real physical fulfillment;
- public reviews and rating computation;
- carrier tracking and on-time calculation;
- actual refund before funded Arc escrow is enabled;
- multi-item cart;
- multi-seller order;
- fiat payment;
- automatic dispute resolution.

These items must not be simulated with fake numbers or buttons.
