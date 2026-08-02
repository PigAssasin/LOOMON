# LOOMON Demo Polish Execution Plan

Date: 2026-08-02
Status: active sequential execution plan
Scope: production demo polish before final submission

## Execution status

- Checkpoint 1: implemented locally. History/Purchased now show clearer proof labels, token id and mint explorer links; Purchased uses order/custom preview image when available.
- Checkpoint 2: implemented locally. Frontend catalog is ceramic/tea/tableware only; public store list is single-seller Lò Mây; database migration `0044_demo_catalog_scope_and_chat_indexes.sql` archives old out-of-scope demo products and sets visible demo products to MOQ 1.
- Checkpoint 3: implemented locally. Order detail chat now supports wallet-scoped buyer/seller messages, emoji quick actions and image attachments through `/api/orders/[orderId]/messages`.
- Checkpoint 4: implemented locally. `/docs` route and landing Docs link are added.
- Checkpoint 5: partially implemented locally. Personal Agent reads live app state through the existing chat route and now prepares cancellation guidance instead of mutating orders directly. More structured action buttons can be added after the order-state checkpoint is stable.
- Checkpoint 6: partially implemented locally. Orders no longer force the old wallet verification screen, seller Incoming has only Accept/Reject, paid orders remain Requests/Incoming until seller acceptance, and escrow confirmation now validates against the connected wallet address instead of stale Supabase session.
- Checkpoint 7: partially implemented locally. Added order/chat indexes and catalog-scope migration; full Supabase remote migration verification still needs to be run after deployment.
- Checkpoint 8: in progress. Local typecheck, lint and build pass; README has been rewritten without secrets. Remote push/deploy still pending.

This plan follows the current LOOMON direction: a curated Vietnamese ceramic and tea-ware custom souvenir demo powered by Arc escrow, proof NFTs, Supabase, Gemini render, and a constrained commerce agent.

Rules for execution:

- Execute checkpoint by checkpoint. Do not start a later checkpoint before the previous checkpoint has a working implementation and local verification.
- Keep sensitive data out of GitHub: no `.env.local`, private keys, service role keys, Gemini keys, personal email, or wallet private material.
- Browser UI may request wallet signatures for onchain actions, but it must not expose debug banners or internal implementation noise.
- Supabase is canonical for offchain order/catalog/chat/profile data. Arc is canonical for escrow and proof settlement.
- Buyer/seller chat and agent messaging must never allow the agent to send on behalf of a human without explicit user action.

## Checkpoint 1 — Proof NFT demo polish

Goal: make successful orders feel provable and polished.

Tasks:

1. History rows show proof mint state clearly:
   - `Proof ready`, `Proof minted`, or `Proof unavailable`.
   - Show `tokenId` when known.
   - Show mint transaction hash in compact form.
2. Add Arc explorer links for:
   - escrow/order transaction;
   - proof NFT mint transaction.
3. Improve proof NFT metadata API/service:
   - product name;
   - seller display name and wallet;
   - buyer display name/wallet when safe;
   - order reference;
   - selected custom preview image when available;
   - fallback product image when no custom preview exists.
4. Profile/Purchased page displays proof NFTs:
   - image preview;
   - order reference;
   - product title;
   - token id;
   - explorer link.

Verification:

- `npm run typecheck`
- `npm run lint`
- Buyer history shows NFT proof data for confirmed orders.
- Purchased page loads without exposing private storage paths.

## Checkpoint 2 — Catalog cleanup and ceramic-only product set

Goal: make LOOMON demo product scope coherent. Current demo sells teapots, tea cups, bowls, ceramic tableware, vases, and tea sets only.

Remove/deprecate from frontend catalog:

- rattan/bamboo gift boxes;
- basket/woven/rattan-only products;
- pen holder / desk cup if it reads like stationery instead of ceramic drinkware;
- incense rest/burner if not part of current ceramic tea/tableware scope.

Tasks:

1. Replace product seed list with a curated ceramic-only list.
2. Normalize product titles, descriptions, categories and custom capabilities.
3. Keep single seller: Lò Mây.
4. Ensure all products have:
   - minimum quantity `1`;
   - USDC pricing;
   - ceramic/porcelain/stoneware material;
   - customization capability suitable for upload/text/custom print.
5. Update store list so only the relevant demo seller appears publicly unless another seller is deliberately needed later.
6. Re-check product links, product detail, custom flow, orders, and agent search results.

Verification:

- No visible product title/description contains rattan, basket, woven box, incense, pen holder, or unrelated craft categories.
- Product grid and search return only ceramic/tea/tableware products.

## Checkpoint 3 — Buyer/seller private chat

Goal: give buyer and seller a real order-scoped communication channel.

Tasks:

1. Use existing `messaging` schema when possible.
2. Add server routes for:
   - list/create order thread;
   - list messages;
   - send text message;
   - upload/send image attachment;
   - send emoji-only message.
3. Add UI entry from order cards/detail:
   - `Message buyer` for seller;
   - `Message seller` for buyer.
4. Chat UI requirements:
   - clean LOOMON dark style;
   - text composer;
   - emoji quick row;
   - image upload preview;
   - message timestamps;
   - sender side distinction.
5. Agent support:
   - agent can draft, translate, summarize;
   - agent cannot send message without user clicking send.

Verification:

- Buyer and seller can exchange messages on the same order.
- Uploaded images are stored privately or served by signed URL.
- Unauthorized wallet/user cannot read another order thread.

## Checkpoint 4 — Docs as a separate Vercel-backed section

Goal: add a clear documentation path from landing page for judges/users.

Tasks:

1. Add `Docs` link on landing header.
2. Create `/docs` route or separate docs app route inside the same Vercel project unless a separate Vercel project is explicitly required.
3. Docs content:
   - What LOOMON is;
   - Buyer flow;
   - Seller flow;
   - Agent capabilities and limitations;
   - Arc escrow flow;
   - Proof NFT flow;
   - Security/privacy notes;
   - Demo limitations.
4. Keep docs clean, readable, not overloaded with implementation jargon.

Verification:

- `/docs` loads on local and production.
- Landing header links to docs.

## Checkpoint 5 — Personal Agent commerce tools

Goal: make the green agent button useful for real app state, without giving it uncontrolled authority.

Required abilities:

1. “Where is my order?”:
   - agent reads real order workspace;
   - summarizes latest buyer/seller state.
2. “Cancel my latest order”:
   - agent identifies eligible order;
   - returns a typed intent;
   - UI guides user to sign the cancel/refund transaction.
3. “Find a product for this logo/image”:
   - agent searches curated ceramic catalog;
   - recommends products with reasons;
   - user must choose final product manually.
4. “Ask seller if they can make it faster”:
   - agent drafts a buyer-seller chat message;
   - user must click send.

Implementation rules:

- Agent returns structured app actions, not arbitrary code or direct signing.
- Agent cannot choose final product.
- Agent cannot send buyer/seller chat without confirmation.
- Agent cannot sign with user wallet.

Verification:

- Agent answers order status from actual data.
- Agent generates cancel/draft/search actions with safe buttons.

## Checkpoint 6 — Final order-state normalization and smooth realtime sync

Goal: stop state drift and remove visible reload feel.

Canonical state mapping:

- Buyer places paid order → Buyer `Requests`, Seller `Incoming`.
- Seller rejects → both `History`, refund/cancel state shown.
- Buyer cancels before seller accepts → both `History`, refund state shown.
- Seller accepts → Buyer `Active`, Seller `Active`.
- Buyer active has no cancel button.
- Seller active has `Mark delivered` and, when allowed, `Cancel/refund`.
- Seller marks delivered → Buyer active shows `Mint proof` or `Confirm received`.
- Buyer mints proof → both `History`, proof tx visible.

Tasks:

1. Consolidate status mapping into one shared function/module.
2. Add optimistic update after wallet tx receipt.
3. Use silent refresh/revalidation after chain projection.
4. Prevent tab resets during refresh.
5. Remove visible internal loading banners except scoped button states.

Verification:

- No full-page reload during accept/reject/cancel/deliver/mint.
- Buyer/seller see consistent state after each transaction.

## Checkpoint 7 — Database logic audit

Goal: ensure Supabase data model supports current demo cleanly and safely.

Tasks:

1. Audit order, proof, messaging, asset and profile tables/functions.
2. Check RLS policies:
   - participant-only access;
   - service-role-only server readers;
   - no broad public access to private assets/messages.
3. Check indexes on:
   - order buyer/seller/status lookups;
   - messaging thread/message lookups;
   - proof owner/order lookups;
   - wallet address lookups;
   - RLS helper predicate columns.
4. Add migration for missing indexes or narrow RPC fixes.
5. Add or update database tests where practical.

Verification:

- `npm run test`
- Supabase tests if local environment is available.
- Manual RPC review shows no sensitive leakage.

## Checkpoint 8 — Security and GitHub presentation

Goal: final submission repo is clean, understandable, and safe.

Security tasks:

1. Scan for secrets:
   - private keys;
   - Gemini/API keys;
   - Supabase service role key;
   - personal email;
   - hardcoded credentials.
2. Ensure `.env.example` uses placeholders only.
3. Ensure `.gitignore` excludes local env/build/log artifacts.
4. Review API routes for sensitive error leakage.
5. Ensure signed URLs are short-lived and never expose raw private paths unnecessarily.

Repository presentation tasks:

1. Update `README.md`:
   - product summary;
   - demo flow;
   - architecture;
   - Arc/Supabase/Gemini/Vercel roles;
   - local setup;
   - security note;
   - deployment link.
2. Add or update project docs index.
3. Ensure screenshots/assets used in README are non-sensitive.
4. Push final clean commit to GitHub.

Verification:

- `git status --short` reviewed.
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- Vercel production READY.
