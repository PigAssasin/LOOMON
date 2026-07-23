# LOOMON - Personal Agent Commerce Flow

Status: current product direction addendum
Date: 2026-07-23
Applies to: `docs/CUSTOM-SOUVENIR-MVP-PLAN.md`, `codex.md`

## 1. Core decision

LOOMON must feel like one continuous personal-commerce assistant, not separate product, render, wallet and order screens.

The centered green Agent button is the main entry point. A user can ask it to find suitable products, explain tradeoffs, customize a chosen item, approve a demo, place an order, cancel an order and track the result. The user may still use normal Web2 screens, but the Agent should be able to drive the same workflow through conversation.

The Agent is allowed to do nearly every routine commerce action through natural language once the user has granted scope and budget. Two actions stay explicitly human-controlled:

- choosing the final product to order;
- sending buyer-seller messages as a buyer/seller identity.

## 2. Buyer flow

```text
1. User opens Personal Agent.
2. User describes need, budget, quantity, occasion, material or style.
3. Agent searches only canonical compatible products.
4. Agent returns product cards with evidence and links.
5. User chooses a product.
6. Product opens with "Customize with Agent".
7. User uploads artwork/photo OR enters text/maker notes.
8. User chooses:
   A. Agent Render
   B. Continue without AI render
9. Agent Render creates 3 demos per batch.
10. User may reload up to 3 total batches, maximum 9 demos.
11. User selects one demo OR sends only the uploaded file/text/maker notes.
12. Agent prepares order terms from canonical catalog/order rules.
13. User approves budget/delegation.
14. Agent wallet can fund the approved Arc order within policy.
15. Agent can cancel or request cancellation by natural-language command when policy/order state allows it.
16. Buyer, seller and Agent track the same order state.
```

## 3. Render rules

- One customization project may create at most 3 render batches.
- Each batch returns exactly 3 images.
- Total maximum is 9 generated demo images per customization project.
- The reload action means "create another batch of 3", not regenerate forever.
- The UI must show remaining render attempts clearly, for example `2 render rounds left`.
- User can continue without rendering at any time after minimum required brief data exists.
- User input under the textarea is `maker notes`, not a free model prompt.
- The server owns the fixed render prompt and product-locking rules.
- Render inputs are always:
  - selected product reference/template;
  - optional uploaded artwork;
  - optional text/maker notes;
  - fixed server prompt;
  - product constraints.

## 4. Non-AI customization path

The user can skip AI demo generation. Valid non-AI brief types:

- uploaded image only;
- uploaded image plus notes;
- text only;
- text plus production notes.

This path creates a seller-facing brief and lets the seller contact the buyer or prepare the design manually. It must not block checkout/inquiry only because no AI preview exists.

## 5. Personal Agent scope

The Personal Agent can:

- search and recommend products;
- explain why products fit or fail;
- open a product/customization route with context;
- summarize the selected product and customization state;
- prepare an order from an approved demo or non-AI brief;
- place the order after the user has chosen the product and approved the bounded order policy;
- cancel or request cancellation from natural language when the order state and policy allow it;
- ask for missing quantity, deadline, address, email or budget;
- request user approval for payment/delegation;
- use its own Arc smart account to fund an approved order within policy;
- monitor payment, seller acceptance, production milestones and reminders;
- answer status questions from anywhere in the app.

The Personal Agent should not be the image upload box itself once the user enters the customization studio. Upload/render belongs to the product customization workflow. The Agent can launch and explain that workflow, then continue tracking it.

## 6. Agent wallet model

The Agent has its own Arc smart account and may act only inside explicit user delegation.

Allowed autonomous actions for MVP:

- create order draft;
- reserve approved budget;
- fund the exact approved Arc order;
- monitor transaction and order status;
- send safe reminders;
- request permitted refund when policy allows;
- escalate if amount, recipient, contract, address, or deadline changes.

Never allowed:

- choose the final product on behalf of the user;
- choose its own spending permission;
- raise its own budget;
- change payment recipient;
- sign arbitrary calldata;
- bypass final user approval for a new order;
- resolve disputes for either side.

## 7. Buyer-seller chat

LOOMON needs a dedicated chat between buyer and seller, separate from Personal Agent chat.

Buyer-seller chat rules:

- one thread per order or customization project;
- visible to the buyer, seller/maker members, and authorized support;
- Agent may summarize, translate, draft, remind and extract action items;
- Agent may not silently send messages as the buyer or seller without explicit permission;
- attachments can include source images, generated demos, approved brief, seller proof, invoice and shipping evidence;
- important commitments must be promoted into structured order state, not left only in chat text.

## 8. Required data model additions

### `customization`

- `render_batches`
  - project id;
  - batch number 1-3;
  - status;
  - provider/model;
  - input asset hashes;
  - fixed prompt version;
  - notes hash;
  - created by Agent/user;
  - cost/latency metadata.

- `render_candidates`
  - batch id;
  - candidate number 1-3;
  - output asset;
  - selected state;
  - quality flags.

- `briefs`
  - project id;
  - selected product/version;
  - selected candidate nullable;
  - uploaded asset nullable;
  - text/maker notes;
  - no-ai flag;
  - status.

### `agent`

- `conversations`
- `messages`
- `conversation_contexts`
- `goals`
- `tool_calls`
- `recommendation_sets`
- `delegations`
- `wallet_intents`

### `commerce`

- `orders`
- `order_items`
- `order_status_history`
- `order_participants`
- `order_chat_threads`

### `messaging`

- `threads`
- `thread_participants`
- `messages`
- `message_attachments`
- `message_agent_actions`
- `message_read_receipts`

## 9. Tool contracts the Agent needs

- `search_products(intent)`
- `get_product_details(product_id)`
- `start_customization_project(product_id)`
- `create_render_batch(project_id)`
- `select_render_candidate(project_id, candidate_id)`
- `save_non_ai_brief(project_id, payload)`
- `prepare_order_from_brief(project_id)`
- `place_order_from_approved_brief(project_id, order_policy)`
- `cancel_order(order_id, reason, mode)`
- `request_payment_delegation(order_id, budget_policy)`
- `fund_order_with_agent_wallet(order_id)`
- `get_order_status(order_id)`
- `watch_order(order_id, escalation_policy)`
- `open_buyer_seller_thread(order_id)`
- `draft_seller_message(thread_id, goal)`
- `send_message_with_user_approval(thread_id, message_id)`

All tool inputs and outputs must use runtime schemas, authorization checks and audit logging. The model never receives SQL access, private keys, raw service-role permissions or arbitrary contract calldata.

## 10. Frontend implications

Near-term UI changes after current demo:

- Personal Agent search results should show product cards and `Customize` links.
- Product/customization state must be visible to the Personal Agent as page context.
- Customization studio should support up to 3 render batches / 9 candidates.
- Render UI needs `Reload 3 demos` with remaining attempt count.
- The `Continue` path must create a no-AI seller brief.
- Order flow should accept both selected AI candidate and no-AI brief.
- Add a seller chat route/panel tied to the order.
- Order detail should show:
  - approved demo or no-AI brief;
  - buyer-seller chat;
  - Agent watch/status;
  - payment/delegation trace.

## 11. Checkpoints

### A0 - Align current frontend demo

- Update Customization Studio to store render batch count and up to 9 candidates.
- Keep `Continue` path for no-AI brief.
- Ensure Personal Agent search can deep-link into customization.

Gate: user can search -> choose product -> customize -> choose render/no-render path.

### A1 - Supabase schema

- Implement project, asset, render batch/candidate, brief, conversation and messaging tables.
- Add RLS and storage policies.
- Add tests for cross-user access denial.

Gate: one project/order/chat can be rebuilt from the database without localStorage.

### A2 - Agent tools

- Implement typed tools for search, project creation, render batches, brief saving and order preparation.
- Add audit trace from chat message to tool call to database result.

Gate: Personal Agent can drive the same flow as UI buttons.

### A3 - Wallet/order

- Add Agent wallet delegation, risk gate and Arc Testnet payment execution.
- Agent can fund only exact approved orders within policy.

Gate: chat-only order placement works on Arc Testnet with full audit.

### A4 - Buyer-seller chat

- Add order chat thread, attachments, read receipts and Agent summarize/draft helpers.

Gate: seller can respond to buyer with the approved brief and images visible in context.
