import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Coins,
  Image as ImageIcon,
  LockKeyhole,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Store,
  WalletCards,
} from "lucide-react";
import { SiteHeader } from "@/src/components/site-header";

const navItems = [
  { href: "#vision", label: "Vision" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#buyer", label: "Buyer flow" },
  { href: "#seller", label: "Seller flow" },
  { href: "#agent", label: "Personal agent" },
  { href: "#arc", label: "Arc + Proof NFT" },
  { href: "#data", label: "Data model" },
  { href: "#demo", label: "Demo checklist" },
];

const buyerSteps = [
  {
    title: "Find a craft product",
    text: "Buyers browse a focused catalog of Vietnamese ceramics and tea objects. The agent can recommend options, but the buyer chooses the final item.",
  },
  {
    title: "Customize only what matters",
    text: "Upload artwork, add printed text, describe placement, or leave everything blank and send a simple order note.",
  },
  {
    title: "Preview with AI when useful",
    text: "AI render creates three white-background product previews: 2D print, raised 3D motif, and full-surface artwork treatment.",
  },
  {
    title: "Place order with wallet",
    text: "The buyer signs the Arc payment action. The order appears in Requests until the seller accepts or rejects it.",
  },
  {
    title: "Receive proof",
    text: "When the seller marks delivery, the buyer confirms receipt and mints an NFT proof tied to the order.",
  },
];

const sellerSteps = [
  {
    title: "Incoming",
    text: "New paid orders arrive here first. The seller reviews the custom image, notes, quantity and target date.",
  },
  {
    title: "Accept or reject",
    text: "Accept moves the order to Active. Reject sends it to History and refunds the buyer through the contract path.",
  },
  {
    title: "Active production",
    text: "The seller and buyer can chat, clarify details and share images while the order is being made.",
  },
  {
    title: "Mark delivered",
    text: "Delivery completes the seller side and unlocks the buyer proof step. The demo then shows the NFT transaction trail.",
  },
];

const agentAbilities = [
  "Read real order status and explain what stage the order is in.",
  "Find suitable products from the catalog using natural language.",
  "Draft seller messages, translate, summarize and remind — but waits for user approval before sending.",
  "Prepare cancel, refund, payment or proof actions so the user can sign them from the wallet.",
  "Never chooses the final product for the buyer and never silently sends buyer/seller messages.",
];

const dataBlocks = [
  {
    title: "Commerce records",
    icon: PackageCheck,
    text: "Products, variants, seller profile, stock state, uploaded assets, order code, buyer/seller wallet and lifecycle status.",
  },
  {
    title: "Conversation records",
    icon: MessageCircle,
    text: "Personal agent threads and buyer-seller chats are separated so future agent tools can reason with the right context.",
  },
  {
    title: "Onchain records",
    icon: Coins,
    text: "Payment, seller decisions, refund/delivery/proof events and transaction hashes are stored alongside database status.",
  },
  {
    title: "Private access",
    icon: LockKeyhole,
    text: "Secrets stay server-side. Buyer and seller data is scoped by wallet identity and short-lived signed URLs protect order assets.",
  },
];

export default function DocsPage() {
  return (
    <main>
      <div className="static-header-wrap">
        <SiteHeader />
      </div>

      <div className="docs-layout">
        <aside className="docs-sidebar" aria-label="Documentation menu">
          <Link className="docs-mark" href="/">
            <span>LM</span>
            <strong>LOOMON Docs</strong>
          </Link>
          <nav>
            {navItems.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="docs-sidebar-note">
            <Sparkles size={16} />
            <p>Demo goal: show how Arc can power a new craft-commerce experience without making users feel they are using a hard Web3 product.</p>
          </div>
        </aside>

        <article className="docs-content">
          <section id="vision" className="docs-hero-panel">
            <p className="bracket-label">LOOMON protocol demo</p>
            <h1>A modern path for Vietnamese craft to travel further.</h1>
            <p>
              LOOMON turns a custom souvenir order into a simple, guided journey: discover a product, preview your idea, pay through Arc, chat with the maker and keep an onchain proof when the piece is delivered.
            </p>
            <div className="docs-hero-actions">
              <Link className="gradient-stroke-button" href="/app">
                Open app <ArrowRight size={17} />
              </Link>
              <Link className="ghost-button" href="/app/orders">
                View order flow
              </Link>
            </div>
          </section>

          <section id="how-it-works" className="docs-section">
            <div className="docs-section-heading">
              <span>01</span>
              <div>
                <p className="docs-kicker">The mechanism</p>
                <h2>Web2-simple on the surface. Arc-native underneath.</h2>
              </div>
            </div>
            <div className="docs-mechanism-grid">
              <div className="docs-mechanism-card">
                <ImageIcon size={24} />
                <h3>Customize</h3>
                <p>Buyer uploads an image or text. AI preview is optional, so simple orders stay simple.</p>
              </div>
              <div className="docs-mechanism-card">
                <WalletCards size={24} />
                <h3>Pay</h3>
                <p>Wallet signing happens only at the important step: order payment, refund, delivery or proof.</p>
              </div>
              <div className="docs-mechanism-card">
                <Store size={24} />
                <h3>Produce</h3>
                <p>Seller accepts the order, chats with the buyer and marks delivery when the piece is done.</p>
              </div>
              <div className="docs-mechanism-card">
                <ShieldCheck size={24} />
                <h3>Prove</h3>
                <p>The delivered order can mint a proof NFT containing product, order and preview metadata.</p>
              </div>
            </div>
          </section>

          <section id="buyer" className="docs-section">
            <div className="docs-section-heading">
              <span>02</span>
              <div>
                <p className="docs-kicker">For buyers</p>
                <h2>From idea to order in one clean flow.</h2>
              </div>
            </div>
            <ol className="docs-flow-list">
              {buyerSteps.map((step) => (
                <li key={step.title}>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section id="seller" className="docs-section">
            <div className="docs-section-heading">
              <span>03</span>
              <div>
                <p className="docs-kicker">For sellers</p>
                <h2>A small workshop dashboard, not a complicated back office.</h2>
              </div>
            </div>
            <div className="docs-seller-grid">
              {sellerSteps.map((step) => (
                <div key={step.title} className="docs-seller-card">
                  <CheckCircle2 size={19} />
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="agent" className="docs-section docs-feature-section">
            <div className="docs-feature-copy">
              <p className="docs-kicker">Personal agent</p>
              <h2>The green button is the control room.</h2>
              <p>
                The agent is not a decorative chatbot. It is designed as the layer that understands the current page, reads order data, drafts useful actions and keeps the buyer-seller process moving.
              </p>
            </div>
            <ul className="docs-agent-list">
              {agentAbilities.map((ability) => (
                <li key={ability}>
                  <Bot size={18} />
                  <span>{ability}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="arc" className="docs-section">
            <div className="docs-section-heading">
              <span>04</span>
              <div>
                <p className="docs-kicker">Arc layer</p>
                <h2>Only the moments that need trust go onchain.</h2>
              </div>
            </div>
            <div className="docs-arc-panel">
              <div>
                <h3>Order payment</h3>
                <p>Buyer signs the payment transaction. LOOMON stores the order state and transaction reference.</p>
              </div>
              <div>
                <h3>Seller decision</h3>
                <p>Accept, reject and refund are tied to contract-aware status changes so both sides see the same lifecycle.</p>
              </div>
              <div>
                <h3>Delivery proof</h3>
                <p>After seller delivery and buyer receipt, the proof NFT becomes the collectible record of the completed order.</p>
              </div>
            </div>
          </section>

          <section id="data" className="docs-section">
            <div className="docs-section-heading">
              <span>05</span>
              <div>
                <p className="docs-kicker">Data foundation</p>
                <h2>Structured from the start so the agent can grow later.</h2>
              </div>
            </div>
            <div className="docs-data-grid">
              {dataBlocks.map((block) => {
                const Icon = block.icon;
                return (
                  <article key={block.title} className="docs-data-card">
                    <Icon size={22} />
                    <h3>{block.title}</h3>
                    <p>{block.text}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section id="demo" className="docs-section docs-demo-panel">
            <p className="docs-kicker">What to test</p>
            <h2>Demo path for judges and first users.</h2>
            <div className="docs-demo-checklist">
              <p>1. Browse ceramic products and open a product detail.</p>
              <p>2. Click Custom with agent, upload artwork or write printed text.</p>
              <p>3. Render three previews or skip AI and place the order directly.</p>
              <p>4. Switch to the seller wallet, accept or reject the incoming order.</p>
              <p>5. Mark delivered, then let the buyer mint the proof NFT and open the explorer link.</p>
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}
