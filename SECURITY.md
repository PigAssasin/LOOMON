# Security Policy

LOOMON is a demo marketplace that handles wallet sessions, private order assets, Arc testnet transactions, and Supabase data. Treat the repository as public.

## Supported Scope

Security review should focus on:

- Next.js API routes under `app/api/`
- wallet sign-in and Supabase session bridging
- order, escrow, proof, and chat authorization
- upload and signed asset access
- Arc transaction verification and projection
- Supabase migrations, RLS policies, and service-role usage
- contract source under `contracts/src/`

## Secret Handling

Never commit:

- `.env`, `.env.local`, or production environment files
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `ARC_DEPLOYER_PRIVATE_KEY`
- `ARC_PROOF_MINTER_PRIVATE_KEY`
- Vercel project metadata
- Foundry broadcast artifacts or private deployment output

Use `.env.example` only as a variable-name template.

## Reporting

For private disclosures, open a private GitHub security advisory or contact the repository owner directly. Do not publish exploit details before the fix is available.

## Expected Controls

- Server routes must verify the signed wallet session before reading private order data.
- Order APIs must verify buyer/seller access from Supabase ownership or escrow participant addresses.
- Arc lifecycle projection must verify transaction receipt, sender, target contract, event name, and order id.
- Private assets must use short-lived signed URLs.
- Service-role clients must remain server-only.
- User-facing agents must not silently sign, pay, accept, refund, deliver, or send buyer-seller messages.

