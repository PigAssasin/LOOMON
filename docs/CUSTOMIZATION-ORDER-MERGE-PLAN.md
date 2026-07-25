# LOOMON — Customization and Order Merge Plan

Status: implemented, verified and deployed to Production  
Date: 2026-07-25  
Primary rulebook: `codex.md`  
Compared against:

- `docs/BUYER-SELLER-ORDER-PROFILE-CORRECTION-PLAN.md`
- `docs/BASIC-COMMERCE-COMPLETION-PLAN.md`
- `design.md/DESIGN.md`
- `design.md/theme.css`
- `design.md/variables.css`
- `design.md/tokens.json`

## Outcome

Replace the two-page customization → quote-review journey with one continuous
product-side workflow:

```text
Customize with agent
-> choose artwork/text/reference
-> optionally render and select an AI preview
-> enter quantity, optional needed-by date and maker note
-> Place order
-> connect/sign wallet when required
-> create one canonical seller request
-> show an explicit success confirmation
-> open the request in Orders
```

`Place order` means sending a seller-review order request. Nothing is charged
and the canonical order is still created only after seller acceptance.

## Checkpoints

### M0 — Reproduce and isolate the silent submit

Status: complete.

- Inspect the current production interaction and console.
- Ensure a click always produces one visible state: wallet modal, loading,
  success, or plain-language error.
- Never silently return when the saved brief or wallet modal is unavailable.

Exit: the primary control cannot fail without visible feedback.

### M1 — Normalize the customization draft

Status: complete.

- Upgrade the saved customization schema.
- Store quantity, optional needed-by date and maker note with the same
  product-specific draft.
- Preserve schema-v4 drafts and uploaded files/previews.
- Keep the product MOQ as the minimum and default.

Exit: refresh/reopen restores all order fields with the customization.

### M2 — Merge order submission into the studio

Status: complete.

- Add compact quantity/date/note fields to the final brief state.
- Replace `Continue with this brief` with `Place order`.
- Reuse the existing idempotent Supabase quote command, asset upload,
  Web3 wallet authentication and wallet sync.
- Remove the intermediate quote page from the normal product flow.
- Keep `/app/quotes/new` as a compatibility redirect back to the product
  customization surface.

Exit: one overlay owns the complete product-to-request flow.

### M3 — Success and error feedback

Status: complete.

- Show a clear success state inside the same overlay.
- Include the public request/project reference and a `View orders` action.
- Keep the brief if wallet connection, signature, upload or submission fails.
- Map infrastructure errors to plain buyer-facing copy.

Exit: successful placement is unmistakable and retry remains safe.

### M4 — Verification and release

Status: complete.

- Add/update unit tests for schema migration and approved brief behavior.
- Run TypeScript, ESLint, Vitest and Next production build.
- Browser-test Customize with agent → fields → Place order feedback.
- Check console health and responsive rendering.
- Commit, push and deploy Vercel Production only after verification passes.

Exit: production presents one simple order workflow with no silent submit.

Verification evidence:

- TypeScript and ESLint pass.
- Vitest: 10 files and 38 tests pass.
- Next.js production build passes.
- Desktop and 390 × 844 mobile rendering pass.
- Clean-wallet browser test: `Place order` opens RainbowKit immediately.
- Closing the wallet chooser renders
  `Order not placed. Connect your wallet when you are ready.`
- IndexedDB writes are serialized so a stale autosave cannot overwrite the
  latest brief/order fields.
- Production deployment `dpl_uEsZ7aGKHM51RcDBi5AgeGhwW8k2` is Ready and
  aliased to `https://loomon.vercel.app`.
- Vercel reported no error/fatal runtime logs in the release window.

Configuration follow-up:

- Add a valid free `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` from Reown to remove
  the current remote-config warning and make WalletConnect/Rainbow mobile QR
  connectivity production-complete. Injected wallet extensions and the
  RainbowKit chooser already render and respond.
