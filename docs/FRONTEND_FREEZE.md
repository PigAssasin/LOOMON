# Frontend freeze review

Date: 2026-07-21  
Status: retained as a visual-system baseline; product flow is no longer frozen after the custom-souvenir pivot

## Freeze decision

The existing frontend remains the approved visual language and a useful marketplace/inspiration demo. The new upload-first custom-souvenir direction requires a new creation flow and may change route composition, information hierarchy and demo state. Reuse the design tokens, motion language, bottom navigation, cards and product-detail quality; do not treat the old marketplace flow as the current MVP specification.

## Verified

- Landing, discovery, product detail, store, profile, orders, order detail, and seller upload routes render without framework overlays or horizontal overflow.
- Desktop and 390 × 844 mobile layouts render correctly.
- Discovery search, collection filtering, product focus, buyer/seller order modes, profile editing, seller upload assistance, and order reminder preferences have working demo state.
- Product tiles never span multiple columns; wide tiles are normalized collections with dedicated banner assets.
- Runtime source uses only the approved design palette and contains no `box-shadow` declarations.
- Lint, TypeScript, unit tests, and production build pass.
- Application source and project documentation contain only LOOMON, Arc, and the dependencies explicitly approved for this project.

## Deferred by design

These items do not block the frontend freeze. They belong to the following platform phases:

1. Replace fixture and `localStorage` state with Supabase Auth, RLS-protected records, and Storage.
2. Configure a real WalletConnect project ID and production wallet policy.
3. Connect order, profile, follow, seller upload, collections, and reminder UI to canonical database records.
4. Add Playwright configuration and stable end-to-end tests for buyer, seller, wallet, order, and failure paths.
5. Complete keyboard, screen-reader, loading, empty, offline, wrong-network, pending-transaction, and server-error audits once real APIs exist.
6. Resolve production dependency advisories before release; the current wallet dependency tree contains transitive high-severity advisories.
7. Decide whether collections need dedicated public routes; the demo currently filters the discovery feed in place.

## Next execution sequence

### Gate A — Close Phase 0 contracts and decisions

- Product data dictionary and taxonomy v1.
- Seller ingestion and media limits.
- Quote/order/escrow state machine.
- Deposit, milestone, cancellation, refund, dispute, evaluator, and platform-fee policies.
- Agent tool permissions and wallet delegation boundaries.
- ADRs for contract ownership, upgradeability, pause/recovery, and settlement destination.

### Gate B — Verify Phase 2 database foundation

- Start Supabase locally and apply all migrations from an empty database.
- Reconcile the current consolidated migrations with the master-plan schema inventory.
- Add missing collection, delivery-attempt, agent-run, milestone, approval, and audit structures after the contracts are approved.
- Generate database types and add pgTAP/RLS tests.
- Seed normalized Vietnamese catalog data through the same ingestion path sellers will use.

### Gate C — Build and test the Arc contract

- Create a Foundry package and executable contract specification.
- Use Arc Testnet USDC through its ERC-20 interface for application transfers and allowances.
- Implement the approved physical-order escrow lifecycle, milestone accounting, refunds, disputes, fees, and events.
- Add unit, fuzz, invariant, authorization, replay, rounding, deadline, pause, and reentrancy tests.
- Deploy only to Arc Testnet after tests and threat review pass.

### Gate D — Backend and event projection

- Implement authenticated quote/order services and idempotent transition commands.
- Index contract events into Supabase with block/log identity deduplication and reconciliation.
- Add payment verification, reminder queue, email delivery, retries, and audit records.
- Expose typed buyer, seller, and agent APIs.

### Gate E — Integrate the frozen frontend

- Replace demo adapters one domain at a time without redesigning the screens.
- Add loading/error/wrong-network/pending states required by the real services.
- Run full buyer–seller–agent Arc Testnet E2E tests.
