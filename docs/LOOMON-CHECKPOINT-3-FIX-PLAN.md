# LOOMON Checkpoint 3 Fix Plan

Date: 2026-08-08

## Goals

Complete the Checkpoint 3 polish and reliability pass for LOOMON:

- prepare a better product presentation deck package for Canva;
- fix seller order acceptance so accepting one order never accepts unrelated orders;
- run Codex Security scan, validate findings, and patch real issues;
- restyle default dropdown/toggle lists to match the LOOMON dark craft UI;
- move buyer/seller order chat out of the production brief detail and into the dock chat panel;
- preserve order chat history across buyer/seller sessions;
- answer wallet-to-Supabase account persistence expectations;
- redesign `/app/docs` into a GitBook-style documentation surface;
- verify locally and deploy to Vercel.

## Current Findings

- `typecheck`, `lint`, unit tests, and production build passed before changes.
- `test:e2e` is currently misconfigured: Playwright scans Vitest `*.test.ts` files and fails.
- `.env.local` is missing some Arc, WalletConnect, and text-model keys from `.env.example`.
- Canva connector is not installed or available in this session. The practical deliverable is a Canva-ready slide outline/assets package and the existing Canva link can be updated manually unless a Canva connector is later installed.
- Vercel connector is available; Vercel CLI is not installed.

## Work Plan

### 1. Order Acceptance Isolation

- Inspect seller order action UI and API route for escrow confirmations.
- Verify whether the UI updates all orders with the same status or same pending action after one accept.
- Ensure optimistic state and server refetch are scoped by `order.id`.
- Add or update tests around accepting one order while sibling orders remain unchanged.

### 2. Buyer/Seller Chat Model

- Remove inline buyer/seller chat composer from the order detail production brief.
- Keep order notes, uploaded/selected images, and timeline visible in the order detail.
- Add a `Chat` action on the order detail that opens the existing dock/agent panel.
- Pass order context into the dock chat so messages are tied to that order.
- Ensure persisted history is read from and written to Supabase for the order conversation.

### 3. Dropdown/Toggle Styling

- Find default `select`, `details`, or native toggle controls in discovery/product surfaces.
- Replace native-looking dropdown lists with a LOOMON-styled popover/menu component.
- Match existing dark UI: compact spacing, fine border, muted labels, ivory text, green active state.
- Verify keyboard/focus behavior and mobile layout.

### 4. GitBook-Style Docs

- Redesign `/app/docs` as a documentation app, not a plain marketing block.
- Add sidebar sections, active item state, top search/chrome, readable content column, copy buttons, and responsive mobile navigation.
- Use LOOMON branding and dark visual language, inspired by GitBook-style information architecture.

### 5. Security Scan And Patches

- Run Codex Security Standard Scan for the repository.
- Validate all reported issues against source.
- Patch confirmed vulnerabilities only.
- Run focused regression checks after patches.

### 6. Wallet Supabase Persistence

- Document the expected architecture: wallet sign-in should map one wallet address to one Supabase user/profile, so any device can recover profile, orders, and chat after wallet proof.
- Verify current wallet bridge/session code against that expectation.
- Add docs or TODO only if a production gap remains.

### 7. Canva Presentation Package

- Create or update a slide brief with a cleaner 8-10 slide product story:
  1. LOOMON one-line value proposition
  2. problem in custom souvenir commerce
  3. product walkthrough
  4. buyer flow
  5. seller workflow
  6. agent assistance
  7. Arc escrow and proof layer
  8. demo architecture
  9. traction/checkpoint evidence
  10. next steps
- Provide concise copy that can be pasted into Canva.
- Include live demo, repo, and presentation links for the submission form.

### 8. Verification And Deploy

- Run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, and `npm.cmd run build`.
- Use browser/Playwright verification for the changed UI flows.
- Deploy through the Vercel connector if local checks pass.

## Acceptance Criteria

- Accepting one seller order updates only that order.
- Seller order detail no longer contains the embedded chat block.
- The order-level Chat button opens the dock chat with the correct order context.
- Chat messages persist and reload for the relevant buyer/seller order conversation.
- Dropdowns no longer look like browser-default selects.
- `/app/docs` looks and behaves like a polished docs experience.
- Security scan findings are either patched or explicitly documented as rejected/low-risk with evidence.
- Production build passes before deployment.
