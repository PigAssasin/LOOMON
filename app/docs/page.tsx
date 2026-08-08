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
              LOOMON is an agent-powered custom souvenir commerce demo for Vietnamese ceramic craft. Buyers discover products, customize a piece, pay through Arc, coordinate with the seller, and keep a proof NFT after delivery.
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
              Custom souvenir orders usually live across product cards, DMs, payment links, vague reference images, and manual status updates. LOOMON compresses that into one structured order loop that an agent can understand without hiding user control.
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
                The order detail page is for facts: notes, uploaded artwork, selected render, quantity, due date, and timeline. The Chat button opens the green dock conversation for the buyer and seller, with history saved to Supabase.
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
                The agent reads page context, drafts messages, explains order status, guides wallet actions, and helps with product discovery. It does not silently sign, pay, or send buyer-seller messages.
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
            <div className="gitbook-card-row">
              <div><WalletCards size={20} /><strong>Fund</strong><span>Buyer places prepaid order.</span></div>
              <div><Store size={20} /><strong>Accept</strong><span>Seller starts production.</span></div>
              <div><ImageIcon size={20} /><strong>Deliver</strong><span>Seller marks the order delivered.</span></div>
              <div><ShieldCheck size={20} /><strong>Prove</strong><span>Buyer confirms and proof is minted.</span></div>
            </div>
          </section>

          <section id="data" className="gitbook-section">
            <p className="gitbook-kicker">Technology</p>
            <h2>Supabase data foundation</h2>
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
              Wallet sign-in maps an address to a Supabase identity. Server routes verify wallet/order access, private assets are signed per request, service-role keys stay server-side, and contract projections verify onchain events before changing order status.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
