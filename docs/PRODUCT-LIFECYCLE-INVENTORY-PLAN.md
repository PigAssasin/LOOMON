# LOOMON Product Lifecycle, Availability and Deletion Plan

Status: approved; CP1–CP3.4 complete, CP3.5 planned
Created: 2026-07-23
Parent plans:

- `docs/PLAN.md`
- `docs/CUSTOM-SOUVENIR-MVP-PLAN.md`
- `docs/PHASE-2-SUPERPOWERS-EXECUTION-PLAN.md`
- `codex.md`

## 1. Why this plan exists

LOOMON now has a real Supabase production database, but the seller product UI is still a frontend demonstration.

Current verified behavior:

- `src/features/seller/product-upload-wizard.tsx` stores draft fields and object URLs only in React state.
- “Submit for review” only sets `submitted = true`.
- Product images are browser object URLs and are not uploaded to Supabase Storage.
- No seller product-management list exists.
- No server action or API currently creates, updates, archives or deletes a product.
- The public gallery still reads the static `src/data/products.ts` dataset.
- The Personal Agent does not yet call product lifecycle tools.

Current database capability:

- `catalog.products.status` supports `draft`, `in_review`, `published`, `rejected`, and `archived`.
- Product versions and historical order references are structurally preserved.
- RLS exists for seller-owned catalog data.
- Search and public views require `products.status = 'published'`.

Current database gaps:

- no separate operational availability state;
- no finite inventory/reservation model;
- no stock or pause history;
- no safe product-delete RPC;
- no media/storage cleanup queue;
- no seller-facing lifecycle audit;
- no idempotent server API connecting the UI to database writes.

Therefore product creation and removal do not yet work end-to-end. The schema foundation is useful, but this workflow is not production-ready.

## 2. Alignment with the master plan

This work is a corrective extension to:

- `PLAN.md` section 4.2: immutable product versions;
- `PLAN.md` section 5: seller product upload and catalog management;
- `PLAN.md` section 5.7: draft/published/archived seller filters;
- `PLAN.md` section 6: search must filter commercial feasibility;
- `CUSTOM-SOUVENIR-MVP-PLAN.md` C2: normalized Supabase customization/catalog foundation.

It does not change these locked rules:

- orders and quotes keep exact historical product/version snapshots;
- published products are never physically deleted when referenced;
- editing published commercial data creates a new version;
- availability is deterministic database state, not an Agent guess;
- search projections are derived and rebuildable;
- the model cannot run arbitrary SQL;
- destructive actions require explicit seller confirmation.

## 3. Product state model

LOOMON must separate editorial lifecycle from operational sellability.

### 3.1 Editorial lifecycle

Keep `catalog.products.status` as the publication lifecycle:

```text
draft
-> in_review
-> published
-> archived

in_review -> rejected -> draft
published -> archived
archived -> published only through a validated restore operation
```

Meaning:

- `draft`: visible only to authorized maker members;
- `in_review`: locked against unsafe commercial edits while being reviewed;
- `published`: eligible for public display if also operationally available;
- `rejected`: seller must correct blocking issues;
- `archived`: permanently removed from discovery while history remains.

Do not add `out_of_stock` or `paused` to this column. Those are operational states and change without creating a new immutable product version.

### 3.2 Operational availability

Add `catalog.product_availability` as one current row per product:

- `product_id bigint primary key`;
- `status`: `available`, `paused`, `out_of_stock`, `discontinued`;
- `reason_code nullable`;
- `seller_note nullable`;
- `expected_available_at timestamptz nullable`;
- `updated_by uuid`;
- `version integer` for optimistic concurrency;
- `created_at`, `updated_at`.

Meaning:

- `available`: buyers and Agent may discover/order the product;
- `paused`: seller temporarily stops new orders without claiming inventory is zero;
- `out_of_stock`: product cannot accept a new order until replenished;
- `discontinued`: product is intentionally no longer sold; historical page may remain accessible to participants.

Effective public sellability:

```text
product.status = published
AND availability.status = available
AND published version is valid
AND maker is verified
AND at least one active sellable variant exists
```

### 3.3 Inventory tracking

Add `catalog.variant_inventory` only for variants that need stock tracking:

- `variant_id bigint primary key`;
- `tracking_mode`: `not_tracked`, `finite_stock`, `made_to_order`;
- `on_hand integer`;
- `reserved integer`;
- `safety_stock integer`;
- `available_to_sell` generated or computed as `on_hand - reserved - safety_stock`;
- `restock_expected_at timestamptz nullable`;
- `version integer`;
- timestamps.

Rules:

- `not_tracked`: no stock arithmetic; product availability still applies.
- `finite_stock`: order preparation reserves stock transactionally.
- `made_to_order`: commercial capacity is controlled by lead time/MOQ and availability, not fake stock counts.
- `reserved <= on_hand`.
- inventory quantities are integers and never negative.
- an order cannot reserve more than `available_to_sell`.
- cancellation releases an unused reservation idempotently.

### 3.4 Audit history

Add append-only tables:

#### `catalog.product_status_history`

- product;
- from/to editorial status;
- actor;
- reason;
- request/idempotency key;
- timestamp.

#### `catalog.product_availability_history`

- product;
- from/to availability;
- previous/new expected date;
- actor;
- source: seller, agent_confirmed, system;
- reason;
- request/idempotency key;
- timestamp.

#### `catalog.inventory_movements`

- variant;
- movement type: receive, reserve, release, sell, adjust;
- quantity delta;
- order/reference;
- actor;
- idempotency key;
- resulting quantities;
- timestamp.

History is never updated or deleted by sellers.

## 4. Delete, archive and media rules

“Delete product” in the UI must map to different safe operations based on product history.

### 4.1 Hard-delete a draft

A seller may permanently delete a product only when all conditions are true:

- product has never been published;
- status is `draft` or `rejected`;
- no quote, order, customization project, approved brief or Agent action references it;
- no other product/version shares the media object;
- actor has `owner`, `manager`, or `catalog_editor` role;
- seller explicitly confirms the product name;
- request carries an idempotency key.

The database transaction deletes relational draft rows and records a cleanup job for unreferenced storage assets.

Storage deletion happens asynchronously after the transaction. A failed object deletion is retried and does not resurrect the database product.

### 4.2 Archive a published or referenced product

A product is never hard-deleted if it has been published or referenced.

The seller action shown as “Remove from shop” performs:

1. lock product row;
2. verify seller role;
3. set editorial status to `archived`;
4. set availability to `discontinued`;
5. remove it from discovery/search projections;
6. append status and availability history;
7. preserve versions, media metadata, order snapshots, messages and payment references.

Existing order-detail links continue to resolve for authorized participants.

### 4.3 Pause selling

“Pause selling” changes only availability to `paused`.

- product disappears from normal discovery and Agent recommendations;
- existing orders continue normally;
- direct product page shows “Temporarily unavailable”;
- seller may set a reason and expected return date;
- “Resume selling” revalidates the published version and active variant before returning to `available`.

### 4.4 Mark out of stock

Seller can choose:

- manual `out_of_stock` for non-tracked or made-to-order products;
- automatic `out_of_stock` when every finite-stock variant has zero available-to-sell.

Restocking a finite variant does not silently republish an archived product. It may restore availability only when:

- editorial status is still `published`;
- maker remains verified;
- at least one variant becomes sellable;
- no manual pause/discontinue override exists.

### 4.5 Image removal

There are two different actions:

- “Remove from this draft”: detach media from the draft version.
- “Delete uploaded file”: allowed only if the asset is unreferenced everywhere and owned by the maker.

Published-version media remains immutable. Replacing a published image creates a new draft version and new media relation.

Unattached private staging uploads receive an expiration timestamp and are removed by an idempotent cleanup worker.

## 5. Database API contract

Do not let the browser perform a sequence of raw inserts/deletes across catalog tables.

Implement typed server operations backed by transaction-safe database functions:

### Seller commands

- `create_product_draft(input, idempotency_key)`
- `save_product_draft(product_id, expected_version, patch, idempotency_key)`
- `submit_product_for_review(product_id, idempotency_key)`
- `set_product_availability(product_id, status, reason, expected_available_at, expected_version, idempotency_key)`
- `archive_product(product_id, reason, idempotency_key)`
- `restore_archived_product(product_id, idempotency_key)`
- `delete_product_draft(product_id, confirmation, idempotency_key)`
- `adjust_variant_inventory(variant_id, movement, quantity, reason, expected_version, idempotency_key)`
- `detach_product_media(product_version_id, media_asset_id, idempotency_key)`

### Read models

- `list_seller_products(maker_id, lifecycle_filter, availability_filter, cursor)`
- `get_seller_product(product_id)`
- `get_product_lifecycle(product_id)`
- `get_product_inventory(product_id)`
- `get_product_reference_usage(product_id)`

### Agent tools

- `seller_list_products`
- `seller_prepare_availability_change`
- `seller_prepare_product_archive`
- `seller_prepare_draft_deletion`
- `seller_explain_product_blockers`

The Agent may explain and prepare these operations. It may pause, resume or mark stock status only after explicit seller confirmation in the current conversation. It may never silently delete/archive a product.

The Agent receives typed results such as:

```json
{
  "allowed": false,
  "reason_code": "PRODUCT_HAS_ORDER_REFERENCES",
  "recommended_action": "archive",
  "reference_counts": {
    "orders": 3,
    "customization_projects": 7
  }
}
```

## 6. Checkpoint execution plan

No checkpoint may begin until the prior checkpoint’s exit gate passes.

### CP0 — Confirm lifecycle decisions

Deliverables:

- approve the editorial/availability separation;
- approve draft-only hard delete;
- approve archive for published/referenced products;
- approve finite-stock versus made-to-order tracking;
- approve seller confirmation requirements.

Exit gate:

- this plan is approved by the product owner.

Rollback:

- documentation only; no database or production change.

### CP1 — Database migration and pgTAP RED tests

Owned files:

- `supabase/migrations/0009_product_lifecycle_inventory.sql`;
- `supabase/tests/database/0009_product_lifecycle_inventory.test.sql`.

Write failing tests first for:

- availability row defaults to `available`;
- invalid availability transition rejected;
- unauthorized maker user rejected;
- draft with no references can be deleted;
- published product hard delete rejected;
- referenced draft hard delete rejected;
- archive preserves product/version rows;
- paused/out-of-stock products disappear from public sellable projection;
- existing order references remain readable;
- duplicate idempotency key does not duplicate history;
- stale expected version causes conflict;
- inventory cannot become negative;
- reservation cannot exceed available-to-sell;
- cancellation releases one reservation exactly once;
- every new table has RLS;
- buyer cannot read seller-private notes/history.

Migration contents:

- availability, inventory and audit tables;
- FK/index coverage;
- constraints and transition functions;
- RLS policies;
- function execute grants;
- trigger/default availability creation;
- search/public projection update;
- domain-event/outbox rows for projection refresh and storage cleanup.

Exit gate:

- migration applies from clean database;
- pgTAP suite passes;
- Supabase Security Advisor has 0 findings;
- Performance Advisor has 0 warning/error findings.

Rollback:

- before production data: rebuild project from migrations;
- after shared data: forward-fix migration only.

### CP2 — Storage and media lifecycle

Owned files:

- private Supabase Storage bucket policies;
- upload-finalization server module;
- cleanup worker/function;
- media lifecycle tests.

Tasks:

1. Upload into maker-scoped private staging path.
2. Validate MIME, bytes, dimensions, checksum and ownership.
3. Create `media_assets` only after validation.
4. Attach media to a draft version transactionally.
5. Queue cleanup when media is detached/deleted.
6. Delete object only when reference count is zero.
7. Expire abandoned staging uploads.

Exit gate:

- another seller cannot read/delete the file;
- removing one shared reference does not delete the object;
- cleanup retries safely;
- no service-role key reaches the browser.

### CP3 — Server domain layer and generated types

Owned areas:

- `src/server/catalog/`;
- `src/domain/product-lifecycle.ts`;
- `src/lib/supabase/database.types.ts`;
- route handlers/server actions;
- unit/integration tests.

Tasks:

1. Generate types from deployed schemas.
2. Define Zod inputs/outputs and stable error codes.
3. Implement seller session and maker-role authorization.
4. Call transaction RPCs with idempotency and optimistic version.
5. Return reference counts before destructive actions.
6. Add structured audit logs without PII/secrets.

Exit gate:

- server integration tests pass against Supabase;
- no client route can mutate arbitrary maker IDs;
- retrying a request cannot duplicate product/history/inventory movement.

### CP4 — Connect product creation to Supabase

Owned areas:

- existing product upload wizard;
- seller product list/detail routes;
- draft autosave;
- upload progress and recovery.

Tasks:

1. Require authenticated seller/maker context.
2. Create a real draft on the first meaningful save.
3. Autosave validated patches with optimistic concurrency.
4. Upload images through the private media pipeline.
5. Resume an unfinished draft after reload.
6. Submit through the review RPC rather than local state.
7. Show canonical server validation errors.

Exit gate:

- refresh does not lose a draft;
- database rows and Storage assets match the UI;
- duplicate submit is harmless;
- seller A cannot see seller B’s draft.

### CP5 — Seller management UX

Routes:

- `/app/seller/products`;
- `/app/seller/products/[id]`.

Required controls:

- filters: Draft, In review, Live, Paused, Out of stock, Archived;
- per-product overflow menu;
- Edit draft;
- Pause/Resume selling;
- Mark out of stock/Restock;
- Remove from shop (archive);
- Delete draft;
- reference-impact preview before destructive action;
- availability reason and expected return date;
- inventory adjustment history for tracked variants.

UX rules:

- “Delete” appears only for eligible drafts.
- Published products use “Remove from shop”.
- Confirm dialog states exactly what is preserved and removed.
- Actions show pending/success/failure states and can be safely retried.
- Design follows `design.md/` without generic admin-dashboard styling.

Exit gate:

- Playwright seller lifecycle flow passes on desktop and mobile;
- keyboard and screen-reader labels pass;
- no optimistic UI claims success before server confirmation.

### CP6 — Discovery, product detail and Agent consistency

Tasks:

1. Replace static seller-created product reads with Supabase projections.
2. Exclude paused/out-of-stock/discontinued/archived products from normal discovery.
3. Direct URLs show an accurate unavailable state instead of 404 when appropriate.
4. Agent search uses the same effective-sellability view.
5. Agent cannot recommend or order an unavailable product.
6. Existing customization projects show a warning and require a new product if ordering is no longer possible.
7. Existing orders continue with the snapshotted product/version.

Exit gate:

- UI search, Agent search and checkout agree on availability;
- changing status invalidates relevant caches/projections;
- historical orders remain stable.

### CP7 — Production migration and verification

Sequence:

1. Run clean local database rebuild and pgTAP.
2. Run app typecheck, lint, unit and build.
3. Apply migration to the linked Supabase project.
4. Generate and commit database types.
5. Run Security and Performance Advisors.
6. Seed only missing defaults; never overwrite seller data.
7. Deploy web backend/frontend.
8. Run production smoke tests using dedicated test seller/product.
9. Verify audit/history and cleanup queues.
10. Update this plan and `PHASE-2-DEPLOYMENT-REPORT.md` with evidence.

Production smoke scenarios:

- create and reload draft;
- add and remove image;
- delete eligible draft;
- publish a test product;
- pause and resume;
- mark out of stock and restock;
- archive published product;
- confirm product disappears from discovery/Agent search;
- confirm historical reference remains;
- attempt unauthorized mutation and verify denial.

Exit gate:

- all scenarios pass;
- no security finding;
- no orphaned public asset;
- no historical order/reference broken.

## 7. Required test matrix

| Scenario | Expected result |
|---|---|
| Delete empty unreferenced draft | Product and draft-only relations deleted; media cleanup queued |
| Delete published product | Denied; archive offered |
| Delete referenced draft | Denied; archive offered when applicable |
| Pause live product | Removed from discovery; existing orders unchanged |
| Resume product | Revalidated before returning to discovery |
| Mark out of stock | New ordering blocked; direct page explains status |
| Restock finite variant | Availability recomputed without republishing archived product |
| Archive live product | Historical rows and order snapshots preserved |
| Seller A changes Seller B product | RLS/RPC denies |
| Retry same lifecycle command | One state change and one history record |
| Two concurrent inventory updates | One succeeds; stale version conflicts |
| Agent asks to delete without confirmation | Draft action only; no mutation |
| Uploaded image removed from one version | Shared object preserved while referenced |

## 8. Definition of done

- Product creation, upload, reload and submission use real Supabase data.
- Seller can clearly distinguish draft deletion, shop removal, pause and out-of-stock.
- Published/referenced products are never physically deleted.
- Inventory and reservations cannot go negative or double-apply.
- Discovery, product detail, checkout and Agent use the same sellability rule.
- RLS and transaction RPC tests cover every mutation.
- Storage cleanup is reference-safe and retryable.
- All lifecycle changes have immutable audit history.
- Supabase production migration, Advisor checks and E2E evidence are documented.

## 9. First implementation action after approval

Begin only with CP1:

1. write failing pgTAP lifecycle tests;
2. create migration `0009_product_lifecycle_inventory.sql`;
3. rebuild/test locally or on an isolated Supabase branch;
4. review Advisor output;
5. stop for checkpoint review before connecting UI.

Do not begin UI work or deploy production migration before CP1 is green.

## 10. Execution log

### 2026-07-23 — CP1 complete

- Applied `0009_product_lifecycle_inventory.sql` to Supabase project `tmrmvdqtkuoxforqulid`.
- Added separate editorial lifecycle, operational availability, variant inventory, append-only history, idempotency receipts and storage cleanup queue.
- Updated the public sellable-product projection so paused, out-of-stock, discontinued and finite-stock-empty products are excluded.
- Added transaction-safe RPCs for availability, archive, restore, draft deletion and inventory movements.
- Initial pgTAP run found an ambiguous parameter in the availability RPC.
- Applied forward-fix `0010_fix_availability_rpc_ambiguity.sql`.
- Final pgTAP result: 37/37 passed.
- Hardened all privileged lifecycle RPCs to `service_role` only through `0011_harden_product_lifecycle_rpc.sql`.
- Supabase Security Advisor: 0 findings.
- Supabase Performance Advisor: 0 warning/error findings.
- Remaining `unused_index` notices are informational on a new database.

CP2 must not expose the service-role key to the browser. Seller mutations will go through authenticated server routes.

### 2026-07-23 — CP2 complete

- Applied `0012_private_product_media_storage.sql`.
- Created private `product-media` bucket with a 10 MB limit.
- Accepted MIME types: JPEG, PNG and WebP.
- Added maker-scoped select/insert/update/delete Storage policies.
- Applied `0013_storage_cleanup_worker_rpc.sql`.
- Added retry-safe, `FOR UPDATE SKIP LOCKED` cleanup job claiming and exponential backoff.
- Deployed authenticated Supabase Edge Function `cleanup-product-media`, version 1, status `ACTIVE`.
- The worker uses Supabase-managed runtime secrets and never exposes the service-role key to the browser.
- Verified bucket privacy, limits and four Storage policies on production.

CP3 requires `SUPABASE_SERVICE_ROLE_KEY` in local/Vercel server-only environment plus a real Supabase Auth seller session. Neither may be substituted with a demo identity in production.

### 2026-07-23 — CP3 execution review

Status: approved for step-by-step execution by the product owner.

Verified starting state:

- the local server-only `SUPABASE_SERVICE_ROLE_KEY` exists, is Git-ignored, and passed both Supabase REST and Auth Admin checks with HTTP 200;
- `src/lib/supabase/database.types.ts` does not exist yet;
- the current Supabase browser/server clients are not typed;
- there is no authenticated seller session, middleware, maker-role authorization service, or catalog command layer;
- the seller upload wizard still stores draft state only in React memory/object URLs;
- discovery still reads the static `src/data/products.ts` fixture;
- CP1 and CP2 production database/storage foundations are already deployed and remain the source of truth.

CP3 is split into reviewable sub-checkpoints. Do not begin a later sub-checkpoint until the previous exit gate is recorded here.

#### CP3.1 — Generated database types and typed clients

Status: complete; awaiting product-owner checkpoint review.

Tasks:

1. Generate TypeScript types from the deployed LOOMON Supabase project.
2. Commit the generated schema as `src/lib/supabase/database.types.ts`.
3. Bind both browser and server Supabase clients to `Database`.
4. Add a server-only admin client that fails closed when its secret is unavailable.
5. Ensure no module imported by a Client Component can import the admin client.

Exit gate:

- generated types cover the deployed public API schema; private application
  schemas remain intentionally unavailable to browser/Data API clients and are
  accessed only through typed public RPC/domain boundaries;
- typecheck, lint, unit tests and build pass;
- the service-role key is absent from client output and Git;
- no product mutation or UI behavior changes in this checkpoint.

Rollback:

- revert only the generated type/client binding files; database remains unchanged.

#### CP3.2 — Authenticated seller and maker authorization

Status: complete; awaiting product-owner checkpoint review.

Tasks:

1. Add a server helper that resolves the Supabase user from signed cookies.
2. Resolve active maker membership from canonical membership tables.
3. Require an explicit maker role for seller operations.
4. Return stable `UNAUTHENTICATED`, `MEMBERSHIP_REQUIRED` and `FORBIDDEN` errors.
5. Add unit/integration coverage for missing, inactive and cross-maker access.

Exit gate:

- maker identity is derived server-side and never accepted from an untrusted browser field;
- seller A cannot obtain a command context for seller B;
- all authorization tests and baseline checks pass.

Rollback:

- remove the new server authorization modules/routes; no schema rollback.

#### CP3.2 verification evidence

- Added migration `0014_seller_auth_context.sql` with
  `public.get_my_seller_memberships()`.
- The RPC derives identity exclusively from `auth.uid()` and returns only active
  `owner`, `manager` or `catalog_editor` memberships.
- Anonymous execute permission is revoked; authenticated execution is explicit.
- Initial Advisor review correctly flagged the first `SECURITY DEFINER`
  implementation.
- Applied forward-fix `0015_harden_seller_auth_context.sql`; the function now
  uses `SECURITY INVOKER` and remains subject to membership/maker RLS.
- Added `src/domain/seller-access.ts` with stable
  `UNAUTHENTICATED`, `MEMBERSHIP_REQUIRED`, `MAKER_SELECTION_REQUIRED` and
  `FORBIDDEN` errors.
- Added `src/server/auth/seller-context.ts`; it resolves the user through
  `supabase.auth.getUser()` using signed request cookies, then resolves maker
  membership with the authenticated user client. It does not use the admin
  client and never accepts a browser-provided user ID.
- Cross-maker requests are denied; users managing multiple makers must select
  one explicitly instead of receiving an arbitrary default.
- pgTAP seller-auth suite: 8/8 passed.
- Seller-access unit tests: 5/5 passed.
- Supabase Security Advisor: 0 findings.
- Supabase Performance Advisor: 0 warning/error findings; fresh-project
  unused-index notices remain informational.
- Full app gate after implementation: typecheck, lint, unit tests and build
  passed.

Checkpoint decision:

- Stop before CP3.3.
- CP3.3 may begin only after the product owner reviews this checkpoint.

#### CP3.3 — Typed product lifecycle command layer

Status: complete; awaiting product-owner checkpoint review.

Tasks:

1. Add service-only actor-context wrappers around the existing lifecycle RPCs.
   The wrapper receives only the actor already verified by
   `resolveSellerContext`, sets the transaction-local JWT subject and delegates
   to the existing authorization/idempotency implementation. Never grant these
   wrappers to `anon` or `authenticated`.
2. Define Zod command/result contracts and stable lifecycle error mapping.
3. Implement server-only adapters for availability, archive, restore, draft deletion and inventory adjustment RPCs.
4. Enforce idempotency keys and optimistic versions at the command boundary.
5. Add reference-impact/read-model queries needed before destructive actions.
6. Emit structured logs containing IDs/error codes only, without PII or secrets.

Implementation discovery:

- The lifecycle RPCs were correctly hardened to `service_role` in migration
  `0011`, but they derive their actor from `auth.uid()`.
- A service-role API request has no seller subject, so calling those functions
  directly would always fail with `AUTH_REQUIRED`.
- Opening the `SECURITY DEFINER` functions to authenticated browser users is
  rejected because it weakens the intended server command boundary and would
  reintroduce Security Advisor findings.
- CP3.3 therefore requires a forward-only service wrapper migration. The
  server passes the seller ID obtained from the signed-cookie auth context; the
  wrapper sets it only transaction-locally, and the original functions retain
  their maker-role, idempotency, version and reference checks.

Exit gate:

- every mutation requires an authorized seller context;
- anonymous/authenticated roles cannot execute either original privileged RPCs
  or their actor-context wrappers;
- duplicate commands remain idempotent;
- stale version and reference blockers return typed errors;
- integration tests pass against the deployed schema.

Rollback:

- remove the command adapters; deployed RPCs remain dormant and service-role-only.

#### CP3.3 verification evidence

- Added migration `0016_service_product_command_wrappers.sql`.
  Service-only wrappers set the verified actor as a transaction-local JWT
  subject and delegate to the existing lifecycle RPCs.
- Added migration `0017_product_reference_impact.sql`.
  The read model reports quote, customization-project and order references,
  hard-delete eligibility and the safe recommended action.
- During adapter implementation, verified that a user may manage more than one
  maker and must not be able to accidentally execute against a different
  selected maker context.
- Applied forward-fix `0018_bind_commands_to_maker_context.sql`.
  Every service wrapper now requires `expected_maker_id` and verifies that the
  product or variant belongs to that exact maker before delegating.
- Original lifecycle RPCs and all server wrappers remain unavailable to
  `anon` and `authenticated`; only `service_role` can execute the wrappers.
- Added strict Zod command/result contracts and stable database-error mapping in
  `src/domain/product-lifecycle.ts`.
- Added the server-only command adapter
  `src/server/catalog/product-lifecycle-commands.ts` for:
  availability changes, archive, restore, draft deletion, inventory movement
  and product reference impact.
- Every command resolves the signed-cookie seller context before creating an
  admin client; actor IDs are never accepted from command input.
- Idempotency UUIDs and optimistic versions are required by the typed command
  boundary where applicable.
- Structured command logs contain only command name, maker/product/variant ID,
  request key, outcome and stable error code. They do not contain notes, email,
  PII, database details or secrets.
- Service wrapper pgTAP suite: 13/13 passed, including duplicate command,
  cross-user denial and selected-maker mismatch.
- Product reference-impact pgTAP suite: 7/7 passed.
- TypeScript unit tests: 5 files, 15 tests passed.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm run build`: pass, 68 pages generated.
- `git diff --check`: pass.
- Supabase Security Advisor: 0 findings.
- Supabase Performance Advisor: 0 warning/error findings.
- Production build scan: service-role secret not found.
- Production migrations confirmed:
  `service_product_command_wrappers`, `product_reference_impact`,
  `bind_commands_to_maker_context`.

Checkpoint decision:

- Stop before CP3.4.
- No browser route, Server Action or seller UI calls the privileged command
  layer yet.
- CP3.4 may begin only after the product owner reviews this checkpoint.

#### CP3.4 — Server route/action boundary

Status: complete; awaiting product-owner checkpoint review.

Tasks:

1. Expose one same-origin authenticated lifecycle command endpoint, one
   inventory command endpoint and one reference-impact read endpoint. Do not
   expose raw RPC names or actor IDs.
2. Validate strict JSON bodies, content type, body-size limit, route product ID
   consistency and reject unknown fields.
3. Require same-origin mutating requests and reject cross-site requests before
   parsing command data.
4. Map auth/domain/database failures to stable HTTP statuses and public error
   codes without returning database messages.
5. Revalidate seller list, discovery and affected product paths only after a
   confirmed mutation.
6. Verify arbitrary actor IDs and raw service RPCs are not exposed to the browser.

Exit gate:

- route contract tests pass;
- unauthorized and cross-maker calls are denied;
- retries cannot duplicate history or inventory movement;
- CP3 evidence is recorded before any seller UI is connected.

Rollback:

- remove the route/action boundary while retaining tested domain modules.

#### CP3.4 verification evidence

- Added strict public request contracts in
  `src/domain/product-lifecycle-api.ts`.
- Added same-origin lifecycle endpoint:
  `POST /api/seller/products/[productId]/lifecycle`.
- Added authenticated reference-impact endpoint:
  `GET /api/seller/products/[productId]/reference-impact`.
- Added same-origin inventory endpoint:
  `POST /api/seller/inventory`.
- Product ID is owned by the route path and rejected if also supplied through
  the strict body schema.
- Actor IDs, service RPC names and `agent_confirmed` audit sources are absent
  from browser request contracts.
- Agent-confirmed mutations remain reserved for a future internal Agent route
  with explicit consent evidence.
- Mutations require an exact same-origin `Origin`, JSON content type and a
  maximum 16 KiB body.
- Public error responses use stable codes/statuses and never return raw
  database messages.
- Successful product mutations revalidate seller, discovery and affected
  product paths; failed mutations do not invalidate caches or claim success.
- Added Route Handler tests for cross-site denial, unsupported content type,
  browser actor injection and successful seller-safe command forwarding.
- Vitest uses a test-only alias for Next's `server-only` marker; production
  server boundaries are unchanged.
- Route/domain test total: 7 files, 28 tests passed.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm run build`: pass, 69 pages generated including all three seller API
  routes.
- `git diff --check`: pass.
- Public route scan found no actor parameter, service-role environment
  reference or raw privileged RPC name.
- Client Component privileged-import scan: 0.
- Production build scan: service-role secret not found.

Checkpoint decision:

- Stop before CP3.5.
- The route boundary is implemented but intentionally unused by the current
  seller UI until draft/media commands and real seller authentication flows
  are ready.
- CP3.5 may begin only after the product owner reviews this checkpoint.

#### CP3.5 — Draft creation and private-media command foundation

This checkpoint is required before CP4. It was missing from the earlier
sequence and is now explicit.

Tasks:

1. Add transaction-safe `create_product_draft`, `save_product_draft` and
   `submit_product_for_review` server commands.
2. Add optimistic draft revision/version checks and idempotency receipts.
3. Add private staging-upload creation, validation/finalization, attachment and
   detach commands.
4. Prevent a seller from attaching another maker's asset or a browser-provided
   storage path that was not issued by the server.
5. Add draft recovery/read models required after refresh.
6. Add pgTAP/RLS/integration tests and regenerate shared types.

Exit gate:

- create/save/submit/reload works without the frontend performing raw table
  insert sequences;
- private media ownership and reference counts are enforced;
- retrying save/submit/finalize does not duplicate rows or attachments;
- no UI wiring begins before this checkpoint passes.

#### Buyer and seller product review before CP4

Buyer improvements required:

- unavailable products need a truthful direct-page state with reason and
  expected return date instead of disappearing or producing a generic 404;
- a paused product must never invalidate an existing order or approved brief;
- customization projects must retain the exact product-version snapshot and
  warn before checkout if the current listing is no longer sellable;
- Agent recommendations, gallery, product detail and checkout must use one
  effective-sellability rule;
- destructive seller changes must not erase images or facts a buyer needs to
  understand a historical order.

Seller improvements required:

- seller onboarding/auth and maker membership assignment are now the biggest
  functional prerequisite; the current UI has no real signed-in seller;
- separate language and controls for `Delete draft`, `Remove from shop`,
  `Pause selling` and `Out of stock` must remain explicit;
- show reference impact before archive/delete and explain what is preserved;
- show stale-version conflicts as “This product changed elsewhere” with a
  reload/review path, never silently overwrite;
- users managing multiple makers need an explicit shop selector;
- failed uploads and unfinished drafts need resumable recovery after refresh;
- every lifecycle action needs visible history, actor, reason and timestamp;
- role-based UI must hide or disable actions the current membership cannot
  perform, while the server remains authoritative.

Execution order after CP3:

- stop for product-owner checkpoint review;
- CP4 connects product creation, autosave and private media to the tested server boundary;
- CP5 adds lifecycle management UI;
- CP6 replaces static discovery/Agent availability reads;
- contract deployment remains a separate checkpoint after database-backed order/payment preparation and does not run implicitly during CP3.

#### CP3.1 verification evidence

- Generated `src/lib/supabase/database.types.ts` from project
  `tmrmvdqtkuoxforqulid` through the authenticated Supabase integration.
- Bound `src/lib/supabase/client.ts` and `src/lib/supabase/server.ts` to the
  generated `Database` type.
- Added `src/lib/supabase/admin.ts` with a `server-only` boundary, disabled
  browser-session behavior and fail-closed credential validation.
- Confirmed the service secret works from a backend identity: Supabase REST
  HTTP 200 and Auth Admin HTTP 200.
- Confirmed no Client Component imports the admin module and the only source
  reference to `SUPABASE_SERVICE_ROLE_KEY` is the server-only admin module.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm test`: 3 files, 4 tests passed.
- `npm run build`: pass, 68 pages generated.
- `git diff --check`: pass.

Checkpoint decision:

- Stop before CP3.2.
- CP3.2 may begin only after the product owner reviews this checkpoint.
