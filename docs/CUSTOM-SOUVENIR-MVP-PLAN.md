# LOOMON â€” Upload-first Custom Souvenir MVP

Status: authoritative product and implementation direction
Date: 2026-07-22
Supersedes for current execution: the marketplace-first Phase 2 plans
Agent-commerce addendum: `docs/AGENT-COMMERCE-FLOW.md`

## 1. Product thesis

LOOMON will first prove a smaller, clearer product:

> Upload an image first. Let an Agent turn it into a custom Vietnamese souvenir, refine the result with natural language, and use Arc for the economic layer behind the order.

This release is simultaneously:

1. a useful custom-souvenir storefront;
2. a demonstration of how traditional craft can become easier to access through modern visual tools;
3. an Arc smart-account and USDC commerce experiment;
4. an Agent experiment with image understanding, design revision, commerce constraints and wallet action;
5. a data foundation that can later expand into a real multi-seller marketplace.

The MVP is not a public marketplace. LOOMON curates the base products and craft partners. Seller onboarding, public product upload, follows, reviews and multi-seller settlement come only after this flow is validated.

## 2. Primary user promise

The user should not need to understand prompt engineering, manufacturing terminology, wallets or blockchain.

They should be able to:

1. upload a logo, photograph or illustration;
2. see which souvenir types suit that image;
3. receive several clear previews;
4. say things such as â€œmake the logo smallerâ€, â€œuse only blueâ€, â€œmove it to the centerâ€, or â€œtry this on a lacquer boxâ€;
5. approve the result;
6. place a demo/pilot order;
7. let the Agent handle wallet, payment status and follow-up within an explicit policy.

## 3. MVP scope

### Included

- Guest-first image upload with login required before persistent save or checkout.
- File validation, malware/content checks, rights declaration and EXIF stripping.
- Image analysis: subject, aspect ratio, dominant colors, transparency, resolution and likely print/engraving suitability.
- Background-removal or simplified cutout path where appropriate.
- Curated souvenir catalog with Vietnamese craft story and manufacturing constraints.
- Product-specific customization zones and techniques.
- Deterministic mockup composition for the first reliable preview.
- Optional generative concept preview clearly labeled as non-production proof.
- Natural-language revision history through the Agent.
- A final production snapshot distinct from concept previews.
- Arc Testnet embedded/external wallet.
- Buyer Agent smart account with bounded order delegation.
- A narrow custom-order USDC escrow demonstration.
- Order status, notifications and full Agent/action audit.

### Deferred

- Public seller onboarding and seller dashboard integration.
- Seller-created product publishing.
- Marketplace search across many independent shops.
- Follow, review, social graph and seller ranking.
- Bulk catalog imports.
- Multi-maker payment splitting.
- Marketplace dispute council or complex multi-party milestones.
- Mainnet payments.
- Onchain NFT/tokenization of uploaded artwork or physical goods.

## 4. Primary experience

```text
/create
  1. Upload
  2. Analyze
  3. Choose a craft product
  4. Preview
  5. Refine with Agent
  6. Approve design
  7. Connect/create wallet
  8. Create and fund Arc Testnet order
  9. Track result
```

### Step 1 â€” Upload first

The first large action is an upload surface, not a product feed.

Accepted initial formats:

- PNG;
- JPEG/WebP;
- SVG only after secure sanitization;
- maximum size and pixel limits configured server-side.

The user confirms that they own or are allowed to use the image. Original files are private by default.

### Step 2 â€” Agent analysis

The Agent returns structured facts, not only prose:

- detected subject/type;
- dominant palette;
- dimensions and effective resolution;
- transparent/opaque background;
- detail density;
- suitability for print, decal, engraving, embroidery or hand-painted interpretation;
- warnings such as small text, thin lines, low resolution or copyrighted/unsafe content;
- recommended preparation actions.

### Step 3 â€” Product recommendation

The Agent ranks only curated products compatible with:

- image aspect ratio;
- customization technique;
- printable/engraveable area;
- color count and detail constraints;
- quantity/MOQ;
- lead time;
- budget when supplied.

Each recommendation explains why it fits and tells the user what will change in production.

### Step 4 â€” Preview

The first production-oriented preview must be deterministic:

- place a sanitized/cutout asset inside a declared customization zone;
- preserve aspect ratio;
- apply product-specific mask, warp and blend settings;
- record all transform parameters;
- render from the same specification every time.

A generative image may be shown as inspiration, but it cannot become the production file without conversion into a deterministic production specification.

Immediately after an upload is accepted, the workspace presents two equal creation options:

1. **Manual Edit** â€” precise drag, scale, crop, rotate, text, palette and product-zone controls.
2. **Agent Render** â€” the user describes the desired result and Nano Banana Pro generates a derived artwork/concept for the selected craft product.

These are modes inside one customization project, not separate funnels. The user may start with Agent Render, select a result, then switch to Manual Edit for exact placement. Every switch creates or continues the same revision history.

### Step 5 â€” Natural-language revisions

The Agent converts requests into typed operations:

- `set_scale`;
- `set_position`;
- `set_rotation`;
- `crop`;
- `remove_background`;
- `map_palette`;
- `add_text`;
- `change_product`;
- `change_variant`;
- `change_technique`.

The model may propose operations; the renderer applies validated parameters. The model never edits canonical coordinates through unvalidated free text.

### Step 6 â€” Approval

LOOMON separates:

- `concept preview`: attractive visual proposal;
- `production preview`: deterministic representation of placement and constraints;
- `approved production snapshot`: immutable asset hashes, transforms, product version, option version and price basis used by the order.

The user must approve the production snapshot, not merely a generated lifestyle image.

### Preview technology decision

LOOMON uses two deliberately separate preview engines:

1. **Deterministic production preview**
   - `react-konva`/Konva in the browser for drag, resize, rotate, crop, text and immediate interaction.
   - Product-specific layered templates: base photo, customization-zone mask, occlusion/highlight layer and normalized transform rules.
   - `Sharp` on the server to recreate and export the approved preview from the stored operations rather than trusting a browser screenshot.
   - A perspective/mesh-warp adapter is introduced only for curved templates that cannot be represented acceptably by the first layered templates.

2. **Agent Render**
   - Google Gemini API through the server-side `@google/genai` SDK and Interactions API.
   - Nano Banana Pro model code `gemini-3-pro-image` for complex product mockups, brand consistency and conversational image editing.
   - The API receives the uploaded image, selected product reference/template, protected-zone instructions, craft/technique constraints and the user's natural-language request.
   - Generated images are stored as new derived assets with provider, model, prompt hash, input hashes, output checksum, latency, request reference and moderation result.
   - Google applies SynthID to generated images; LOOMON retains that provenance and labels the output `Agent Render` or `Concept` in the UI.

Agent Render does not replace the production renderer. The safe pipeline is:

```text
uploaded source
-> Nano Banana Pro creates a derived flat artwork or concept
-> user selects a result
-> deterministic renderer places the selected artwork in the product zone
-> user can continue in Manual Edit
-> server exports the approved production snapshot
```

An AI lifestyle/product scene may be displayed for confidence and inspiration, but the printable/engraveable asset plus deterministic placement specification remains the manufacturing source of truth.

The Gemini API key remains server-only. Calls run through an `AgentRenderProvider` interface so provider/model changes do not alter customization-project data. Background removal remains a separate segmentation step behind its own provider adapter and is selected after evaluating representative logos, portraits, objects, thin-line artwork and hair/detail edges.

Natural language is converted to a typed operation before rendering. Example:

```json
{
  "type": "set_transform",
  "target": "uploaded-artwork",
  "x": 0.52,
  "y": 0.46,
  "scale": 0.68,
  "rotation_degrees": 0
}
```

The same normalized operation drives the browser preview, server render and production snapshot, making revisions reproducible.

## 5. Frontend direction

### Reuse

- The existing dark visual system, typography, spacing and green action treatment.
- Pinterest-like feed as an inspiration gallery.
- Product card/detail quality.
- Bottom iOS-style navigation and centered Agent action.
- Existing profile, wallet and order visual language where relevant.
- Existing custom-logo upload styling as a smaller component inside the new creation workspace.

### Upload decision panel

After the upload box in the current quote/customization area, show a clean two-option selector:

- **Edit manually** â€” subtitle: â€œPlace and adjust it yourself.â€
- **Render with Agent** â€” subtitle: â€œDescribe the result and let the Agent create it.â€

`Render with Agent` may be visually recommended, but neither option is hidden. On desktop the cards sit side by side; on mobile they stack. Once selected, they become a compact segmented control above the canvas so the user can switch without losing work.

Manual mode opens the canvas and precise controls. Agent mode opens a prompt composer, short suggestion chips, render progress, and a small result strip. Selecting an Agent result opens it in the same canvas for manual finishing.

### Change

- `/app` becomes upload-first or directs immediately to `/create`.
- Product feed becomes secondary â€œInspirationâ€ rather than the primary funnel.
- Agent panel becomes a persistent creation collaborator with project/revision context.
- Product detail opens within the customization project instead of leaving the flow.
- Checkout reads the approved customization snapshot, never a frontend estimate.
- Orders show the approved design and revision/evidence history.

### New route proposal

```text
/                 landing
/create           upload and customization workspace
/inspiration      existing Pinterest-style gallery
/products/[slug]  curated base product detail
/projects/[id]    saved customization project
/checkout/[id]    order summary and Arc action
/orders            order history
/orders/[id]       custom order detail
/profile           identity, wallet, projects and orders
```

## 6. Architecture

```mermaid
flowchart LR
  Upload["Private image upload"] --> Storage["Supabase Storage"]
  Storage --> Scan["Validation, moderation, EXIF strip"]
  Scan --> Analyze["Image analysis worker"]
  Analyze --> Agent["Customization Agent"]
  Catalog["Curated craft catalog and templates"] --> Agent
  Agent --> Ops["Typed customization operations"]
  Ops --> Renderer["Deterministic preview renderer"]
  Renderer --> Preview["Versioned preview"]
  Preview --> Approve["Approved production snapshot"]
  Approve --> Order["Supabase custom order"]
  Order --> Policy["Agent delegation and risk gate"]
  Policy --> Wallet["Buyer or Buyer Agent smart account"]
  Wallet --> Arc["Arc Testnet USDC escrow"]
  Arc --> Projector["Event projector"]
  Projector --> Order
```

## 7. Database direction

The new MVP database is normalized for customization first and marketplace expansion later. Do not implement the previous full marketplace schema now.

### `identity`

- `profiles`
- `addresses`
- `preferences`

### `catalog`

- `craft_partners`: curated provenance identity; no public seller login required.
- `products`: stable base product.
- `product_versions`: immutable physical/commercial specification.
- `product_localizations`.
- `variants` and `variant_options`.
- `customization_techniques`: decal, print, engraving, embroidery, hand-painted interpretation.
- `customization_zones`: normalized coordinates, aspect/size/detail/color constraints.
- `mockup_templates`: base image, masks, warp/blend renderer version.
- `materials`, `techniques`, `regions` and product relations.
- `price_rules` and `production_rules`.
- `media_assets`.

### `customization`

- `projects`: owner/guest claim, selected product/version, lifecycle.
- `source_assets`: private storage object, checksum, dimensions, MIME, rights declaration, moderation state.
- `asset_analyses`: model/version, structured analysis, confidence and warnings.
- `project_assets`: source/derived/cutout relation.
- `revisions`: immutable revision number, parent revision, Agent run and renderer version.
- `operations`: typed operation, validated parameters and ordering.
- `preview_renders`: deterministic/generative type, output asset, status and renderer/model provenance.
- `production_snapshots`: immutable approved revision, asset hashes, transforms and constraint result.

### `agent`

- `conversations`, `runs`, `tool_calls`.
- `project_contexts`.
- `goals`: user-owned objective, scope, success condition, autonomy mode, budget and expiry.
- `tasks`: Agent-created plan steps, dependencies, state and retry/escalation policy.
- `observations`: typed tool/event results attached to a task.
- `event_subscriptions`: order/project/wallet events that may resume an active goal.
- `scheduled_continuations`: next eligible run, deduplication key and attempt budget.
- `suggestions` and user confirmations.
- `transaction_intents`, `simulations`, `risk_decisions`, `approvals`, `execution_attempts`.

### `commerce`

- `carts` and `cart_items`.
- `orders`.
- `order_items`: product/version + approved production snapshot.
- `order_amounts`: integer atomic amounts.
- `order_status_history`.
- `fulfillment_updates` and `evidence`.
- `refund_requests`.

### `wallet` and `payments`

- linked user accounts;
- buyer Agent smart accounts;
- delegations/capabilities/budgets/session-key references;
- payment intents;
- contract versions and escrow instances;
- chain events, projector cursors and reconciliation.

### Deferred schemas/tables

- maker memberships;
- public seller publication workflow;
- follows/reviews/seller statistics;
- marketplace quotes across independent sellers;
- seller Agent wallets and multi-seller settlement.

## 8. Contract direction

The first contract is a narrow curated-store custom-order escrow, not the full marketplace contract.

### Roles

- buyer;
- LOOMON merchant/fulfillment account;
- independent resolver/multisig;
- optional buyer Agent operator;
- limited platform operations Agent for relaying/monitoring only.

### Onchain data

- order ID;
- approved terms/production snapshot hash;
- buyer and merchant;
- USDC token and exact amount;
- Agent operator permissions/expiry/revocation nonce;
- funded/released/refunded/claimable accounting;
- deadlines and state.

### State model

```text
created -> funded -> design_approved -> fulfillment_confirmed -> settled
                    \-> cancelled/refunded
funded|design_approved -> disputed -> resolved
```

Manufacturing details, image and address stay in Supabase. Only their approved commitment hash is placed onchain.

### Commands

- `fund()`
- `approveDesign(snapshotHash)`
- `confirmFulfillment(evidenceHash)`
- `requestCancellation(reasonHash)`
- `raiseDispute(reasonHash)`
- `resolveDispute(buyerAmount, merchantAmount)`
- `withdraw()`
- `setBuyerOperator(...)`
- `revokeBuyerOperator(...)`

No arbitrary Agent execution, upgrade of an active escrow or admin seizure.

### Deployment stages

1. Simulated offchain state machine.
2. Foundry unit/fuzz/invariant tests.
3. Arc Testnet deployment.
4. Human-wallet E2E.
5. Buyer Agent smart-account E2E with bounded delegation.
6. Pilot evaluation before any mainnet or marketplace extension.

## 9. Agent direction

The Agent has four responsibilities.

The centered dock Agent button is the primary Arc showcase. It opens a personal-commerce workspace where the user can delegate an outcome and budget, see the Agent create and pay for an approved order, and inspect every ongoing order the Agent is managing. Discovery/chat remains available, but it is secondary to goal delegation and autonomous order management.

### Creative Agent

- analyzes the upload;
- explains limitations;
- recommends compatible products;
- proposes typed visual revisions;
- generates concept alternatives;
- helps produce a deterministic production snapshot.

### Commerce Agent

- collects quantity, deadline, shipping destination and budget;
- computes only from canonical product/price rules;
- prepares the order snapshot;
- tracks production and reminders.

### Wallet Agent

- creates a typed Arc action;
- checks delegation, contract, token, recipient, amount and budget;
- simulates before signing;
- executes only within policy;
- records the complete audit trail.

### Heritage guide

- explains the craft product, region, material and technique;
- shows how the uploaded image will be adapted respectfully to the craft;
- never invents maker history or provenance.

The model is not the renderer, price authority or signer. It orchestrates validated tools in all three cases.

### Agent operating model: goal-directed, event-driven and bounded

LOOMON must not implement the Agent as a fixed chain of `if/else` screens. The user gives a goal, and the Agent decides the next useful steps inside a declared scope.

```text
User goal or system event
-> load canonical context and memory
-> create/update a multi-step plan
-> choose a semantic tool
-> execute or request approval
-> observe the result
-> revise the plan
-> finish, schedule a continuation, or escalate
```

Examples of real Agent goals:

- â€œTurn this family photo into a meaningful Vietnamese souvenir under 50 USDC.â€
- â€œPrepare three options and stop when one is production-ready.â€
- â€œManage this order for me and only ask if the amount changes or delivery is at risk.â€
- â€œWatch this order and handle routine follow-up until delivery.â€

Each run is bounded by maximum steps, time, model/tool cost, wallet budget and deadline. Long-lived goals sleep after making progress and resume from a relevant event or schedule; they do not run an uncontrolled infinite loop.

### Where Agent judgment should be maximized

| Area | Agent authority |
|---|---|
| Understand an upload | Analyze meaning, quality, visual style and likely intent; ask only useful missing questions. |
| Creative direction | Generate concepts, compare alternatives and interpret natural-language revisions. |
| Product matching | Rank compatible products after deterministic hard constraints pass. |
| Plan the workflow | Decide whether to analyze, render, ask, compare, revise or wait next. |
| Project management | Track unfinished work, deadlines, approvals and fulfillment risk. |
| Communication | Draft contextual updates and proactively notify through already-approved channels. |
| Routine recovery | Retry transient tools, select a safe fallback provider and explain failures. |
| Wallet operations | Prepare and execute exact low-risk actions inside an explicit delegation and budget. |
| Personalization | Remember confirmed tastes, typical quantities, language and preferred craft styles. |

### Where Agent may propose but a human or authority must decide

| Area | Required authority |
|---|---|
| Final production design | User explicitly approves the immutable production snapshot. |
| New or changed price/lead time | Canonical catalog/merchant confirmation. |
| Amount above wallet threshold | Wallet owner approval. |
| New contract, token or recipient | Wallet owner/policy administrator approval. |
| Change of delivery address/email consent | User confirmation. |
| Unclear copyright, safety or manufacturability | Human review. |
| Dispute outcome | Independent resolver, never the representing Agent. |

### What must stay deterministic and non-agentic

- authentication and RLS;
- money arithmetic, taxes/fees and price lookup;
- product-zone geometry and production constraint validation;
- file checksum, MIME validation, moderation enforcement and storage access;
- contract permissions, nonce, expiry and accounting;
- transaction simulation/receipt/event verification;
- idempotency and state-transition legality;
- audit retention and consent records;
- emergency freeze and delegation revocation.

The Agent can interpret these results and choose what to do next, but it cannot override them.

### Semantic Agent tool surface

Prefer tools such as:

- `analyze_uploaded_artwork(project_id)`
- `find_compatible_products(project_id, constraints)`
- `create_agent_render(project_id, instruction)`
- `apply_customization_operation(project_id, revision_id, operation)`
- `validate_production_snapshot(project_id, revision_id)`
- `prepare_custom_order(project_id)`
- `watch_order(order_id, escalation_policy)`
- `fund_approved_order(order_id)`
- `request_permitted_refund(order_id, reason)`

Do not expose `run_sql`, `update_any_row`, `call_contract(address, calldata)` or a general private-message sender to the model.

### Memory boundaries

The Agent may retain confirmed user preferences and goal state. It must attach source, confidence, scope and expiry to memory. It never stores private keys, signing secrets, full payment credentials, unconfirmed inferences as facts, or private order data in global/shared memory.

## 10. Checkpoints

### C0 â€” Pivot lock

- Approve this document.
- Mark marketplace plans deferred.
- Decide the first three curated souvenir products and techniques.
- Decide whether the demo accepts only Arc Testnet or also creates a real offchain inquiry.

Gate: product scope and success metrics approved.

### C1 â€” Upload and deterministic preview prototype

- Build `/create` using the existing design system.
- Private upload, validation and local/demo renderer.
- One product, one customization zone, scale/position/crop controls.
- Natural-language request converted to typed operations.

Gate: ten representative images render without distortion and revisions are reproducible.

### C2 â€” Normalized Supabase customization foundation

- Implement only identity, curated catalog, customization project/revision, storage and Agent audit tables.
- Add RLS and private asset policies.
- Add pgTAP tests and generated types.

Gate: database rebuilds from zero and one project can be replayed to the exact preview.

### C3 â€” Agent image workflow

- Image analysis, compatibility ranking and revision tools.
- Provenance and prompt-injection boundaries.
- Evaluation dataset for logos, photos, line art, low-resolution and unsafe images.

Gate: Agent recommendations satisfy hard production constraints before semantic preference.

### C4 â€” Order and Arc Testnet

- Add order snapshot/payment tables.
- Implement narrow escrow with Foundry TDD.
- Human wallet checkout and event projector.

Gate: approved snapshot â†’ exact USDC fund â†’ event projection â†’ tracked order passes E2E.

### C5 â€” Buyer Agent wallet

- Add buyer Agent smart account and bounded delegation.
- Simulate every action and require human approval over threshold.
- Test revoke, expiry, replay, wrong contract/token/recipient and emergency freeze.

Gate: Agent completes a permitted Testnet order and cannot exceed policy.

### C6 â€” Pilot and marketplace decision

Measure:

- upload-to-first-preview completion;
- time to acceptable preview;
- average revision count;
- product recommendation acceptance;
- design approval rate;
- Arc checkout completion;
- Agent intervention/escalation/denial rate;
- pilot manufacturing feasibility and user satisfaction.

Only after C6 decide whether to expand into seller onboarding and the deferred marketplace architecture.

## 11. MVP success criteria

- At least three curated craft souvenir types with real customization constraints.
- A user can reach a meaningful preview within two minutes.
- Preview transformations are reproducible and do not distort uploaded images unexpectedly.
- Every approved order references an immutable production snapshot.
- The Agent explains why a product/technique is compatible.
- The Agent never invents price, provenance or production capability.
- Arc Testnet payment and event projection reconcile exactly.
- Agent wallet actions are bounded, revocable and fully auditable.
- No uploaded image is public by default.
- Marketplace work remains deferred until pilot metrics justify it.

## 12. Immediate next action

Do not start the old 18-migration marketplace chain or the multi-party marketplace escrow.

The next implementation task after approval is C1:

1. select three base souvenir products;
2. define customization zones and production constraints;
3. redesign `/create` as the upload-first workspace;
4. build a deterministic preview prototype before database and contract implementation.
