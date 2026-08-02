# Seller custom brief asset fix plan

Date: 2026-08-02

## Problem

Buyer can see the uploaded artwork and the selected AI-rendered custom product, but seller order views still show the default catalog product image or do not expose the same detailed brief. This breaks the core marketplace workflow: the maker cannot know what to produce.

## Expected flow

1. Buyer opens a product and clicks `Customize with agent`.
2. Buyer optionally uploads source artwork, optionally renders AI previews, selects one preview, writes note, quantity and needed date.
3. Buyer places the prepaid Arc order.
4. Seller sees the incoming order immediately.
5. Seller can click the order card and see:
   - source artwork uploaded by buyer;
   - selected custom/AI preview if buyer used AI render;
   - maker note / printed text / placement description;
   - quantity;
   - needed date;
   - order code and buyer display.
6. Seller order card preview must prefer the selected custom image, not the default product image.

## Root-cause checklist

- [x] Trace client submission payload from customization session.
- [x] Verify `submit_customization_quote` stores both source asset and selected preview asset.
- [x] Verify prepaid checkout/order creation copies the correct customization brief into `commerce.order_briefs`.
- [x] Verify production DB has the correct assets for `LM-26-08-1628D7` and `LM-26-08-25AB25`.
- [x] Verify seller brief asset endpoint currently fails with `401 Sign-in required`.
- [ ] Fix brief asset endpoint so the single demo seller wallet can read production brief assets without being blocked by a stale buyer Supabase auth session.
- [ ] Verify seller order list preview prioritizes custom selected preview.
- [ ] Verify seller order detail can be opened from both list and direct URL.

## Production finding 2026-08-02

The database is correct for the failing examples:

- `LM-26-08-1628D7` has `sourceAssetId`, `approvedAssetId`, and `selectedCandidateId`.
- `LM-26-08-25AB25` has `sourceAssetId`, `approvedAssetId`, and `selectedCandidateId`.

The live issue is the server endpoint:

```text
GET /api/orders/{orderId}/brief-assets?address=0xd59aa8db407d4219fe4b104ca4142df14301dec4
=> 401 Sign-in required
```

Because seller UI fetches this endpoint before rendering order card/detail assets, it falls back to the default product visual.

## Fix plan

### Step 1 — Make order brief asset lookup canonical

Create one server-side asset resolver that reads from:

1. `customization.briefs.source_asset_id`
2. `customization.briefs.selected_candidate_id`
3. `commerce.order_briefs.selected_render_candidate_id`
4. `commerce.quote_request_items.requested_configuration.sourceAssetId`
5. `commerce.quote_request_items.requested_configuration.assetId`
6. `customization.assets.metadata.assetPurpose`

This gives seller views a fallback path for orders created before the latest migration.

### Step 2 — Fix seller order detail routing

Allow `/app/orders/[reference]` to resolve by both:

- `order.reference`
- `order.id`

Order cards should navigate by stable order id where possible, but detail should support old links.

### Step 3 — Make seller detail a production brief

In seller detail, show a dedicated production brief block:

- selected custom preview first;
- original uploaded artwork second;
- note / printed text / artwork description;
- quantity;
- needed by;
- clickable full-size image links.

### Step 4 — Improve list card image consistency

Seller list card should use the same `/brief-assets` result and choose image in this order:

1. selected AI/custom preview;
2. uploaded artwork;
3. product image fallback.

### Step 5 — Validate

- Typecheck
- Lint
- Build
- Unit tests
- Secret scan
- Production deploy verification

## Important caveat

Orders created before the source/preview asset was saved may not contain the original source artwork. For those legacy orders, the resolver should still show any selected preview or uploaded artwork that exists in the database. New orders must store and show both.
