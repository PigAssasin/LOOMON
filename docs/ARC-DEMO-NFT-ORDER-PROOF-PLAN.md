# LOOMON — Arc Demo Order Proof NFT Plan

Status: approved for execution by product owner
Date: 2026-07-25
Primary rulebook: `codex.md`
Master plan: `docs/PLAN.md`
Commerce sequence: `docs/BASIC-COMMERCE-COMPLETION-PLAN.md`

## 1. Goal

Turn LOOMON into an open Arc Testnet commerce demo:

```text
buyer or seller signs up freely
-> seller creates a shop and submits products
-> buyer chooses a product and customization
-> seller confirms the demo order
-> seller marks the demo order delivered
-> buyer confirms receipt
-> exactly one LOOMON Order Proof NFT is minted to the buyer wallet
-> the NFT appears in the buyer's Purchased area
```

No real payment is charged and no carrier delivery is verified in this phase.
The NFT records that the seller marked the demo order delivered and the buyer
explicitly confirmed receipt. It is not an independent delivery certificate,
title to a physical good, investment, warranty, or claim of authenticity.

## 2. Current behavior

- Buyer/seller surfaces are largely demo/local state.
- Seller database authorization and product lifecycle foundations exist.
- Arc Testnet escrow contracts exist and pass unit tests but are not deployed.
- Payment verification can inspect an Arc USDC transfer but is not yet bound to
  a canonical invoice/order and mint operation.
- There is no NFT contract, NFT database projection, mint job, or Purchased UI.
- Existing plans still contain invitation-only seller and physical-delivery
  assumptions that conflict with the new demo direction.

## 3. Target decisions

### 3.1 Open participation

- Any authenticated user can buy.
- Any authenticated user can create a maker/shop membership for themselves.
- Seller registration is open; public discovery is not unmoderated.
- New products remain `draft` or `in_review` until validation/publication gates
  pass, which prevents spam or unsafe content from becoming public.
- One account may be both buyer and seller. These are capabilities, not mutually
  exclusive account types.

### 3.2 NFT semantics

- Contract name: `LOOMON Order Proof`.
- Symbol: `LOOMON`.
- Standard: ERC-721-compatible receipt.
- Network: Arc Testnet, chain ID `5042002`.
- Mint rule: one token per canonical order ID.
- Recipient: the buyer's active Arc wallet captured in the accepted order.
- Mint authority: a dedicated platform minter; the language model never signs.
- Transfer policy: non-transferable after mint so proof cannot be resold as an
  order or delivery claim.
- Burn policy: no public burn in the demo.
- Metadata: on-chain JSON/SVG with no PII and no private user asset.
- On-chain fields: order hash, commercial snapshot hash, token ID, mint time.
- Product title, seller name, preview image, amount, and order reference remain
  private/controlled Supabase display data linked to the on-chain proof.

### 3.3 Visual design

The NFT follows `design.md/`:

- near-black `#0e100f` canvas;
- warm cream `#fffce1` typography;
- green-to-light-green Arc confirmation line;
- hairline `#42433d` frame;
- editorial `LOOMON` wordmark and `ORDER PROOF` label;
- large token number, abbreviated order hash, `ARC TESTNET`, and `DEMO` marker;
- no product photo or uploaded artwork is embedded on-chain.

The card must remain legible at wallet-thumbnail size and at a 1:1 detail view.

## 4. Canonical state model

### 4.1 Demo order

```text
seller_accepted -> in_progress -> seller_marked_delivered
-> buyer_confirmed_received
-> proof_pending -> proof_minted -> completed_demo
```

Failure/retry states:

```text
seller_accepted/in_progress -> cancelled
proof_pending -> proof_failed -> proof_pending
seller_marked_delivered -> delivery_disputed -> resolved
```

`completed_demo` means the seller declared delivery, the buyer explicitly
confirmed receipt, and proof minting succeeded. It does not certify
authenticity, legal title, product quality, or investment value.

### 4.2 NFT mint

```text
pending -> submitted -> confirmed
   |           |
   v           v
 failed <------+
```

Only the deterministic backend can advance mint state. Every retry reuses the
same order idempotency key and the contract rejects duplicate order hashes.

## 5. Normalized data design

Create `commerce.order_proof_nfts`:

- `id uuid primary key`;
- `order_id uuid not null unique references commerce.orders`;
- `owner_user_id uuid not null references auth.users`;
- `recipient_wallet_address text not null`;
- `chain_id bigint not null check = 5042002`;
- `contract_address text`;
- `token_id numeric(78,0)`;
- `order_hash text not null unique`;
- `snapshot_hash text not null`;
- `mint_status text not null`;
- `mint_transaction_hash text unique`;
- `block_number bigint`;
- `metadata_uri text`;
- `failure_code text`;
- `attempt_count integer not null default 0`;
- `idempotency_key uuid not null unique`;
- `submitted_at`, `confirmed_at`, `created_at`, `updated_at`.

Create append-only `commerce.order_proof_nft_events`:

- event identity, proof ID, event type, transaction hash, block/log position,
  payload hash, observed timestamp;
- unique `(chain_id, transaction_hash, log_index)` for replay safety.

Create `commerce.order_proof_nft_attempts`:

- one immutable submission row per mint transaction;
- attempt number, contract, transaction hash, status, failure code and timestamps;
- retries never overwrite the transaction history of earlier failed attempts.

Security:

- buyer reads only proofs they own;
- participating seller can read proof status through an order-safe projection,
  not the buyer's unrelated collection;
- anonymous users cannot read receipt rows;
- client roles cannot insert/update/delete mint records;
- service operations use a narrow security-definer command or server-only role;
- indexes cover owner collection, pending worker queue, and chain reconciliation.

## 6. Contract design

Add `contracts/src/LoomonOrderProof.sol` using a small audited-compatible
ERC-721 surface without external metadata storage:

1. admin sets/revokes the dedicated minter;
2. minter calls `mintOrderProof(recipient, orderHash, snapshotHash)`;
3. duplicate `orderHash` reverts;
4. zero recipient/hash values revert;
5. transfer/approval operations revert after mint;
6. `ownerOf`, `balanceOf`, `tokenURI`, ERC-165 and ERC-721 metadata interfaces
   remain wallet/indexer compatible;
7. token URI returns Base64 JSON and SVG;
8. events include token ID, recipient, order hash and snapshot hash.

Deployment uses a separate script and environment-provided testnet key. No key
is committed, logged, or passed through the model.

## 7. Application design

### Server services

- Build a pure proof-mint eligibility validator first.
- Bind eligibility to canonical order, seller delivery event, explicit buyer
  receipt confirmation, active buyer wallet, supported contract version, and
  absence of an existing proof.
- Submit mint only after deterministic validation.
- Reconcile the receipt/event before marking `confirmed`.
- Persist failure codes safe for retry and user display.

### API

- `GET /api/purchases/proofs` — authenticated owner's proof collection.
- `POST /api/orders/[orderId]/proof` — prepare/retry an eligible mint.
- No endpoint accepts a client-provided `minted: true` flag.

### UI

- Add `Purchased` to the buyer profile as a first-class section.
- Show pending, confirmed, and retry-safe failed states.
- Confirmed card shows product preview from Supabase, NFT token number,
  abbreviated order reference, `Arc Testnet`, and an explorer link.
- Demo copy explicitly says the proof is based on buyer confirmation and does
  not independently verify physical delivery.
- Empty state guides the buyer to choose a product.

## 8. Checkpoints

### N0 — Direction and plan lock

Status: complete.

- Record open buyer/seller participation.
- Replace physical-delivery completion with demo NFT completion.
- Add this plan to the master/current plans and rulebook.

Exit: documentation contains no invitation-only assumption for this demo.

### N1 — Contract TDD

Status: complete.

- Write failing tests for mint, duplicate prevention, minter authorization,
  non-transferability, metadata and interface support.
- Implement the smallest passing contract.
- Add deployment script and deployment output contract.

Exit: all Foundry tests pass.

Evidence:

- `contracts/test/LoomonOrderProof.t.sol`: 7/7 tests pass.
- Contract rejects unauthorized/duplicate/zero-value minting.
- Transfer and approval entry points revert.
- Metadata is Base64 JSON + SVG and advertises ERC-165/ERC-721 metadata.

Rollback: contract files only; no deployed state.

### N2 — Supabase migration and RLS

Status: complete.

- Write pgTAP/RLS tests first.
- Add normalized proof/event tables, constraints, indexes and policies.
- Add service command for prepare/submit/confirm/fail transitions.
- Regenerate TypeScript database types.

Exit: migration applies cleanly, pgTAP passes, security advisor has no errors.

Evidence:

- Migration `order_proof_nfts` is applied to Supabase project
  `tmrmvdqtkuoxforqulid`.
- Proof, event and attempt tables, four service commands, privileges, RLS and
  three participant policies were verified on the live project.
- Security Advisor: zero findings.
- Performance Advisor: INFO-only unused-index notices on an empty demo database;
  no WARN or ERROR.
- `supabase/tests/database/0019_order_proof_nfts.test.sql` contains the 19-case
  rollback suite for linked/local CI. The desktop connector cannot execute a
  multi-statement pgTAP file, so the live check used catalog/privilege/RLS
  assertions; the full file remains an N5 CI gate.

Rollback: do not delete confirmed proofs; before production use, migration may
be reverted by dropping only the new tables/functions/policies.

### N3 — Server orchestration

Status: complete.

- Write validator/service/route tests first.
- Implement eligibility, idempotent submission and collection queries.
- Keep signing behind an isolated server adapter.

Exit: wrong owner, wrong chain, unconfirmed receipt, duplicate order,
mismatched wallet and replay attempts all fail safely.

Evidence:

- Authenticated owner-only GET and mint routes are implemented.
- Proof hashes are derived server-side from the canonical order.
- The server requires a verified primary Arc wallet and the database requires a
  seller-delivered event followed by the participating buyer's receipt
  confirmation before preparing a proof.
- The isolated minter adapter waits for the Arc receipt, parses
  `OrderProofMinted`, reads `tokenURI`, and then confirms the database record.
- Missing signer configuration leaves a retry-safe pending proof.

Rollback: disable the mint route/worker while preserving proof rows.

### N4 — Purchased UI

Status: complete.

- Add tested proof-card view model.
- Add Purchased section to profile and connect the owner collection API.
- Add pending/confirmed/failed/empty states and explorer links.

Exit: desktop/mobile UI follows `design.md/`, preserves aspect ratio and clearly
labels Testnet/demo semantics.

Evidence:

- Profile now has real empty/loading/pending/failed/confirmed states.
- Confirmed proofs link to ArcScan and show the non-transferable/demo notice.
- UI uses the locked near-black/cream/green/hairline design tokens.
- Domain tests: 3/3 pass; complete TypeScript suite: 31/31 pass.

Rollback: hide the section; data and NFT remain intact.

### N5 — Arc Testnet deployment and E2E

Status: contract deployed; updated Production runtime and two-wallet
end-to-end order mint are pending.

- Re-verify Arc network values from official docs.
- Deploy proof contract and escrow factory.
- Record verified addresses/version in Supabase.
- Run one test order from seller delivery and buyer receipt confirmation to NFT
  mint.
- Confirm ownership/tokenURI on RPC and display in Purchased.

Exit: exactly one NFT exists for the test order and explorer/RPC/UI agree.

Deployment evidence:

- Contract: `0x761202b708B2C76c300901f7ed93Ad941e9b25D6`.
- Transaction:
  `0x99922e8341e1a3daa32b0a3874c2055cef85dd5ea30385244d49f5449564b067`.
- Block: `53529846`.
- RPC verification: 6,492 bytes of code, name `LOOMON Order Proof`, symbol
  `LOOMON`, admin/minter equal the configured Testnet signer.
- Version `1.0.0` is active in `payments.contract_versions`.
- Local application address is configured through
  `LOOMON_ORDER_PROOF_ADDRESS`.
- Vercel Production contains the contract address and the isolated sensitive
  minter secret; the deployer key remains local-only. The server-only Supabase
  service-role credential still requires explicit production authorization.
- The previous production deployment is aliased to
  `https://loomon.vercel.app`; the delivery-gated runtime has not been released
  until all required server secrets are present.
- Production smoke checks: `/`, `/app`, and `/app/profile` return `200`;
  unauthenticated `/api/purchases/proofs` returns `401`; `GET` against the
  POST-only order proof endpoint returns `405`.
- Verification after deployment: TypeScript/Vitest `31/31` pass; Foundry
  `13/13` pass; Vercel reports no Production runtime errors in the checked
  30-minute window.

Remaining N5 work:

- Create a real authenticated buyer, verified Arc wallet, quote and canonical
  order through the application flow.
- Seller marks it delivered and the same buyer explicitly confirms receipt.
- Mint its proof, reconcile the event and confirm it appears in Purchased.

Rollback: freeze the platform minter and point new orders to a corrected version;
already minted proofs remain immutable.

## 9. Verification matrix

- Foundry: authorized mint, unauthorized mint, duplicate order, zero values,
  transfer rejection, approval rejection, tokenURI JSON/SVG, ERC-165.
- Database: owner read, cross-user denial, anonymous denial, client-write denial,
  service transition validity, duplicate/replay rejection, queue index.
- TypeScript: validator and serialization tests.
- Routes: auth, ownership, eligibility, idempotency, safe failure response.
- UI: empty/pending/confirmed/failed cards, mobile layout, keyboard focus,
  reduced motion, valid explorer URL.
- Full repo: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## 10. Execution order

1. N0 documentation.
2. N1 contract TDD.
3. N2 database TDD and real Supabase deployment.
4. N3 server orchestration without exposing signer secrets.
5. N4 Purchased UI.
6. N5 deploy contracts, register addresses, and execute one E2E mint.

No later checkpoint may weaken the invariant:

`one buyer-confirmed delivered demo order -> at most one non-transferable Arc Order Proof NFT`.
