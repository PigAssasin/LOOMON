import Link from "next/link";
import {
  Bot,
  Check,
  ChevronRight,
  Coins,
  Copy,
  Image as ImageIcon,
  LockKeyhole,
  MessageCircle,
  PackageCheck,
  Search,
  ShieldCheck,
  Store,
  WalletCards,
} from "lucide-react";

const navGroups = [
  {
    title: "Introduction",
    items: [
      { href: "#overview", label: "What is LOOMON" },
      { href: "#problem", label: "Problem" },
      { href: "#demo", label: "Demo path" },
      { href: "#scope", label: "Checkpoint scope" },
    ],
  },
  {
    title: "Product",
    items: [
      { href: "#buyer", label: "Buyer flow" },
      { href: "#seller", label: "Seller flow" },
      { href: "#chat", label: "Order chat" },
      { href: "#agent", label: "Agent" },
    ],
  },
  {
    title: "Technology",
    items: [
      { href: "#arc", label: "Arc escrow" },
      { href: "#contracts", label: "Contracts" },
      { href: "#api", label: "API surface" },
      { href: "#data", label: "Supabase data" },
      { href: "#security", label: "Security model" },
    ],
  },
];

const buyerSteps = [
  "Browse Vietnamese ceramic products in a visual feed.",
  "Open a product and start a custom brief.",
  "Add quantity, notes, artwork, text, and optional needed-by date.",
  "Generate AI previews or send a standard reference-only brief.",
  "Pay through the Arc escrow flow and track the order in Buying.",
  "Confirm completion and receive the proof NFT after delivery.",
];

const sellerSteps = [
  "Review incoming paid orders with notes and uploaded/selected images.",
  "Accept one order at a time or reject with refund.",
  "Use the dock chat for buyer questions while the detail page stays focused on production.",
  "Mark delivered, then claim after the completion and hold flow allows it.",
];

const dataCards = [
  { icon: PackageCheck, title: "Commerce", text: "Products, custom briefs, orders, inventory state, status history, and proof records." },
  { icon: MessageCircle, title: "Messaging", text: "Buyer-seller order chats and personal agent conversations are stored separately." },
  { icon: Coins, title: "Payments", text: "Arc transaction hashes, escrow instances, lifecycle projections, and proof mint attempts." },
  { icon: LockKeyhole, title: "Privacy", text: "Server-only keys stay off the client; private order assets use signed access." },
];

const contracts = [
  {
    name: "LoomonNativeEscrowPool",
    address: "0x95d242919da239859ca7ab8eddc77ae5b4f450db",
    role: "Active Arc Testnet escrow pool",
    details: "Native Arc USDC payment, seller acceptance, delivery, buyer completion, refund, dispute, and delayed seller claim.",
  },
  {
    name: "LoomonQuoteDecision",
    address: "0x0af0d368ed7a742f623103FDf9e43a193f330380",
    role: "Seller request decision registry",
    details: "Records the single demo seller's accept/reject decision before server projection updates the request/order state.",
  },
  {
    name: "LoomonOrderProof",
    address: "Configured by LOOMON_ORDER_PROOF_ADDRESS",
    role: "Non-transferable order proof",
    details: "Mints one proof per completed order hash. It is a demo receipt and does not certify physical authenticity or investment value.",
  },
  {
    name: "Arc native USDC",
    address: "0x3600000000000000000000000000000000000000",
    role: "Payment asset",
    details: "Used on Arc Testnet. App amounts are tracked as 6-decimal USDC atomic units and converted for native transfer semantics.",
  },
];

const apiRoutes = [
  "POST /api/auth/wallet/challenge",
  "POST /api/checkout/confirm",
  "POST /api/orders/{orderId}/escrow/confirm",
  "GET/POST /api/orders/{orderId}/messages",
  "GET /api/orders/{orderId}/messages/stream",
  "GET /api/orders/{orderId}/brief-assets",
  "POST /api/orders/{orderId}/proof",
];

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="gitbook-code">
      <button type="button" aria-label="Copy command"><Copy size={15} /></button>
      <code>{children}</code>
    </div>
  );
}

export default function DocsPage() {
  return (
    <main className="gitbook-docs">
      <header className="gitbook-topbar">
        <Link className="gitbook-brand" href="/">
          <span>LM</span>
          <strong>LOOMON</strong>
        </Link>
        <label className="gitbook-search">
          <Search size={17} />
          <input placeholder="Search docs..." aria-label="Search docs" />
          <kbd>Ctrl K</kbd>
        </label>
      </header>

      <div className="gitbook-shell">
        <aside className="gitbook-sidebar" aria-label="Documentation navigation">
          {navGroups.map((group) => (
            <section key={group.title}>
              <h2>{group.title}</h2>
              {group.items.map((item, index) => (
                <a className={group.title === "Introduction" && index === 0 ? "active" : ""} href={item.href} key={item.href}>
                  <ChevronRight size={14} />
                  {item.label}
                </a>
              ))}
            </section>
          ))}
          <Link className="gitbook-powered" href="/app">
            <PackageCheck size={18} /> Open live app
          </Link>
        </aside>

        <article className="gitbook-content">
          <section id="overview" className="gitbook-hero">
            <span>Introduction</span>
            <h1>What is LOOMON</h1>
            <p>
              LOOMON is an agent-powered custom souvenir marketplace for Vietnamese ceramic craft. The demo connects a familiar shopping flow with wallet sign-in, AI-assisted customization, Arc escrow, seller operations, order chat, and non-transferable delivery proof.
            </p>
            <div className="gitbook-actions">
              <Link className="gradient-stroke-button ghost-button--compact" href="/app">Open app</Link>
              <Link className="ghost-button ghost-button--compact" href="/app/orders">Orders</Link>
            </div>
          </section>

          <section id="problem" className="gitbook-section">
            <p className="gitbook-kicker">Why it matters</p>
            <h2>The data bottleneck in custom craft commerce</h2>
            <p>
              Custom souvenir orders usually live across product cards, DMs, payment links, vague reference images, and manual status updates. That is fragile for both sides: the buyer is not sure what the seller saw, and the seller has to reconstruct the brief from scattered messages.
            </p>
            <p>
              LOOMON turns the custom order into structured data: product, quantity, needed-by date, buyer note, uploaded artwork, selected render, escrow state, timeline, and conversation history. The agent can help explain and draft, while final payment, message, and production actions remain user-controlled.
            </p>
            <div className="gitbook-callout"><ShieldCheck size={18} /> The app feels familiar, while Arc handles payment trust and verifiable milestones underneath.</div>
          </section>

          <section id="demo" className="gitbook-section">
            <p className="gitbook-kicker">Contributor guide</p>
            <h2>Demo path</h2>
            <CodeBlock>https://loomon.vercel.app/app</CodeBlock>
            <ol className="gitbook-list">
              <li>Open the app and browse the catalog.</li>
              <li>Customize a product with text or uploaded artwork.</li>
              <li>Place an Arc testnet order.</li>
              <li>Open the seller workspace and accept only the selected incoming order.</li>
              <li>Use the green dock chat button for buyer-seller messages.</li>
              <li>Complete delivery and mint the proof NFT.</li>
            </ol>
          </section>

          <section id="scope" className="gitbook-section">
            <p className="gitbook-kicker">Checkpoint scope</p>
            <h2>What is implemented in this build</h2>
            <div className="gitbook-step-list">
              <p><Check size={16} /> Public catalog with Vietnamese ceramic demo products and one controlled seller workspace.</p>
              <p><Check size={16} /> Product customization brief with text, quantity, due date, uploaded artwork, and generated/selected preview assets.</p>
              <p><Check size={16} /> Arc Testnet prepaid order flow, onchain seller acceptance, delivery marking, buyer completion, refund paths, and server projection.</p>
              <p><Check size={16} /> Buyer and seller order centers with scoped row actions, private brief assets, status history, and proof surfaces.</p>
              <p><Check size={16} /> Dock-based buyer/seller chat and Personal Agent chat kept as separate conversation types.</p>
            </div>
          </section>

          <section id="buyer" className="gitbook-section">
            <p className="gitbook-kicker">Product</p>
            <h2>Buyer flow</h2>
            <div className="gitbook-step-list">
              {buyerSteps.map((step) => <p key={step}><Check size={16} /> {step}</p>)}
            </div>
          </section>

          <section id="seller" className="gitbook-section">
            <p className="gitbook-kicker">Operations</p>
            <h2>Seller flow</h2>
            <div className="gitbook-step-list">
              {sellerSteps.map((step) => <p key={step}><Store size={16} /> {step}</p>)}
            </div>
          </section>

          <section id="chat" className="gitbook-section gitbook-grid-section">
            <div>
              <p className="gitbook-kicker">Order chat</p>
              <h2>Messages live in the dock, not inside the production brief</h2>
            <p>
                The order detail page is for facts: notes, uploaded artwork, selected render, quantity, due date, escrow state, and timeline. The Chat button opens the green dock conversation for the buyer and seller. Messages and image attachments are persisted in Supabase and scoped to the order participants.
              </p>
            </div>
            <div className="gitbook-mini-panel">
              <MessageCircle size={22} />
              <strong>Persistent thread</strong>
              <span>messaging.threads + messaging.messages</span>
            </div>
          </section>

          <section id="agent" className="gitbook-section gitbook-grid-section">
            <div>
              <p className="gitbook-kicker">Agent</p>
              <h2>The green button is the control room</h2>
            <p>
                The agent reads page context, drafts messages, explains order status, guides wallet actions, and helps with product discovery. It is deliberately bounded: it does not silently sign, pay, accept orders, refund, deliver, or send buyer-seller messages without the user taking the final action.
              </p>
            </div>
            <div className="gitbook-mini-panel">
              <Bot size={22} />
              <strong>Bounded assistant</strong>
              <span>User-controlled final actions</span>
            </div>
          </section>

          <section id="arc" className="gitbook-section">
            <p className="gitbook-kicker">Technology</p>
            <h2>Arc escrow lifecycle</h2>
            <p>
              Arc is the trust layer for the paid custom order. LOOMON verifies transaction receipts and contract events before projecting order state into Supabase. The database is the application read model; the payment milestone is accepted only after the expected Arc event is observed.
            </p>
            <div className="gitbook-card-row">
              <div><WalletCards size={20} /><strong>Fund</strong><span>Buyer places prepaid order.</span></div>
              <div><Store size={20} /><strong>Accept</strong><span>Seller starts production.</span></div>
              <div><ImageIcon size={20} /><strong>Deliver</strong><span>Seller marks the order delivered.</span></div>
              <div><ShieldCheck size={20} /><strong>Prove</strong><span>Buyer confirms and proof is minted.</span></div>
            </div>
            <CodeBlock>Arc Testnet chainId: 5042002</CodeBlock>
          </section>

          <section id="contracts" className="gitbook-section">
            <p className="gitbook-kicker">Technology</p>
            <h2>Contract registry</h2>
            <p>
              These are public testnet addresses or configuration keys used by the demo. Private keys, service-role keys, and minter keys are never committed and must stay in Vercel or local environment variables.
            </p>
            <div className="gitbook-data-grid">
              {contracts.map((contract) => (
                <div key={contract.name}>
                  <Coins size={20} />
                  <strong>{contract.name}</strong>
                  <p>{contract.role}</p>
                  <CodeBlock>{contract.address}</CodeBlock>
                  <p>{contract.details}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="api" className="gitbook-section">
            <p className="gitbook-kicker">Technology</p>
            <h2>Server API surface</h2>
            <p>
              Public browser clients do not receive service-role access. Sensitive endpoints validate wallet session, order ownership, expected participant role, transaction sender, target contract, event name, and onchain order id before returning private data or changing state.
            </p>
            <ol className="gitbook-list">
              {apiRoutes.map((route) => <li key={route}>{route}</li>)}
            </ol>
          </section>

          <section id="data" className="gitbook-section">
            <p className="gitbook-kicker">Technology</p>
            <h2>Supabase data foundation</h2>
            <p>
              Supabase stores the app&apos;s read model and collaboration state: catalog, profiles, quote requests, order briefs, escrow projections, proof records, messaging, and signed asset references. Contract state is never inferred from client input alone; server routes verify Arc receipts before writing lifecycle projections.
            </p>
            <div className="gitbook-data-grid">
              {dataCards.map((card) => {
                const Icon = card.icon;
                return <div key={card.title}><Icon size={20} /><strong>{card.title}</strong><p>{card.text}</p></div>;
              })}
            </div>
          </section>

          <section id="security" className="gitbook-section">
            <p className="gitbook-kicker">Security</p>
            <h2>Trust boundaries</h2>
            <p>
              Wallet sign-in maps an address to a Supabase identity. Server routes verify wallet/order access, private assets are signed per request, service-role keys stay server-side, and contract projections verify onchain events before changing order status. Buyer and seller access can also be derived from escrow participant addresses so older wallet-native orders remain visible even when the Supabase auth identity changes.
            </p>
            <div className="gitbook-callout"><LockKeyhole size={18} /> Never commit `.env.local`, service-role keys, deployer private keys, proof minter keys, or Vercel metadata. Use `.env.example` only for variable names.</div>
          </section>
        </article>
      </div>
    </main>
  );
}
