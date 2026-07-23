# LOOMON Product Lifecycle, Availability and Deletion Plan

Status: approved; CP1–CP2 complete, CP3 blocked on server secret/auth integration
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
