# LOOMON â€” Phase 2 Supabase Database, Arc Contract and Agent Wallet Execution Plan

Status: deferred marketplace execution plan; do not execute before the custom-souvenir MVP validation gates in `docs/CUSTOM-SOUVENIR-MVP-PLAN.md`
NgÃ y: 2026-07-22
PhÆ°Æ¡ng phÃ¡p: Superpowers â€” brainstorm â†’ isolation â†’ plan â†’ TDD â†’ critical review â†’ verified completion
Nguá»“n yÃªu cáº§u: `codex.md`, `docs/PLAN.md`, `docs/PHASE-2-DATABASE-CONTRACT-PLAN.md`, `docs/contract-order-lifecycle.md`

## 1. Káº¿t quáº£ cuá»‘i cÃ¹ng cá»§a Phase 2

Phase 2 táº¡o ná»n mÃ³ng dá»¯ liá»‡u vÃ  thanh toÃ¡n cÃ³ thá»ƒ kiá»ƒm chá»©ng cho LOOMON:

1. Supabase Postgres Ä‘Æ°á»£c dá»±ng láº¡i hoÃ n toÃ n tá»« migration vÃ  seed trong repository.
2. Dá»¯ liá»‡u sáº£n pháº©m, seller, buyer, quote, order, wallet, Agent vÃ  payment Ä‘Æ°á»£c chuáº©n hÃ³a ngay tá»« Ä‘áº§u.
3. Má»—i quote/order giá»¯ Ä‘Ãºng phiÃªn báº£n sáº£n pháº©m, giÃ¡ vÃ  Ä‘iá»u khoáº£n táº¡i thá»i Ä‘iá»ƒm giao dá»‹ch.
4. Má»—i Agent cÃ³ Arc smart account riÃªng vÃ  chá»‰ hÃ nh Ä‘á»™ng trong delegation cÃ³ giá»›i háº¡n.
5. Arc escrow contract quáº£n lÃ½ USDC theo tá»«ng Ä‘Æ¡n, milestone, refund vÃ  dispute.
6. Supabase chiáº¿u tráº¡ng thÃ¡i onchain báº±ng projector idempotent; khÃ´ng tin cá» `success` tá»« client.
7. RLS ngÄƒn buyer, seller hoáº·c Agent truy cáº­p dá»¯ liá»‡u ngoÃ i pháº¡m vi Ä‘Æ°á»£c cáº¥p.
8. Database, contract vÃ  projector cÃ³ test tá»± Ä‘á»™ng trÆ°á»›c khi triá»ƒn khai Arc Testnet.

Phase 2 khÃ´ng bao gá»“m:

- mainnet deployment;
- redesign frontend Ä‘Ã£ freeze;
- custody khÃ´ng giá»›i háº¡n Ä‘á»‘i vá»›i tiá»n cá»§a khÃ¡ch hÃ ng;
- cho model truy cáº­p private key hoáº·c calldata tÃ¹y Ã½;
- tá»± Ä‘á»™ng giáº£i quyáº¿t dispute báº±ng Agent Ä‘Ã£ Ä‘áº¡i diá»‡n buyer hoáº·c seller.

## 2. CÃ¡ch Superpowers Ä‘Æ°á»£c Ã¡p dá»¥ng

### Brainstorm vÃ  khÃ³a giáº£ Ä‘á»‹nh

- XÃ¡c Ä‘á»‹nh source of truth cho tá»«ng loáº¡i dá»¯ liá»‡u trÆ°á»›c khi táº¡o table.
- TÃ¡ch dá»¯ liá»‡u canonical, snapshot, projection, audit vÃ  cache.
- Chá»‘t money model, order lifecycle, Agent delegation, resolver vÃ  upgrade policy trÆ°á»›c khi code.
- Má»i Ä‘iá»ƒm chÆ°a chá»‘t Ä‘Æ°á»£c ghi thÃ nh ADR; khÃ´ng giáº¥u quyáº¿t Ä‘á»‹nh trong migration hoáº·c contract.

### Isolation

- Táº¡o branch `codex/phase-2-database-contract` hoáº·c Git worktree riÃªng.
- Ghi láº¡i commit frontend baseline trÆ°á»›c khi thay migration prototype.
- KhÃ´ng sá»­a database remote trong lÃºc thiáº¿t káº¿ vÃ  test local.
- KhÃ´ng cháº¡y `supabase db reset --linked` trÃªn báº¥t ká»³ project cÃ³ dá»¯ liá»‡u tháº­t.

### Plan theo task nhá»

- Má»—i checkpoint cÃ³ file cá»¥ thá»ƒ, test cá»¥ thá»ƒ, Ä‘iá»u kiá»‡n pass/fail vÃ  rollback.
- Má»—i task chá»‰ sá»Ÿ há»¯u má»™t domain hoáº·c má»™t state transition.
- KhÃ´ng gom catalog, commerce, wallet vÃ  payment vÃ o má»™t migration khá»•ng lá»“.

### TDD

- Database: viáº¿t pgTAP test fail trÆ°á»›c, sau Ä‘Ã³ viáº¿t migration/RPC nhá» nháº¥t Ä‘á»ƒ test pass.
- Contract: viáº¿t Forge unit/fuzz/invariant test fail trÆ°á»›c, sau Ä‘Ã³ viáº¿t Solidity nhá» nháº¥t Ä‘á»ƒ pass.
- Projector: viáº¿t fixture event vÃ  idempotency test trÆ°á»›c khi viáº¿t consumer.
- Má»i lá»—i tiá»n hoáº·c quyá»n truy cáº­p pháº£i cÃ³ negative test.

### Critical review

- Review schema drift, FK thiáº¿u index, RLS bypass, JSONB láº¡m dá»¥ng, transaction lock dÃ i.
- Review contract accounting, replay, reentrancy, operator expiry, nonce vÃ  stuck-fund path.
- So diff vá»›i plan; thay Ä‘á»•i ngoÃ i scope pháº£i tÃ¡ch PR hoáº·c cÃ³ ADR.

### Verified completion

- KhÃ´ng Ä‘Ã¡nh dáº¥u checkpoint hoÃ n táº¥t chá»‰ vÃ¬ code compile.
- Pháº£i cháº¡y Ä‘Ãºng lá»‡nh verification, lÆ°u káº¿t quáº£ vÃ  Ä‘Ã¡p á»©ng exit gate.
- Phase 2 chá»‰ hoÃ n táº¥t sau E2E trÃªn Arc Testnet vÃ  reconciliation báº±ng 0.

## 3. CÃ¡c quyáº¿t Ä‘á»‹nh pháº£i khÃ³a trÆ°á»›c khi triá»ƒn khai

| MÃ£ | Quyáº¿t Ä‘á»‹nh Ä‘á» xuáº¥t | LÃ½ do |
|---|---|---|
| ADR-001 | Supabase Postgres lÃ  canonical authority cho catalog vÃ  nghiá»‡p vá»¥ offchain. | Dá»… query, RLS vÃ  audit; khÃ´ng Ä‘Æ°a PII lÃªn chain. |
| ADR-002 | Arc contract lÃ  canonical authority cho escrow custody vÃ  settlement. | KhÃ´ng cho server/client tá»± tuyÃªn bá»‘ Ä‘Ã£ thanh toÃ¡n. |
| ADR-003 | Tiá»n dÃ¹ng integer atomic/minor unit; USDC dÃ¹ng 6 decimals. | KhÃ´ng cÃ³ sai sá»‘ float/numeric conversion. |
| ADR-004 | `bigint identity` lÃ  internal PK; UUID opaque lÃ  public ID. | Index locality tá»‘t, khÃ´ng lá»™ ID tuáº§n tá»± ra API. |
| ADR-005 | Catalog dÃ¹ng stable identity + immutable published version. | Agent, quote vÃ  order luÃ´n trá» Ä‘Ãºng dá»¯ kiá»‡n lá»‹ch sá»­. |
| ADR-006 | Má»™t non-upgradeable escrow clone cho má»—i order, táº¡o bá»Ÿi versioned factory. | CÃ´ láº­p tiá»n vÃ  khÃ³a code version cá»§a Ä‘Æ¡n Ä‘ang cháº¡y. |
| ADR-007 | Platform multisig lÃ  resolver ban Ä‘áº§u. | Agent Ä‘Ã£ Ä‘áº¡i diá»‡n má»™t bÃªn khÃ´ng Ä‘Æ°á»£c phÃ¢n xá»­. |
| ADR-008 | Buyer, maker vÃ  platform Agent dÃ¹ng ba loáº¡i smart account riÃªng. | KhÃ´ng dÃ¹ng omnibus wallet cÃ³ quyá»n quÃ¡ rá»™ng. |
| ADR-009 | Agent máº·c Ä‘á»‹nh `execute_limited`; `managed_commerce` pháº£i opt-in theo order. | Tá»± Ä‘á»™ng sÃ¢u nhÆ°ng váº«n kiá»ƒm soÃ¡t ngÃ¢n sÃ¡ch vÃ  ngoáº¡i lá»‡. |
| ADR-010 | Model chá»‰ táº¡o typed intent; policy/risk gateway vÃ  isolated signer má»›i kÃ½. | Prompt khÃ´ng thá»ƒ trá»Ÿ thÃ nh signing authority. |
| ADR-011 | Tá»‘i Ä‘a 8 milestones; tá»•ng milestone pháº£i Ä‘Ãºng báº±ng escrow total. | Bound gas vÃ  giá»¯ accounting cÃ³ thá»ƒ chá»©ng minh. |
| ADR-012 | Review timeout chuyá»ƒn cho buyer/resolver, khÃ´ng tá»± payout vÃ´ Ä‘iá»u kiá»‡n. | TrÃ¡nh máº¥t tiá»n khi evidence chÆ°a Ä‘á»§. |

Náº¿u má»™t ADR chÆ°a Ä‘Æ°á»£c duyá»‡t, checkpoint phá»¥ thuá»™c vÃ o ADR Ä‘Ã³ á»Ÿ tráº¡ng thÃ¡i `BLOCKED`; khÃ´ng tá»± chá»n ngáº§m trong code.

## 4. Ranh giá»›i authority

| Dá»¯ liá»‡u / hÃ nh Ä‘á»™ng | Canonical authority | Báº£n sao Ä‘Æ°á»£c phÃ©p |
|---|---|---|
| Profile, email, address, locale | Supabase | Snapshot mÃ£ hÃ³a trong order; khÃ´ng plaintext onchain. |
| Maker membership vÃ  verification | Supabase | Public seller projection. |
| Product, taxonomy, media, customization | Supabase | Search document cÃ³ thá»ƒ rebuild. |
| Quote vÃ  accepted commercial terms | Supabase | Terms hash trÃªn Arc. |
| Operational order state | Supabase | Pháº£i phÃ¹ há»£p event onchain finalized má»›i nháº¥t. |
| USDC escrow, released, refunded, claimable | Arc contract | Projection read model trong Supabase. |
| Agent delegation | Owner signature + policy store | Policy hash/expiry/nonce cáº§n thiáº¿t trÃªn contract. |
| Agent intent, simulation, risk decision | Append-only Supabase audit | Transaction/userOp hash trÃªn Arc. |
| Shipping, message, evidence file | Supabase/Storage | Chá»‰ checksum/hash cáº§n thiáº¿t lÃªn chain. |

Quy táº¯c cá»©ng:

- Browser khÃ´ng Ä‘Æ°á»£c ghi trá»±c tiáº¿p tráº¡ng thÃ¡i paid/released/resolved.
- Webhook khÃ´ng Ä‘Æ°á»£c tin náº¿u chÆ°a verify receipt/log trÃªn Arc.
- Agent khÃ´ng Ä‘Æ°á»£c táº¡o hoáº·c má»Ÿ rá»™ng delegation cá»§a chÃ­nh nÃ³.
- External call khÃ´ng cháº¡y trong lÃºc giá»¯ database row lock.
- Má»i command retry Ä‘Æ°á»£c pháº£i cÃ³ idempotency key.
- Má»i chain event unique theo `(chain_id, transaction_hash, log_index)`.
- Má»i payout dÃ¹ng pull pattern; admin khÃ´ng cÃ³ Ä‘Æ°á»ng rÃºt escrow cá»§a khÃ¡ch hÃ ng.

## 5. Kiáº¿n trÃºc Ä‘Ã­ch

```mermaid
flowchart LR
  Web["Next.js buyer/seller app"] --> API["Typed application commands"]
  Agent["Commerce Agent"] --> Intent["Typed Agent intent"]
  API --> DB["Supabase canonical schemas"]
  Intent --> Gate["Delegation + policy + risk gateway"]
  DB --> Gate
  ArcRead["Finalized Arc state"] --> Gate
  Gate --> Sim["Transaction simulation"]
  Sim --> Approval["Human approval when required"]
  Sim --> Signer["Isolated Agent signer"]
  Approval --> Signer
  Signer --> AA["ERC-4337 bundler/paymaster"]
  API --> UserWallet["Embedded wallet / RainbowKit"]
  UserWallet --> Escrow["LoomonOrderEscrow"]
  AA --> Escrow
  Factory["LoomonEscrowFactory"] --> Escrow
  Escrow --> Indexer["Arc log indexer"]
  Indexer --> Projector["Idempotent projector"]
  Projector --> DB
  DB --> Outbox["Outbox/jobs/reminders"]
```

## 6. Chuáº©n hÃ³a database tá»« Ä‘áº§u

### 6.1 NguyÃªn táº¯c chuáº©n hÃ³a

- Canonical OLTP tables Ä‘áº¡t Ã­t nháº¥t 3NF; khÃ´ng láº·p seller, product, price hoáº·c address text trong nhiá»u báº£ng mutable.
- Stable identity vÃ  immutable version lÃ  hai lá»›p khÃ¡c nhau.
- N:M luÃ´n cÃ³ join table vÃ  unique constraint Ä‘Ãºng business key.
- Má»i FK cÃ³ index phÃ¹ há»£p; Postgres khÃ´ng tá»± táº¡o index cho FK.
- JSONB chá»‰ dÃ¹ng cho bounded provider payload, immutable rendering snapshot hoáº·c metadata khÃ´ng dÃ¹ng lÃ m business authority.
- Field Agent cáº§n filter/rank/join pháº£i lÃ  column hoáº·c normalized row, khÃ´ng chÃ´n trong JSON.
- Enum cÃ³ lifecycle á»•n Ä‘á»‹nh dÃ¹ng Postgres enum; táº­p giÃ¡ trá»‹ cáº§n má»Ÿ rá»™ng báº±ng dá»¯ liá»‡u dÃ¹ng lookup table/code.
- DÃ¹ng `timestamptz`, lowercase `snake_case`, `text`, `boolean`, `bigint` phÃ¹ há»£p.
- Dá»¯ liá»‡u tiá»n khÃ´ng dÃ¹ng float; amount vÃ  decimals luÃ´n tÃ¡ch rÃµ.
- Soft delete chá»‰ dÃ¹ng nÆ¡i cáº§n retention; immutable history khÃ´ng update/delete tá»« client.
- Derived statistics, search documents vÃ  chain projections luÃ´n rebuild Ä‘Æ°á»£c.

### 6.2 Schema map

| Schema | TrÃ¡ch nhiá»‡m | Browser access |
|---|---|---|
| `public` | Safe views vÃ  narrow RPC commands | CÃ³ RLS/grant rÃµ rÃ ng. |
| `identity` | Profile, address, preferences | Qua public API/RPC. |
| `makers` | Maker, membership, verification, social | Qua projections/RPC. |
| `catalog` | Product, version, taxonomy, options, pricing, media, collection, ingestion | Read published projection; write qua command. |
| `commerce` | Requirement, quote, order, milestone, shipping, dispute | Chá»‰ participant theo RLS. |
| `wallet` | Linked account, smart account, delegation, session-key reference | Owner-scoped. |
| `agent` | Identity, run, intent, simulation, approval, budget, audit | Initiator/owner-scoped. |
| `payments` | Intent, tx, contract registry, event, projection, reconciliation | Read own order projection. |
| `search` | Rebuildable product documents vÃ  jobs | Published product only. |
| `notifications` | Preferences, reminders, delivery attempts | Owner-scoped. |
| `internal` | Outbox, worker jobs, idempotency, audit, roles | Server-only. |

### 6.3 Identity vÃ  maker

Core tables:

- `identity.profiles`: PK/FK `auth.users.id`, display name, locale, timezone, profile state.
- `identity.profile_emails`: verified email source, notification eligibility; khÃ´ng cho Agent tá»± thay Ä‘á»•i.
- `identity.addresses`: owner, normalized country/region/locality/postal fields, encrypted sensitive fields, label, validity.
- `identity.user_preferences`: currency display, language, notification defaults.
- `makers.makers`: stable organization identity, public ID, slug, verification state.
- `makers.profile_versions`: immutable public seller story/version.
- `makers.profile_localizations`: version + locale + display/bio.
- `makers.memberships`: maker + user + role + validity; unique má»™t membership active.
- `makers.verifications`: type, evidence reference, reviewer, result, validity.
- `makers.follows`: user + maker unique.
- `makers.reviews`: order eligibility, rating dimensions, moderation state.
- `makers.statistics`: rebuildable projection; khÃ´ng pháº£i nguá»“n sá»± tháº­t.

Constraints quan trá»ng:

- email verified khÃ´ng Ä‘Æ°á»£c suy ra tá»« input client;
- má»™t maker slug active lÃ  unique case-insensitive;
- review chá»‰ Ä‘Æ°á»£c táº¡o cho buyer/order Ä‘Ã£ settled vÃ  chÆ°a review;
- rating náº±m trong pháº¡m vi Ä‘Ã£ Ä‘á»‹nh;
- seller stats Ä‘Æ°á»£c tÃ­nh tá»« order/review canonical rows.

### 6.4 Catalog tá»‘i Æ°u cho Agent

Identity/version tables:

- `catalog.products`: maker, stable product code, lifecycle, current draft/published version pointer.
- `catalog.product_versions`: immutable sau publication, version number, product type, made-to-order flags, MOQ, lead-time range, provenance completeness.
- `catalog.product_localizations`: version + locale + title/summary/description/care text.
- `catalog.variants`: version + stable option combination + SKU + availability.
- `catalog.variant_localizations`: localized variant label.

Commercial facts:

- `catalog.price_rules`: version/variant, currency, unit amount minor, min/max quantity, effective window.
- `catalog.dimensions`: named dimension, value minor unit, unit code, tolerance.
- `catalog.weights`: value minor unit vÃ  unit.
- `catalog.packaging_options`: units per package, dimensions, weight, handling flags.
- `catalog.production_capacities`: quantity range, lead-time range, effective window.

Controlled vocabulary:

- `catalog.vocabularies`: material, technique, style, region, use-case, color, finish, occasion.
- `catalog.terms`: stable machine code + parent relation.
- `catalog.term_localizations`: locale label/description.
- `catalog.term_synonyms`: localized buyer vocabulary.
- `catalog.product_terms`: version + term + provenance + confidence + confirmation.

Customization:

- `catalog.customization_definitions`: stable field definition vÃ  data type.
- `catalog.customization_choices`: discrete choice rows.
- `catalog.product_customizations`: version + definition + required + constraints + price/lead-time effect.
- `catalog.customization_localizations`: labels/help text.

Media vÃ  collection:

- `catalog.media_assets`: storage object, checksum, MIME, dimensions, rights, moderation.
- `catalog.product_media`: version + asset + role + ordering + focal point.
- `catalog.collections`: stable collection identity, banner aspect policy, lifecycle.
- `catalog.collection_versions` vÃ  localizations.
- `catalog.collection_products`: collection version + product/version + order.

Ingestion vÃ  provenance:

- `catalog.ingestion_runs`, `ingestion_rows`, `field_provenance`, `validation_issues`, `ai_suggestions`.
- AI suggestion khÃ´ng ghi Ä‘Ã¨ confirmed fact; seller pháº£i confirm báº±ng explicit record.
- Publication RPC kiá»ƒm tra localized title, media rights, material/technique, price/MOQ/lead time vÃ  required customization schema.

### 6.5 Commerce

Requirement vÃ  quote:

- `commerce.quote_requests`.
- `commerce.requirement_definitions`, `requirement_values`, `requirement_attachments`.
- `commerce.quotes`, `quote_versions`, `quote_lines`, `quote_adjustments`, `quote_milestones`, `quote_acceptances`.
- Quote version immutable sau issue; accepted quote cÃ³ exact terms snapshot + deterministic hash.

Order:

- `commerce.orders`: public ID, human reference `LM-YY-MM-XXXXXX`, accepted quote version, lifecycle.
- `commerce.order_participants`: buyer, maker, support, resolver validity window.
- `commerce.order_items`: exact product/version/variant snapshot vÃ  quantity.
- `commerce.order_addresses`: encrypted shipping snapshot; khÃ´ng trá» mutable address rá»“i thay Ä‘á»•i lá»‹ch sá»­.
- `commerce.order_status_history`: append-only actor/reason/correlation.
- `commerce.order_milestones`, `milestone_evidence`, `design_approvals`.
- `commerce.shipments`, `shipment_events`.
- `commerce.disputes`, `dispute_evidence`, `dispute_decisions`.

Money invariant:

`sum(order_milestone.amount_atomic) = escrow_total_atomic`

Cross-row invariant Ä‘Æ°á»£c enforce trong privileged command transaction, khÃ´ng cá»‘ dÃ¹ng row-level check constraint khÃ´ng thá»ƒ nhÃ¬n nhiá»u row.

### 6.6 Wallet vÃ  Agent

Wallet:

- `wallet.accounts`: owner type/reference, provider, EOA/smart-account type, custody type, chain ID, normalized address.
- `wallet.link_challenges`: domain-bound nonce, issued/expiry/used.
- `wallet.delegations`: grantor, Agent grantee, policy hash/version, scope, validity, revocation nonce.
- `wallet.delegation_capabilities`: chain/token/contract/function/recipient allowlists, per-action/period/total limits, approval threshold.
- `wallet.session_keys`: public key/provider reference, expiry, policy hash, revoked state; tuyá»‡t Ä‘á»‘i khÃ´ng lÆ°u private key.

Agent:

- `agent.identities`: buyer/maker/platform scope, version, capability set, optional ERC-8004 reference.
- `agent.wallet_bindings`: one active smart account per identity/purpose.
- `agent.runs`, `messages`, `tool_calls`.
- `agent.transaction_intents`: typed semantic intent + immutable payload hash + idempotency key.
- `agent.transaction_simulations`: block snapshot, decoded asset changes, gas, result.
- `agent.risk_decisions`: rule results, budget state, allow/approval/deny.
- `agent.action_approvals`: exact intent hash, signer, expiry, consumed state.
- `agent.execution_attempts`: provider request, userOp/tx hash, receipt/error.
- `agent.budget_ledger`: append-only reserve/consume/release/reverse.
- `agent.emergency_stops`.

Agent autonomy modes:

| Mode | Quyá»n |
|---|---|
| `observe` | Read, monitor, notify. |
| `prepare` | Compose vÃ  simulate; ngÆ°á»i dÃ¹ng kÃ½. |
| `execute_limited` | KÃ½ trong capability/scope/budget/time policy. |
| `managed_commerce` | Quáº£n lÃ½ toÃ n order trong tá»•ng budget Ä‘Ã£ duyá»‡t. |
| `frozen` | KhÃ´ng kÃ½ má»›i; váº«n reconcile/revoke/safe withdraw. |

### 6.7 Payment vÃ  chain projection

- `payments.payment_intents`: exact sender/escrow/token/amount/chain/expiry/idempotency.
- `payments.transactions`: verified receipt facts.
- `payments.payment_allocations`: má»™t transfer/event khÃ´ng tÃ¡i sá»­ dá»¥ng cho invoice khÃ¡c.
- `payments.contract_versions`: version, factory, implementation, ABI/bytecode hash, deployment.
- `payments.escrow_instances`: order â†” escrow address â†” version â†” terms hash.
- `payments.escrow_milestones`: DB milestone â†” contract index.
- `payments.chain_events`: raw/decoded finalized event, unique chain/tx/log index.
- `payments.projector_cursors`: source + last safely projected block.
- `payments.reconciliation_runs` vÃ  `reconciliation_mismatches`.

Projector ghi chain fact trÆ°á»›c, sau Ä‘Ã³ gá»i idempotent domain command. Webhook chá»‰ lÃ  tÃ­n hiá»‡u Ä‘á»ƒ fetch/verify; khÃ´ng pháº£i authority.

### 6.8 Search, notification vÃ  internal reliability

- `search.product_documents`: deterministic canonical text, tsvector, embedding/model metadata.
- `search.index_jobs`: product version + locale + reason + state.
- `notifications.preferences`, `order_preferences`, `reminders`, `delivery_attempts`.
- `internal.outbox_events`, `jobs`, `idempotency_keys`, `audit_events`, `platform_roles`.
- Worker claim job báº±ng `for update skip locked` vÃ  commit trÆ°á»›c khi gá»i external provider.

## 7. Migration v1 Ä‘á» xuáº¥t

Chá»‰ Ã¡p dá»¥ng chiáº¿n lÆ°á»£c thay tháº¿ migration prototype khi Checkpoint 0 xÃ¡c nháº­n chÆ°a cÃ³ dá»¯ liá»‡u production. Sau khi cÃ³ shared/production data, migration lÃ  append-only.

| Thá»© tá»± | File | Ná»™i dung |
|---|---|---|
| 0001 | `supabase/migrations/0001_extensions_schemas.sql` | Extensions, schemas, revoke defaults. |
| 0002 | `supabase/migrations/0002_shared_types_functions.sql` | Enum/types, ID helpers, money/domain helpers. |
| 0003 | `supabase/migrations/0003_identity.sql` | Profile, email, address, preferences. |
| 0004 | `supabase/migrations/0004_makers_social.sql` | Maker, profile version, membership, follow, review. |
| 0005 | `supabase/migrations/0005_catalog_taxonomy.sql` | Vocabulary, term, localization, synonym. |
| 0006 | `supabase/migrations/0006_catalog_products.sql` | Product, version, localization. |
| 0007 | `supabase/migrations/0007_catalog_commercial_facts.sql` | Variant, price, capacity, dimension, customization. |
| 0008 | `supabase/migrations/0008_catalog_media_collections_ingestion.sql` | Media, collection, provenance, publication issues. |
| 0009 | `supabase/migrations/0009_commerce_quote_requests.sql` | Requirements vÃ  quote request. |
| 0010 | `supabase/migrations/0010_commerce_quotes.sql` | Quote version/line/adjustment/milestone/acceptance. |
| 0011 | `supabase/migrations/0011_commerce_orders.sql` | Order, item, participant, history, snapshot. |
| 0012 | `supabase/migrations/0012_fulfillment_disputes.sql` | Milestone, evidence, shipment, dispute. |
| 0013 | `supabase/migrations/0013_wallet_delegation.sql` | Account, challenge, delegation, capability, session key ref. |
| 0014 | `supabase/migrations/0014_agent_runtime_wallet.sql` | Agent identity, intent, risk, approval, budget, execution. |
| 0015 | `supabase/migrations/0015_payments_chain_projection.sql` | Payment, contract registry, event, cursor, reconciliation. |
| 0016 | `supabase/migrations/0016_search_notifications_internal.sql` | Search, outbox, job, reminder, audit. |
| 0017 | `supabase/migrations/0017_public_views_commands.sql` | Safe views vÃ  transactional RPC commands. |
| 0018 | `supabase/migrations/0018_storage_rls_privileges.sql` | Storage policies, RLS, grants, force RLS where applicable. |

Migration rules:

- Má»—i file cháº¡y transactional náº¿u Postgres cho phÃ©p.
- Constraint/index cÃ³ tÃªn deterministic.
- KhÃ´ng dÃ¹ng `ADD CONSTRAINT IF NOT EXISTS` vÃ¬ PostgreSQL khÃ´ng há»— trá»£ syntax Ä‘Ã³.
- Má»i FK Ä‘Æ°á»£c audit index; composite index theo query shape, equality column trÆ°á»›c range column.
- Partial index dÃ¹ng cho active/pending/unqueued rows khi query luÃ´n cÃ³ predicate tÆ°Æ¡ng á»©ng.
- Má»i security-definer function cÃ³ `set search_path = ''`, schema-qualified names vÃ  revoke execute máº·c Ä‘á»‹nh.
- Seed chá»‰ chá»©a taxonomy vÃ  dá»¯ liá»‡u demo deterministic; khÃ´ng chá»©a secret hoáº·c production dump.

## 8. Contract architecture tá»« Ä‘áº§u

### 8.1 Repository structure

```text
contracts/
  foundry.toml
  remappings.txt
  src/
    LoomonEscrowFactory.sol
    LoomonOrderEscrow.sol
    interfaces/ILoomonOrderEscrow.sol
    libraries/LoomonTypes.sol
    libraries/AgentPermissions.sol
  script/
    DeployArcTestnet.s.sol
    RegisterImplementation.s.sol
  test/
    unit/LoomonOrderEscrow.t.sol
    unit/LoomonEscrowFactory.t.sol
    unit/AgentOperator.t.sol
    fuzz/LoomonOrderEscrowFuzz.t.sol
    invariant/LoomonAccountingInvariant.t.sol
    integration/ArcUsdcFork.t.sol
    mocks/MockUSDC.sol
  deployments/
    arc-testnet.json
```

### 8.2 Factory

`LoomonEscrowFactory`:

- registry version â†’ approved immutable implementation;
- deterministic clone per `(order_id, contract_version, salt)`;
- reject duplicate order ID;
- pause creation of new escrows only;
- khÃ´ng thá»ƒ thay implementation cá»§a escrow Ä‘ang hoáº¡t Ä‘á»™ng;
- admin lÃ  multisig;
- emit implementation registration vÃ  escrow creation events.

### 8.3 Per-order escrow

Onchain data tá»‘i thiá»ƒu:

- bytes32 order ID vÃ  terms hash;
- buyer, seller, resolver, fee recipient;
- optional buyer/seller Agent operator;
- operator permissions bitmap, policy hash, expiry, revocation nonce;
- Arc USDC address, total atomic amount, fee basis points;
- acceptance/funding/review deadlines;
- milestone amount/deadline/evidence hash/state;
- funded, released, refunded, fee vÃ  claimable balances.

KhÃ´ng lÆ°u name, email, phone, address, product text, chat, private evidence URI hoáº·c tracking number.

### 8.4 State machine

Escrow:

`created â†’ seller_accepted â†’ funded â†’ active â†’ completed`

Alternative:

- `created | seller_accepted â†’ cancelled` trÆ°á»›c funding theo deadline;
- `funded | active â†’ disputed â†’ resolved`;
- `funded â†’ refunded` náº¿u cancellation/refund rule cho phÃ©p.

Milestone:

`pending â†’ submitted â†’ approved â†’ released`

hoáº·c:

`submitted â†’ disputed â†’ resolved_release | resolved_refund | resolved_split`

### 8.5 Commands

Factory:

- `createEscrow(config, milestones, salt)`
- `setImplementationAllowed(version, implementation, allowed)`
- `pauseCreation()` / `unpauseCreation()`

Escrow:

- `setOperator(side, operator, permissions, policyHash, expiry, nonce)`
- `revokeOperator(side, nonce)`
- `acceptTerms()`
- `fund()`
- `activate()`
- `submitMilestone(index, evidenceHash)`
- `approveMilestone(index)`
- `raiseDispute(index, reasonHash)`
- `resolveDispute(index, buyerAmount, sellerAmount)`
- `cancelBeforeFunding()`
- `withdraw()`

KhÃ´ng táº¡o `execute(bytes)` hoáº·c arbitrary call cho Agent. Agent dÃ¹ng cÃ¹ng narrow command vá»›i owner, sau khi contract validate permission, expiry vÃ  revocation nonce.

### 8.6 Accounting vÃ  security invariants

- `funded = remaining + seller_claimable + buyer_claimable + fee_claimable + withdrawn`.
- KhÃ´ng milestone nÃ o release/refund quÃ¡ allocation.
- Tá»•ng seller release + buyer refund + platform fee khÃ´ng vÆ°á»£t funded total.
- Fee chá»‰ tÃ­nh trÃªn seller-released value.
- Withdraw chá»‰ Ä‘áº¿n settlement address Ä‘Ã£ khÃ³a cho principal tÆ°Æ¡ng á»©ng.
- State update trÆ°á»›c token transfer; dÃ¹ng `SafeERC20` vÃ  `ReentrancyGuard`.
- KhÃ´ng delegatecall, arbitrary external call, token substitution hoáº·c admin withdrawal.
- EIP-712 domain separation, typed delegation/intent, nonce, deadline vÃ  replay protection.
- Pause khÃ´ng Ä‘Æ°á»£c khÃ³a Ä‘Æ°á»ng refund/dispute/withdraw an toÃ n khiáº¿n tiá»n máº¯c káº¹t.
- Agent Ä‘áº¡i diá»‡n buyer/seller khÃ´ng thá»ƒ lÃ  resolver cá»§a order Ä‘Ã³.

### 8.7 Events

- `EscrowCreated`
- `OperatorSet`
- `OperatorRevoked`
- `TermsAccepted`
- `EscrowFunded`
- `EscrowActivated`
- `MilestoneSubmitted`
- `MilestoneApproved`
- `MilestoneReleased`
- `DisputeRaised`
- `DisputeResolved`
- `RefundAllocated`
- `Withdrawal`
- `EscrowCompleted`

Má»i event nghiá»‡p vá»¥ chá»©a `orderId`, contract version vÃ  Ä‘á»§ indexed fields Ä‘á»ƒ projector Ä‘á»‹nh tuyáº¿n. Event cÃ³ actual caller vÃ  principal khi Agent operator hÃ nh Ä‘á»™ng.

## 9. Checkpoint execution plan

### CP0 â€” Safety, baseline vÃ  quyáº¿t Ä‘á»‹nh

Entry:

- Frontend hiá»‡n táº¡i Ä‘Ã£ build/test á»Ÿ commit baseline.
- ChÆ°a sá»­a migration hoáº·c táº¡o contract.

Tasks:

1. Cháº¡y `git status --short`, ghi láº¡i user changes vÃ  khÃ´ng Ä‘á»¥ng `outputs/`.
2. XÃ¡c minh má»i Supabase remote environment vÃ  cÃ³/khÃ´ng cÃ³ dá»¯ liá»‡u tháº­t.
3. Náº¿u khÃ´ng cÃ³ data tháº­t: tag baseline vÃ  táº¡o isolated branch/worktree.
4. Náº¿u cÃ³ data tháº­t: dá»«ng replacement plan, láº­p inventory/data-migration ADR vÃ  chuyá»ƒn sang append-only.
5. Duyá»‡t ADR-001 Ä‘áº¿n ADR-012.
6. Kiá»ƒm tra toolchain: Node, Docker-compatible runtime, `npx supabase --version`, `forge --version`.

Artifacts:

- `docs/architecture/adr/ADR-001-*.md` Ä‘áº¿n ADR cáº§n thiáº¿t.
- `docs/architecture/environment-inventory.md` khÃ´ng chá»©a secrets.

Verification:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

Exit gate:

- Baseline xanh; environment/data status Ä‘Æ°á»£c xÃ¡c nháº­n; ADR khÃ´ng cÃ²n blocker.

Rollback:

- KhÃ´ng cÃ³ schema mutation; xÃ³a worktree/branch chÆ°a dÃ¹ng náº¿u pháº£i dá»«ng.

### CP1 â€” Data dictionary vÃ  query contract trÆ°á»›c SQL

Tasks:

1. Viáº¿t ERD logical cho toÃ n bá»™ domain.
2. Viáº¿t data dictionary: field, type, nullability, authority, PII class, mutability, retention.
3. Liá»‡t kÃª query/API quan trá»ng trÆ°á»›c khi chá»n index.
4. Viáº¿t state transition matrix cho product publication, quote, order, milestone, dispute, delegation vÃ  Agent intent.
5. Viáº¿t RLS access matrix cho anonymous, buyer A/B, seller owner/member/non-member, Agent service, signer, worker, support.

Artifacts:

- `docs/architecture/phase-2-erd.md`
- `docs/architecture/data-dictionary.md`
- `docs/architecture/query-contracts.md`
- `docs/architecture/state-transition-matrix.md`
- `docs/architecture/rls-matrix.md`

Tests-first:

- Táº¡o skeleton `supabase/tests/database/000_schema_contract.test.sql` mÃ´ táº£ table/constraint dá»± kiáº¿n vÃ  Ä‘ang fail.

Exit gate:

- KhÃ´ng cÃ²n business field Agent cáº§n tÃ¬m kiáº¿m náº±m trong opaque JSON.
- Má»—i mutable entity cÃ³ owner, authority vÃ  lifecycle rÃµ.
- Má»—i query contract cÃ³ index hypothesis.

### CP2 â€” Migration foundation

Tasks:

1. Thay 5 prototype migrations báº±ng chain 0001â€“0018 chá»‰ trong isolated branch vÃ  chá»‰ sau CP0.
2. Táº¡o extensions/schemas/types/shared helpers.
3. Revoke public defaults; táº¡o role/grant skeleton.
4. Chuáº©n hÃ³a ID, timestamp, money vÃ  lifecycle types.
5. Táº¡o deterministic seed taxonomy/demo identities.

TDD loop cho tá»«ng migration:

1. ThÃªm pgTAP assertion fail.
2. Viáº¿t migration nhá» nháº¥t.
3. Cháº¡y `npx supabase db reset`.
4. Cháº¡y `npx supabase test db`.
5. Refactor tÃªn/constraint/index khi xanh.

Verification:

- `npx supabase db reset`
- cháº¡y láº¡i `npx supabase db reset` láº§n hai tá»« sáº¡ch;
- `npx supabase db lint --level warning`
- `npx supabase test db`

Exit gate:

- Full chain dá»±ng Ä‘Æ°á»£c database rá»—ng hai láº§n liÃªn tiáº¿p.
- KhÃ´ng drift vÃ  khÃ´ng migration phá»¥ thuá»™c manual Dashboard action.

### CP3 â€” Identity, maker vÃ  catalog chuáº©n hÃ³a

Owned files:

- migrations 0003â€“0008;
- tests `010_identity.test.sql`, `020_makers.test.sql`, `030_catalog.test.sql`, `031_catalog_publication.test.sql`.

TDD cases:

- duplicate maker slug bá»‹ reject;
- non-member khÃ´ng publish product;
- published version khÃ´ng update Ä‘Æ°á»£c;
- má»™t product chá»‰ cÃ³ má»™t published pointer há»£p lá»‡;
- taxonomy/localization unique Ä‘Ãºng key;
- price/MOQ/lead time invalid bá»‹ reject;
- thiáº¿u rights hoáº·c required facts khÃ´ng publish Ä‘Æ°á»£c;
- Agent suggestion khÃ´ng trá»Ÿ thÃ nh confirmed fact náº¿u thiáº¿u confirmation.

Performance checks:

- Audit má»i FK thiáº¿u index.
- `EXPLAIN (ANALYZE, BUFFERS)` cho published feed, store products, collection membership vÃ  Agent hard-filter query trÃªn generated fixture scale.

Exit gate:

- Product seed Ä‘i qua create draft â†’ validate â†’ publish â†’ search projection.
- Query plan khÃ´ng seq-scan báº£ng lá»›n ngoÃ i trÆ°á»ng há»£p cÃ³ chá»§ Ã½/documented.

### CP4 â€” Quote, order, fulfillment vÃ  dispute

Owned files:

- migrations 0009â€“0012;
- transactional RPC trong 0017;
- tests `040_quotes.test.sql`, `050_orders.test.sql`, `051_order_state.test.sql`, `052_disputes.test.sql`.

Commands cáº§n implement TDD:

- `create_quote_request`
- `issue_quote_version`
- `accept_quote_version`
- `create_order_from_acceptance`
- `transition_order`
- `submit_milestone_evidence`
- `open_dispute`
- `record_dispute_decision`

Negative/concurrency tests:

- accept quote háº¿t háº¡n hoáº·c superseded;
- duplicate acceptance/idempotency collision;
- order snapshot thay Ä‘á»•i khi product mutable thay Ä‘á»•i â€” pháº£i khÃ´ng xáº£y ra;
- milestone total lá»‡ch escrow total;
- transition skip state;
- hai worker/actor cÃ¹ng transition má»™t order;
- lock ordering cá»‘ Ä‘á»‹nh vÃ  transaction khÃ´ng gá»i external service.

Exit gate:

- Má»™t order hoÃ n chá»‰nh Ä‘Æ°á»£c táº¡o chá»‰ tá»« accepted immutable quote.
- State history vÃ  outbox event Ä‘Æ°á»£c ghi atomically.

### CP5 â€” Wallet, Agent delegation vÃ  signing boundary

Owned files:

- migrations 0013â€“0014;
- `src/domain/agent-intent.ts` vÃ  tests;
- `src/server/agent/authorize-intent.ts` vÃ  tests;
- provider adapter interface, chÆ°a gáº¯n production signer.

TDD cases:

- wallet linking challenge domain/nonce/expiry/replay;
- Agent khÃ´ng tá»± grant/renew/revoke owner policy;
- capability sai contract/token/function/recipient bá»‹ deny;
- per-action/period/total budget overflow bá»‹ deny;
- expired/revoked delegation bá»‹ deny ngay;
- duplicate idempotency key tráº£ cÃ¹ng result hoáº·c conflict theo request hash;
- simulation asset delta khÃ¡c typed intent bá»‹ deny;
- new recipient hoáº·c threshold cao chuyá»ƒn `human_approval`;
- frozen Agent khÃ´ng kÃ½ má»›i;
- budget reserve Ä‘Æ°á»£c release khi execution fail, consume khi finalized.

Exit gate:

- Model-facing process khÃ´ng cÃ³ key vÃ  khÃ´ng gá»i signer trá»±c tiáº¿p.
- Chá»‰ immutable approved intent hash Ä‘Æ°á»£c gá»­i Ä‘áº¿n signer adapter.
- Audit cÃ³ thá»ƒ giáº£i thÃ­ch vÃ¬ sao action allow/deny/escalate.

### CP6 â€” Payment, event projection vÃ  reconciliation

Owned files:

- migration 0015;
- `src/server/arc/index-events.ts`;
- `src/server/arc/project-event.ts`;
- `src/server/arc/reconcile-escrow.ts`;
- event fixtures vÃ  tests.

TDD cases:

- cÃ¹ng event ingest hai láº§n chá»‰ táº¡o má»™t projection;
- out-of-order event Ä‘Æ°á»£c buffer/retry Ä‘Ãºng;
- receipt failed hoáº·c wrong chain/token/address/amount bá»‹ reject;
- reorg-safe/finality policy Ä‘Æ°á»£c tÃ´n trá»ng;
- projector crash giá»¯a chain-event insert vÃ  domain transition cÃ³ thá»ƒ retry;
- replay tá»« block 0/tá»« deployment tÃ¡i táº¡o cÃ¹ng projection;
- mismatch DB/contract táº¡o reconciliation issue, khÃ´ng tá»± sá»­a tiá»n mÃ¹ quÃ¡ng.

Exit gate:

- Event replay khÃ´ng táº¡o duplicate order state, payout hoáº·c email.
- Reconciliation fixture expected mismatch = 0.

### CP7 â€” RLS, public API vÃ  operations hardening

Owned files:

- migrations 0016â€“0018;
- tests `070_rls_identity.test.sql` Ä‘áº¿n `079_rls_internal.test.sql`.

RLS matrix tests cho má»i table exposed:

- anonymous positive/negative;
- buyer A khÃ´ng Ä‘á»c buyer B;
- seller chá»‰ Ä‘á»c order cá»§a maker membership active;
- Agent tool service chá»‰ Ä‘á»c scope cá»§a initiating principal;
- authorization service chá»‰ Ä‘á»c policy vÃ  append audit, khÃ´ng grant delegation;
- signer khÃ´ng cÃ³ general database access;
- worker chá»‰ claim job/outbox;
- service role khÃ´ng bao giá» xuáº¥t hiá»‡n á»Ÿ browser env.

Performance/security review:

- wrap `(select auth.uid())`;
- index má»i policy predicate;
- security-definer helper cÃ³ empty search path;
- revoke execute/public grants thá»«a;
- `for update skip locked` cho workers;
- transaction mode pooler cho request workloads;
- statement timeout cho worker/RPC phÃ¹ há»£p.

Exit gate:

- Má»i negative RLS test pass.
- Database lint khÃ´ng cÃ³ security warning chÆ°a Ä‘Æ°á»£c giáº£i thÃ­ch.

### CP8 â€” Contract executable specification: RED

Tasks:

1. Khá»Ÿi táº¡o Foundry trong `contracts/` vÃ  pin compiler/dependencies.
2. Viáº¿t interfaces/types/events trÆ°á»›c implementation.
3. Viáº¿t unit tests cho constructor/init validation vÃ  tá»«ng state transition.
4. Viáº¿t Agent operator expiry/revocation/replay tests.
5. Viáº¿t fuzz vÃ  invariant harness.
6. XÃ¡c nháº­n tests fail vÃ¬ implementation chÆ°a tá»“n táº¡i/hoÃ n chá»‰nh.

Required test inventory:

- exact funding vÃ  double-fund;
- seller acceptance deadlines;
- milestone submission/approval/release;
- dispute split accounting;
- cancellation/refund paths;
- withdrawal failure isolation;
- fee rounding/bounds;
- unauthorized owner/operator/resolver/admin;
- operator permission bitmap, expiry, nonce, policy hash;
- replay/reentrancy/token failure;
- max milestones/deadline boundaries;
- conservation of USDC.

Exit gate:

- Test suite biá»ƒu diá»…n Ä‘áº§y Ä‘á»§ behavior vÃ  failure modes; RED lÃ  do thiáº¿u implementation, khÃ´ng do test sai.

### CP9 â€” Contract implementation: GREEN vÃ  security review

Tasks:

1. Implement smallest factory/escrow code Ä‘á»ƒ unit tests pass.
2. Refactor sau khi GREEN, khÃ´ng thÃªm feature ngoÃ i test/spec.
3. Cháº¡y fuzz/invariant vá»›i runs cao hÆ¡n CI máº·c Ä‘á»‹nh.
4. Cháº¡y formatter, compiler warnings, gas snapshot vÃ  static analyzer Ä‘Ã£ chá»n.
5. Critical diff review vá»›i ADR/state machine.

Verification:

- `forge fmt --check`
- `forge build --sizes`
- `forge test -vvv`
- `forge test --match-path 'test/fuzz/*'`
- `forge test --match-path 'test/invariant/*'`

Security gate:

- KhÃ´ng arbitrary call/delegatecall/admin seizure.
- Accounting invariant pass.
- Resolver/operator separation pass.
- Emergency controls khÃ´ng táº¡o stuck funds.
- Bytecode, ABI vÃ  source hash Ä‘Æ°á»£c lÆ°u.

Rollback:

- Contract chÆ°a deploy; revert isolated branch task náº¿u review fail.

### CP10 â€” Arc Testnet deployment

Entry:

- CP9 xanh vÃ  security review Ä‘Æ°á»£c sign off.
- Arc Testnet RPC/USDC/finality/gas rules Ä‘Æ°á»£c revalidate tá»« docs chÃ­nh thá»©c.

Tasks:

1. Deploy implementation vÃ  factory tá»« multisig/deployer policy Ä‘Ã£ duyá»‡t.
2. Verify source trÃªn explorer náº¿u tooling há»— trá»£.
3. Ghi chain ID, address, deployment tx/block, ABI/bytecode hash vÃ o `contracts/deployments/arc-testnet.json` vÃ  `payments.contract_versions`.
4. KhÃ´ng hardcode key; deployment signer á»Ÿ secret manager/wallet bÃªn ngoÃ i repository.
5. Cháº¡y smoke test create/fund/submit/approve/release/refund/dispute.

Exit gate:

- Deployment reproducible vÃ  addresses Ä‘Æ°á»£c Ä‘Äƒng kÃ½ chÃ­nh xÃ¡c.
- App khÃ´ng cháº¥p nháº­n contract address ngoÃ i registry.

### CP11 â€” Agent smart account vÃ  E2E Testnet

Tasks:

1. Provider spike cho ERC-4337 smart account/bundler/paymaster/session policy trÃªn Arc.
2. Ghi ADR chá»n provider theo key isolation, policy expressiveness, revocation latency, reliability, cost vÃ  portability.
3. Táº¡o buyer Agent, maker Agent vÃ  platform operations Agent riÃªng.
4. Test `prepare`, `execute_limited`, `managed_commerce`, `frozen`.
5. Cháº¡y order E2E qua frozen frontend adapter hoáº·c test harness.

E2E scenarios:

- human wallet fund vÃ  Agent monitor;
- buyer Agent fund trong budget;
- maker Agent accept + submit evidence;
- buyer Agent approve dÆ°á»›i threshold;
- over-threshold yÃªu cáº§u human approval;
- revoke ngay trÆ°á»›c submission;
- simulation mismatch;
- dispute báº¯t buá»™c independent resolver;
- completed settlement + withdrawal + exact DB reconciliation;
- failed action khÃ´ng gá»­i email/payment state sai.

Exit gate:

- KhÃ´ng action nÃ o vÆ°á»£t delegation.
- Projector vÃ  contract balances khá»›p tuyá»‡t Ä‘á»‘i.
- Audit trace Ä‘i tá»« conversation/run â†’ intent â†’ risk â†’ approval â†’ userOp/tx â†’ event â†’ order state.

### CP12 â€” Final review vÃ  handoff

Tasks:

1. Cháº¡y toÃ n bá»™ database, app vÃ  contract checks tá»« clean clone/worktree.
2. Review diff so vá»›i file plan nÃ y.
3. XÃ¡c nháº­n khÃ´ng cÃ³ secret, demo key, service role key hoáº·c private data.
4. Generate TypeScript database types vÃ  verify diff.
5. Generate final ERD/data dictionary/API/event mapping.
6. Láº­p staging deployment/runbook/rollback checklist.

Final commands:

- `npx supabase db reset`
- `npx supabase db lint --level warning`
- `npx supabase test db`
- `npx supabase gen types typescript --local`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `forge fmt --check`
- `forge build --sizes`
- `forge test -vvv`

Exit gate:

- Táº¥t cáº£ checks pass tá»« mÃ´i trÆ°á»ng sáº¡ch.
- KhÃ´ng cÃ³ migration/manual step undocumented.
- KhÃ´ng cÃ³ unresolved high/critical security finding.
- Database/contract/projector/Agent E2E Testnet evidence Ä‘Æ°á»£c lÆ°u.

## 10. Test file plan

```text
supabase/tests/database/
  000_schema_contract.test.sql
  010_identity.test.sql
  020_makers.test.sql
  021_social_reviews.test.sql
  030_catalog.test.sql
  031_catalog_publication.test.sql
  032_catalog_searchability.test.sql
  040_quote_requests.test.sql
  041_quotes.test.sql
  050_orders.test.sql
  051_order_state.test.sql
  052_fulfillment_disputes.test.sql
  060_wallet_delegation.test.sql
  061_agent_intents.test.sql
  062_agent_budget.test.sql
  063_agent_revocation.test.sql
  064_payments_projection.test.sql
  065_idempotency_replay.test.sql
  070_rls_identity.test.sql
  071_rls_makers.test.sql
  072_rls_catalog.test.sql
  073_rls_commerce.test.sql
  074_rls_wallet_agent.test.sql
  075_rls_payments.test.sql
  076_rls_notifications.test.sql
  077_rls_internal.test.sql
```

Application tests:

```text
src/domain/
  agent-intent.test.ts
  order-state.test.ts
  money.test.ts
src/server/agent/
  authorize-intent.test.ts
  budget-ledger.test.ts
src/server/arc/
  project-event.test.ts
  reconcile-escrow.test.ts
tests/e2e/
  buyer-agent-order.spec.ts
  maker-agent-order.spec.ts
  revocation-and-dispute.spec.ts
```

## 11. CI quality gates

PR database job:

1. Start local Supabase.
2. Reset from zero.
3. Run database lint.
4. Run pgTAP.
5. Generate types vÃ  fail náº¿u working tree khÃ¡c expected.
6. Run FK-index audit vÃ  critical query EXPLAIN fixtures.

PR contract job:

1. Pin Foundry toolchain.
2. Format/build.
3. Unit/fuzz/invariant tests.
4. Static analysis.
5. ABI/bytecode diff review khi contract thay Ä‘á»•i.

PR application job:

1. Typecheck/lint/unit.
2. Build.
3. Projector/Agent authorization tests.
4. E2E smoke tests khi relevant services available.

KhÃ´ng auto-deploy contract hoáº·c database production tá»« unreviewed branch.

## 12. Monitoring vÃ  váº­n hÃ nh tá»‘i thiá»ƒu

Database:

- connection usage/pool saturation;
- slow query vÃ  `pg_stat_statements`;
- deadlock count, lock wait, queue age;
- failed outbox/jobs vÃ  retry age;
- RLS/permission audit failures;
- table/index bloat vÃ  vacuum/analyze health.

Arc/contract:

- RPC/indexer lag;
- last finalized/projected block;
- projector error/retry rate;
- escrow balance mismatch;
- failed withdrawal/token transfer;
- paused factory hoáº·c stale unresolved dispute.

Agent wallet:

- denied/escalated/executed intent counts;
- revocation-to-enforcement latency;
- budget reservation leaks;
- simulation-vs-receipt delta;
- signer/provider availability;
- unexpected recipient/contract/function attempt.

## 13. Rollback strategy

Database pre-production:

- Fix migration trong isolated branch vÃ  rebuild local tá»« zero.
- KhÃ´ng sá»­a tay database Ä‘á»ƒ â€œqua gateâ€.

Database sau shared/staging data:

- KhÃ´ng rewrite applied migration.
- Táº¡o forward-fix migration; backup/PITR policy Ä‘Æ°á»£c xÃ¡c nháº­n trÆ°á»›c deploy.
- Destructive migration dÃ¹ng expand â†’ migrate â†’ verify â†’ contract qua nhiá»u release.

Contract:

- KhÃ´ng upgrade escrow active.
- Disable implementation cho order má»›i táº¡i factory.
- Deploy audited implementation version má»›i.
- Active escrows giá»¯ code cÅ© vÃ  tiáº¿p tá»¥c safe refund/dispute/withdraw.

Agent:

- Freeze signer/policy scope.
- Revoke session/delegation nonce.
- KhÃ´ng xÃ³a audit/intents.
- Human/manual wallet tiáº¿p quáº£n safe actions.

## 14. Definition of Done

- [ ] ADR-001 Ä‘áº¿n ADR-012 Ä‘Æ°á»£c duyá»‡t.
- [ ] Clean migration chain dá»±ng database tá»« zero hai láº§n.
- [ ] Schema Ä‘áº¡t normalization rule vÃ  khÃ´ng láº¡m dá»¥ng JSONB.
- [ ] Má»i FK/policy predicate cÃ³ index phÃ¹ há»£p.
- [ ] Product version, quote version vÃ  order snapshot báº¥t biáº¿n.
- [ ] RLS positive/negative tests pass cho má»i actor.
- [ ] Agent delegation, budget, revocation, replay vÃ  simulation mismatch tests pass.
- [ ] Model khÃ´ng cÃ³ Ä‘Æ°á»ng truy cáº­p signing material hoáº·c arbitrary calldata.
- [ ] Forge unit/fuzz/invariant tests pass.
- [ ] Arc Testnet E2E buyer/seller/Agent/dispute pass.
- [ ] Event replay idempotent vÃ  reconciliation mismatch báº±ng 0.
- [ ] KhÃ´ng cÃ³ high/critical security finding chÆ°a xá»­ lÃ½.
- [ ] Data dictionary, ERD, event mapping vÃ  runbook hoÃ n chá»‰nh.

## 15. Thá»© tá»± thá»±c thi Ä‘Æ°á»£c phÃ©p

```text
CP0 â†’ CP1 â†’ CP2 â†’ CP3 â†’ CP4
                  â†˜ CP5
CP4 + CP5 â†’ CP6 â†’ CP7
CP0 + contract ADRs â†’ CP8 â†’ CP9 â†’ CP10
CP5 + CP6 + CP7 + CP10 â†’ CP11 â†’ CP12
```

KhÃ´ng bá» qua checkpoint. CP3 vÃ  CP5 chá»‰ cÃ³ thá»ƒ cháº¡y song song khi ownership file/migration khÃ´ng trÃ¹ng nhau vÃ  CP2 Ä‘Ã£ xanh.

## 16. TÃ i liá»‡u chÃ­nh thá»©c pháº£i revalidate trÆ°á»›c khi code/deploy

- Supabase local migrations: https://supabase.com/docs/guides/local-development/overview
- Supabase CLI workflow: https://supabase.com/docs/guides/local-development/cli-workflows
- Supabase database testing/pgTAP: https://supabase.com/docs/guides/local-development/testing/overview
- Supabase testing vÃ  linting: https://supabase.com/docs/guides/local-development/cli/testing-and-linting
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Arc Agentic Economy: https://docs.arc.io/build/agentic-economy
- Arc account abstraction/ERC-4337 providers: https://docs.arc.io/arc/tools/account-abstraction
- Arc network/EVM differences vÃ  contract addresses: báº¯t Ä‘áº§u tá»« https://docs.arc.io/llms.txt
- Foundry tests: https://getfoundry.sh/forge/tests/overview/
