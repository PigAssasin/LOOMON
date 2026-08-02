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

- [ ] Trace client submission payload from customization session.
- [ ] Verify `submit_customization_quote` stores both source asset and selected preview asset.
- [ ] Verify prepaid checkout/order creation copies the correct customization brief into `commerce.order_briefs`.
- [ ] Verify brief asset endpoint returns the same assets to both buyer and seller wallets.
- [ ] Verify seller order list preview prioritizes custom selected preview.
- [ ] Verify seller order detail can be opened from both list and direct URL.

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
