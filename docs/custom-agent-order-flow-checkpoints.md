# Custom with Agent order flow checkpoints

Date: 2026-07-27

## Goal

Simplify the buyer flow after clicking `Custom with agent` so it feels like one clear order sheet instead of a multi-step wizard.

## Target buyer flow

1. Buyer opens a product and clicks `Custom with agent`.
2. A single right-side panel opens with:
   - Product reference image.
   - Optional upload: image/artwork to print on product.
   - Optional text: text to print on product.
   - Optional AI render: generate previews only when the buyer provided image or text.
   - Optional selected preview: buyer can pick one generated image.
   - Notes to seller.
   - Quantity.
   - Desired receive date.
   - One primary button: `Place order`.
3. If the buyer does not want customization, they can leave image/text empty and still place the order.
4. If AI render is used, it is a paid optional action, priced around 0.01 USDC per image on testnet/demo.
5. `Place order` should create the real order record and use the active blockchain/database payment flow.

## Product/platform constraints

- Keep the UI minimal, dark, clean, and consistent with the LOOMON design system.
- Avoid duplicate buttons like `Continue brief` and `Review and place your order`.
- AI render prompt should be fixed internally; the visible text area is seller notes, not a model prompt.
- Profile edits should persist to Supabase, not local-only state.
- Do not expose private keys or service-role keys in client code, logs, docs, or commits.

## Checkpoints

- [x] Inspect current customization component and identify why the old flow feels split.
- [x] Replace the multi-step brief/review UI with one single form.
- [x] Keep AI render optional and gated by image/text input.
- [x] Keep generated preview selection working before order placement.
- [x] Verify profile save path uses Supabase RPC/table update.
- [x] Run typecheck, lint, tests, and build.
- [x] Commit, push, and deploy after checks pass.

## Follow-up checkpoint

- [ ] Add a real Arc testnet render-fee transaction before AI preview generation. The current implementation keeps AI preview optional and real, but does not yet charge the separate preview fee.
