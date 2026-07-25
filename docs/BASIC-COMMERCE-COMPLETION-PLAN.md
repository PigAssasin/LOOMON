# LOOMON — Basic Commerce Completion Plan

Status: approved with Arc demo NFT addendum
Date: 2026-07-25
Primary rulebook: `codex.md`
Master direction: `docs/CUSTOM-SOUVENIR-MVP-PLAN.md`
Agent addendum: `docs/AGENT-COMMERCE-FLOW.md`
Catalog lifecycle foundation: `docs/PRODUCT-LIFECYCLE-INVENTORY-PLAN.md`

## 1. Goal

Finish the minimum complete buying-and-selling system for LOOMON without
turning the MVP into a large general marketplace.

The product is an open-participation custom-souvenir demo:

```text
buyer discovers a product
-> buyer uploads artwork or writes a custom brief
-> seller reviews feasibility and sends a quote
-> buyer accepts and funds the agreed order on Arc Testnet
-> Arc Testnet payment is verified
-> buyer and seller communicate in one order thread
-> seller marks the order delivered
-> buyer confirms receipt
-> one non-transferable Order Proof NFT is minted to the buyer
-> the proof appears in Purchased
```

The MVP is successful only when this complete path works with real Supabase
data and Arc Testnet. A polished gallery without this path is not complete.

## 2. Scope decision: complete but deliberately small

### Included

- email-based Supabase authentication;
- buyer profile, delivery address and notification consent;
- open seller/shop registration and explicit shop selection;
- seller shop profile;
- product draft, media, review, publish, pause, out-of-stock and archive;
- public discovery/search and truthful availability;
- AI-render or no-AI customization brief;
- quote request and seller quote;
- buyer quote acceptance;
- one custom product/brief per MVP order;
- Arc Testnet deposit escrow and server-side verification;
- buyer and seller order views;
- buyer-seller messaging with attachments;
- email/in-app demo order notifications;
- one Arc Testnet Order Proof NFT per buyer-confirmed delivered demo order;
- buyer Purchased collection backed by Supabase and Arc;
- cancellation and a narrow dispute/escalation flow;
- Personal Agent tools that operate on the same canonical services.

### Explicitly excluded from this MVP

- unmoderated seller self-publication;
- seller subscription plans or platform billing;
- multi-item shopping cart;
- coupons, loyalty points or flash sales;
- product reviews and public ratings;
- public social feeds beyond existing discovery/follow UI;
- automated tax calculation;
- carrier API integration and live shipping rates;
- multi-chain payment;
- fiat checkout;
- multi-maker settlement inside one order;
- automated return merchandise authorization;
- auctions, bidding or dynamic pricing;
- seller-created canonical taxonomy;
- Agent-selected final product;
- silent Agent messages sent as buyer or seller.

These exclusions keep the system usable and credible without hiding missing
core commerce behavior behind demo UI.

## 3. Roles and minimum capabilities

### Buyer

Must be able to:

1. sign in and maintain profile/address;
2. browse only sellable products;
3. view price basis, MOQ, lead time, maker and availability;
4. choose the final product;
5. upload artwork or submit text/maker notes;
6. choose an AI preview or continue without rendering;
7. send a quote/order request;
8. receive and accept/reject a seller quote;
9. approve and fund the exact Arc Testnet deposit;
10. message the seller;
11. see one canonical order timeline;
12. request cancellation or support;
13. receive reminders and milestone notifications;
14. inspect payment details without needing blockchain knowledge.

### Seller

Must be able to:

1. sign in and create or join a maker/shop membership;
2. select the shop being managed;
3. edit the shop profile;
4. create, save, resume and submit a product draft;
5. upload private product media safely;
6. see Draft, In review, Live, Paused, Out of stock and Archived products;
7. pause/resume, restock, archive or delete an eligible draft;
8. see incoming quote requests and the buyer's approved brief;
9. accept/reject feasibility and issue a final quote;
10. see whether the buyer funded the deposit;
11. update allowed production milestones;
12. message the buyer;
13. receive order reminders;
14. preserve historical product/order facts after a listing is removed.

### Platform operator

Must be able to:

1. review/suspend a maker and assign or revoke maker roles;
2. verify/suspend a maker;
3. approve/reject a submitted product version;
4. inspect immutable lifecycle/payment/message audit records;
5. pause unsafe catalog/order activity;
6. resolve the narrow MVP dispute path;
7. retry failed notifications and projections safely.

No public admin dashboard is required initially. Audited Supabase-backed
operator commands are sufficient for the pilot.

### Personal Agent

May:

- search and explain products;
- prepare a brief or quote request;
- summarize order/message context;
- draft buyer-seller messages;
- place/cancel an order after a natural-language request and policy validation;
- fund an approved order inside an explicit wallet delegation;
- watch deadlines and prepare reminders.

May not:

- choose the final product;
- invent product/price/stock/lead-time facts;
- send a buyer/seller message without permission;
- change address, recipient, amount or wallet policy silently;
- sign arbitrary transactions;
- resolve a dispute.

## 4. Canonical state machines

### Product

Editorial status:

```text
draft -> in_review -> published
  ^         |            |
  |         v            v
  +------ rejected    archived
```

Operational availability:

```text
available <-> paused
available <-> out_of_stock
available/paused/out_of_stock -> discontinued
```

Editorial and availability remain separate. Historical orders always reference
the exact product version and immutable commercial snapshot.

### Customization and quote

```text
customization draft
-> brief_ready
-> quote_requested
-> seller_review
-> quoted
-> buyer_accepted | rejected | expired | cancelled
```

A brief can be:

- selected Agent Render;
- source image only;
- source image plus notes;
- text only.

AI rendering is optional. No-AI buyers must not be blocked from requesting a
seller quote.

### Order

```text
deposit_pending
-> deposit_paid
-> production_confirmed
-> design_approval_pending (only when seller proof is required)
-> in_production
-> ready
-> completed
```

Side exits:

```text
deposit_pending -> cancelled
deposit_paid/production_confirmed -> cancellation_requested
active order -> disputed
disputed -> resolved_refund | resolved_release | resolved_split
```

The database is authoritative. UI tabs are projections, not separate states:

1. `Needs agreement`
2. `Payment & production`
3. `Ready & completed`

### Payment/escrow

```text
prepared -> accepted -> funded -> released
                         |          |
                         v          v
                      refunded   completed
                         |
                         v
                      disputed -> resolved
```

Every onchain transition must reconcile to one invoice/order and one verified
Arc receipt/event.

## 5. Data normalization and ownership

Reuse existing normalized schemas. Do not create parallel demo tables.

| Domain | Source of truth |
|---|---|
| User identity | `auth.users`, `public.profiles` |
| Delivery data | normalized buyer addresses with one explicit default |
| Seller/shop | `catalog.makers`, `catalog.maker_memberships` |
| Product | `catalog.products`, version/localization/variant/media tables |
| Availability | `catalog.product_availability`, variant inventory |
| Customization | `customization.projects`, assets, renders, briefs |
| Quote | `commerce.quote_requests`, items and immutable quote versions |
| Order | `commerce.orders`, order briefs and status history |
| Messaging | `messaging.threads`, participants, messages and attachments |
| Notifications | preferences, reminders, delivery attempts/outbox |
| Wallet | wallet accounts and bounded delegations |
| Payment | invoices, intents, transactions, escrow and chain events |
| Agent | conversations, goals, runs, tool calls and consent/action records |

Data rules:

- never use floating point for money;
- USDC application values use 6 decimals and atomic integer fields;
- addresses are private and snapshotted into an accepted order;
- seller/buyer free text is data, never Agent instruction;
- order snapshots retain product version, selected brief, price, quantity,
  deadline, recipient, address and terms hash;
- status transitions append history and domain events;
- search/Agent projections are derived and disposable;
- private media uses signed access and maker/buyer ownership checks;
- idempotency is required for every mutation, notification and payment action.

## 6. Implementation checkpoints

Only one checkpoint may be active at a time. Stop for product-owner review
after each exit gate.

### C0 — Plan lock and baseline

Status: current checkpoint.

Tasks:

1. Approve this scoped commerce plan.
2. Keep curated/invitation-only seller access.
3. Confirm one product/brief per MVP order.
4. Record current database migrations, tests and production environment.
5. Correct stale status text in subsidiary plans.

Exit gate:

- product owner approves scope and exclusions;
- no implementation starts before approval.

Rollback:

- documentation only.

### C1 — Real identity and open seller onboarding

Buyer:

- email magic-link or email/password sign-in;
- sign-out/session refresh;
- profile, email confirmation and delivery address;
- protected profile/order routes.

Seller:

- self-service maker/shop creation;
- active maker membership created through an audited server command;
- explicit shop selector for multi-maker users;
- role-aware seller navigation.

Security:

- signed-cookie user resolution;
- no demo identity in production;
- session refresh middleware/proxy;
- login rate limiting and generic auth errors;
- RLS tests for buyer/seller/cross-maker access.

Exit gate:

- dedicated buyer and seller test accounts can sign in;
- seller A cannot enter seller B context;
- anonymous users cannot access private routes;
- refresh preserves session without exposing tokens.

### C2 — Product draft and private media foundation

This checkpoint completes `CP3.5` in the lifecycle plan.

Tasks:

1. Implement transaction-safe create/save/submit draft commands.
2. Add optimistic draft revision and idempotency.
3. Issue maker-scoped private staging uploads.
4. Validate MIME, bytes, checksum and dimensions server-side.
5. Finalize and attach media transactionally.
6. Resume unfinished drafts after reload.
7. Detach media and queue reference-safe cleanup.
8. Add draft validation issues and seller-readable error codes.

Exit gate:

- seller creates, refreshes and resumes a real draft;
- another seller cannot read/attach/delete its media;
- retrying save/upload/submit is harmless;
- database rows and Storage objects remain consistent.

### C3 — Seller product management and moderation

Tasks:

1. Connect seller product list/detail to Supabase.
2. Add filters: Draft, In review, Live, Paused, Out of stock, Archived.
3. Connect lifecycle routes completed in CP3.4.
4. Add impact preview before delete/archive.
5. Add conflict recovery for stale product versions.
6. Add inventory history and simple finite-stock adjustment.
7. Add operator approve/reject product-version commands.
8. Add visible audit timeline.

Exit gate:

- seller can complete the full product lifecycle;
- only eligible drafts show permanent delete;
- published/referenced products remain historically readable;
- moderation is required before public publication.

### C4 — Buyer discovery and truthful sellability

Tasks:

1. Replace static catalog reads with `public.published_products`.
2. Connect search and product detail to canonical projections.
3. Use one sellability rule for gallery, Agent, detail and ordering.
4. Show unavailable reason and expected return date on direct pages.
5. Preserve unavailable product/version data inside historical orders.
6. Add empty/error/loading states and cursor pagination.
7. Keep collection banners and product media aspect-safe.

Exit gate:

- unavailable products cannot be newly ordered or recommended;
- direct historical links remain truthful;
- buyer, Agent and checkout agree on price/MOQ/lead time/availability.

### C5 — Persistent customization and quote request

Tasks:

Implementation checkpoint (2026-07-25):

- `Continue with this brief` now opens a dedicated quote review route instead
  of only closing the customization studio.
- Quantity, required date, notes and an idempotency request key survive refresh
  locally until submission.
- Migration `0020_submit_customization_quote.sql` is deployed to Supabase and
  adds the private customization asset bucket, normalized project/brief/quote
  links and one atomic authenticated submission RPC.
- The RPC creates one buyer project, approved brief, submitted quote item and
  buyer/seller thread; a repeated request key returns the existing request.
- Supabase Web3 Auth still has to be enabled in the project dashboard before a
  connected Rainbow wallet can create its authenticated Supabase session.
- Production Browser regression passes for product detail -> saved brief ->
  quote review. Wallet-signature submission remains a user-confirmed test.

1. Move customization state from local storage to Supabase.
2. Persist source assets, render batches/candidates and no-AI briefs.
3. Enforce maximum three render batches / nine candidates.
4. Select one immutable approved brief.
5. Collect quantity, deadline and delivery requirements.
6. Create one idempotent quote request from the brief.
7. Prevent ordering when product/version is no longer sellable.

Exit gate:

- refresh does not lose customization progress;
- AI and no-AI paths both create seller-readable briefs;
- one brief/request cannot create duplicate quotes.

### C6 — Seller quote inbox and buyer acceptance

Seller:

- incoming requests list;
- request/brief/media detail;
- feasibility accept/reject;
- price, deposit, lead time and expiry entry;
- immutable issued quote version.

Buyer:

- quote notification;
- clear price/deposit/deadline summary;
- accept, reject or request revision;
- address and terms confirmation.

Exit gate:

- seller issues a canonical quote;
- buyer acceptance creates one immutable order snapshot and invoice;
- expired/superseded quotes cannot create orders.

### C7 — Order center and buyer-seller messaging

Tasks:

1. Replace demo orders with participant-scoped Supabase reads.
2. Use shared canonical timeline with role-specific allowed actions.
3. Add one message thread per customization/order.
4. Add message attachments and read receipts.
5. Promote commitments into structured order transitions.
6. Add Agent summarize/translate/draft; sending still requires permission.
7. Add in-app and email milestone notifications.
8. Add idempotent retry/outbox tracking.

Exit gate:

- buyer and seller see the same order truth;
- seller can accept/update only allowed milestones;
- cross-order/cross-maker messages are denied;
- refresh preserves chat/history/read state.

### C8 — Arc Testnet payment, reconciliation and Order Proof NFT

Tasks:

1. Re-review the narrow `LoomonEscrow` contract against the final order states.
2. Keep one escrow per accepted order.
3. Deploy/verify factory and implementation on Arc Testnet.
4. Register contract version in Supabase.
5. Prepare exact USDC invoice/payment intent.
6. Support buyer wallet confirmation.
7. Verify receipt, amount, token, sender, recipient, chain and order server-side.
8. Project chain events idempotently into payment/order state.
9. Add cancellation/refund/dispute tests.
10. Deploy the non-transferable `LOOMON Order Proof` ERC-721 contract.
11. Mint exactly one proof after server-verified demo payment.
12. Reconcile the mint event idempotently and show it in Purchased.

Exit gate:

- quote acceptance -> invoice -> escrow -> fund -> tracked order passes E2E;
- wrong amount/token/chain/recipient/replay is rejected;
- UI never trusts a client-provided payment success flag.
- one verified order mints at most one proof and the buyer can inspect it;
- the UI states clearly that no physical delivery occurs in the demo.

### C9 — Personal Agent commerce tools

Tasks:

1. Replace static Agent catalog/order context with canonical services.
2. Add typed tools for search, brief, quote, order, cancellation and status.
3. Add bounded Agent-wallet delegation and simulation.
4. Require consent evidence for Agent order/payment/message actions.
5. Persist conversations, goals, tool calls and results.
6. Restore chat/history after reload.
7. Add event-driven order watch and reminders.
8. Add Agent evaluation cases for unavailable products, stale quotes,
   overspending, wrong recipient and message permission.

Exit gate:

- Agent can prepare and execute one permitted Testnet order;
- Agent cannot choose the product, exceed budget or silently message;
- every action traces from user request to tool result and audit record.

### C10 — Production deployment and pilot gate

Tasks:

1. Run clean database rebuild/migration tests.
2. Run typecheck, lint, unit, pgTAP, RLS, Foundry and Playwright suites.
3. Run Security/Performance Advisors.
4. Configure server secrets in Vercel production.
5. Deploy saved commit and run production smoke tests.
6. Test desktop/mobile and keyboard/screen reader behavior.
7. Test reminder retry, storage cleanup and failed payment recovery.
8. Document deployment evidence and operational rollback.

Required production smoke:

- buyer sign-in/profile/address;
- seller sign-in/shop selection;
- draft/create/upload/submit/publish;
- browse/customize/request quote;
- seller quote;
- buyer accept and Arc fund;
- buyer/seller chat;
- production milestone and completion;
- pause/archive listing without breaking history;
- unauthorized buyer/seller/Agent attempts denied.

Exit gate:

- one complete buyer/seller Arc Testnet order succeeds in production;
- no security findings or secret exposure;
- no demo/localStorage source of truth remains in the commerce path.

## 7. Test matrix

### Buyer

- anonymous private-route denial;
- profile/address ownership;
- unavailable product cannot be requested;
- AI and no-AI brief creation;
- duplicate quote/order/payment request;
- expired quote acceptance denial;
- order/chat participant isolation;
- cancellation by order state;
- historical listing remains readable inside order.

### Seller

- invitation and revoked membership;
- cross-maker draft/media denial;
- draft reload and optimistic conflict;
- permanent delete eligibility;
- pause/out-of-stock/archive behavior;
- reference impact accuracy;
- quote issue/revision/expiry;
- milestone transition legality;
- seller cannot mark an unpaid order as funded.

### Payment

- correct fund/release/refund;
- wrong chain/token/amount/recipient;
- replayed transaction;
- expired/cancelled invoice;
- Agent budget/allowlist/expiry/revoke;
- projector retry and duplicate event.

### Messaging/notification

- participant-only threads;
- attachment authorization;
- Agent draft without send;
- explicit send approval;
- reminder deduplication;
- email retry and consent removal.

## 8. UX acceptance rules

- use plain commerce language first; disclose Arc details progressively;
- never show success before the server confirms it;
- every async action has pending, success, failure and retry states;
- every destructive action explains what is removed and preserved;
- unavailable products explain why and what the buyer can do next;
- stale changes offer reload/review rather than silent overwrite;
- seller and buyer actions share one timeline but show role-appropriate controls;
- Agent actions are visible as actions, not hidden chat claims;
- all screens follow `design.md/`; no generic admin-dashboard redesign.

## 9. Deployment and rollback

Deployment order:

1. migrations and RLS tests;
2. generated types;
3. server domain commands;
4. route contracts;
5. UI wiring;
6. Agent tools;
7. contract registration/payment projector;
8. Vercel deployment;
9. production smoke.

Rollback principles:

- use forward-fix migrations after shared data exists;
- disable new route/UI features before removing data;
- pause Agent execution and payment creation independently;
- never delete order/payment/message history during rollback;
- retain old contract versions and mark them paused/retired;
- storage cleanup stays asynchronous and reference-safe.

## 10. Definition of done

LOOMON basic commerce is complete when:

- buyer and seller use real authenticated identities;
- seller can manage a real catalog and incoming requests;
- buyer can create a persistent brief and receive a quote;
- one accepted quote creates one immutable order and invoice;
- Arc Testnet payment reconciles server-side;
- buyer and seller can message and track one shared order;
- cancellation/dispute paths preserve money and history;
- Agent uses the same domain services and remains permission-bound;
- refresh does not lose drafts, chats, customization or order state;
- static fixtures/localStorage are no longer commerce sources of truth;
- all checkpoint gates and production smoke tests pass.

## 11. Immediate next action after approval

Begin only with C1:

1. design the smallest real auth flow;
2. add buyer profile/address foundation;
3. add open, audited seller/shop onboarding;
4. add explicit shop selection;
5. run auth/RLS tests;
6. stop for checkpoint review.

Do not connect the seller upload wizard until C1 passes. Do not deploy the Arc
contracts until the accepted quote/order snapshot is canonical in C6. Execute
the detailed NFT work through `docs/ARC-DEMO-NFT-ORDER-PROOF-PLAN.md`.
