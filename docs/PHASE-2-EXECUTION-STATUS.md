# LOOMON Phase 2 execution status

Ngày cập nhật: 2026-07-23

Git checkpoint:

- branch: `codex/phase-2-agent-commerce`
- latest pushed commit: `88d8db4`
- PR link thủ công: `https://github.com/PigAssasin/LOOMON/pull/new/codex/phase-2-agent-commerce`

Vercel checkpoint:

- production: `https://loomon.vercel.app`
- deployment URL: `https://loomon-nthuyj2zv-pigassasins-projects.vercel.app`
- `/` checked: HTTP 200
- `/app` checked: HTTP 200

## Scope đã chốt

LOOMON hiện đi theo hướng custom souvenir demo trước marketplace:

- Buyer tìm sản phẩm thủ công Việt Nam phù hợp.
- Buyer tự chọn sản phẩm cuối cùng.
- Buyer có thể tải artwork/text/ý tưởng.
- Agent Render dùng ảnh sản phẩm gốc + ảnh buyer tải lên để tạo preview nền trắng, tối đa 3 batch x 3 ảnh.
- Buyer có thể bỏ qua AI render và gửi brief/text/ảnh cho seller.
- Seller nhận order/brief, trao đổi với buyer qua buyer-seller chat riêng.
- Personal Agent là một trợ lý xuyên suốt cho tìm sản phẩm, quản lý đơn, tóm tắt/dịch/draft/nhắc việc, đặt/hủy đơn theo yêu cầu tự nhiên.
- Agent không tự chọn sản phẩm cuối cùng thay buyer.
- Agent không tự gửi tin nhắn thay buyer/seller nếu chưa được phép.
- Agent có ví riêng, nhưng model chỉ tạo typed intent; policy gateway/signer mới được phép ký.

## Database checkpoint

Đã tạo migration:

- `supabase/migrations/0006_agent_commerce_flow.sql`

Migration này bổ sung các lớp chính:

- `customization`: project, uploaded asset, asset analysis, render batch, render candidate, approved brief.
- `messaging`: thread, participant, message, attachment cho chat buyer-seller-agent.
- `agent`: identity, goal, run, observation, tool call metadata, wallet intent.
- `wallet`: agent wallet, delegation policy.
- `commerce`: order brief, action request.
- `payments`: contract version, escrow instance, chain event.

Đã cập nhật:

- `supabase/config.toml` để PostgREST expose `customization` và `messaging`.
- `supabase/tests/database/0006_agent_commerce_flow.test.sql` cho các gate schema/RLS/constraint.

Chưa thể chạy `supabase db reset` vì Docker Desktop chưa chạy trên máy local. Khi Docker sẵn sàng, gate tiếp theo:

```powershell
npx.cmd supabase db reset
```

## Contract checkpoint

Đã tạo Foundry project trong:

- `contracts/foundry.toml`
- `contracts/src/LoomonEscrow.sol`
- `contracts/test/LoomonEscrow.t.sol`
- `contracts/script/Deploy.s.sol`

Contract hiện có:

- `LoomonEscrowFactory`: deploy một escrow riêng cho từng mã đơn.
- `LoomonOrderEscrow`: seller accept quote, buyer/agent wallet fund, cancel, release, dispute, resolver split payout.
- Agent wallet được mô hình hóa là `buyerOperator` có expiry, allowance và policy hash.
- Payout dùng pull pattern qua `withdraw()`.

Đã verify:

```powershell
forge fmt --check
forge test -vvv
```

Kết quả contract test:

- 6 passed
- 0 failed

Test đã cover:

- factory tạo escrow một lần theo `orderId`;
- merchant accept quote;
- buyer fund + release;
- agent wallet fund/cancel trong policy;
- agent wallet hết hạn bị chặn;
- agent wallet vượt allowance bị chặn;
- resolver split dispute.

## Arc deploy gate

Arc Testnet config theo docs chính thức:

- chain id: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- explorer: `https://testnet.arcscan.app`
- USDC ERC-20 interface: `0x3600000000000000000000000000000000000000`

Không commit private key. Không đưa private key vào file. Deploy chỉ chạy khi key được đặt trong terminal local:

```powershell
$env:LOOMON_PAYMENT_TOKEN='0x3600000000000000000000000000000000000000'
$env:LOOMON_RESOLVER='<resolver-wallet-address>'
$env:PRIVATE_KEY='<testnet-private-key-local-only>'
forge script script/Deploy.s.sol:Deploy --rpc-url https://rpc.testnet.arc.network --broadcast --private-key $env:PRIVATE_KEY
```

## Web deploy gate

Trước khi push/deploy:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
forge fmt --check
forge test -vvv
```

Vercel production deploy cần set env trong Vercel, không commit secret:

- `GEMINI_API_KEY`
- `GEMINI_IMAGE_MODEL`
- Supabase URL/anon/service role khi backend API thật được nối.
- Contract factory address sau khi deploy Arc.

## Việc còn lại ngay sau checkpoint này

1. Chạy Docker Desktop rồi reset/test Supabase migration.
2. Deploy `LoomonEscrowFactory` lên Arc Testnet bằng env secret local.
3. Ghi deployment address vào `contracts/deployments/arc-testnet.json`.
4. Tạo API layer nối frontend với Supabase tables.
5. Tạo projector đọc event Arc và cập nhật `payments.escrow_instances`.
6. Push GitHub.
7. Deploy Vercel.
