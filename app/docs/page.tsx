import Link from "next/link";
import { ArrowRight, BadgeCheck, Bot, FileText, ShieldCheck, WalletCards } from "lucide-react";
import { SiteHeader } from "@/src/components/site-header";

const sections = [
  {
    title: "Buyer flow",
    icon: BadgeCheck,
    items: [
      "Choose a ceramic product from the curated LOOMON catalog.",
      "Upload artwork or type the text you want printed on the product.",
      "Optionally render AI previews, then place an Arc testnet order.",
      "Track the order until the seller marks it delivered.",
      "Confirm receipt and mint a non-transferable proof NFT.",
    ],
  },
  {
    title: "Seller flow",
    icon: FileText,
    items: [
      "The demo uses one seller: Lò Mây, connected to the approved seller wallet.",
      "New paid orders appear in Incoming.",
      "Accepting moves the order to Active.",
      "Mark delivered asks the buyer to confirm receipt and mint the proof.",
      "Rejected or refunded orders move to History with their transaction trail.",
    ],
  },
  {
    title: "Agent rules",
    icon: Bot,
    items: [
      "The agent can search products, summarize orders and draft seller messages.",
      "The agent cannot choose the final product for the buyer.",
      "The agent cannot send buyer/seller messages without user confirmation.",
      "The agent prepares wallet actions, but the user still signs sensitive transactions.",
    ],
  },
  {
    title: "Arc layer",
    icon: WalletCards,
    items: [
      "Arc testnet is used for prepaid escrow and proof NFT minting.",
      "Supabase stores private order, profile, chat and customization data.",
      "Arc is the source of truth for escrow/payment/proof transactions.",
      "Proof NFTs are demo receipts, not authenticity certificates or investment assets.",
    ],
  },
  {
    title: "Privacy and security",
    icon: ShieldCheck,
    items: [
      "API keys and private keys stay in environment variables and are not committed.",
      "Uploaded order assets are returned through short-lived signed URLs.",
      "Private order data is scoped to the buyer, seller or server-side service role.",
      "The public repository should contain placeholders only for secrets.",
    ],
  },
];

export default function DocsPage() {
  return (
    <main>
      <div className="static-header-wrap"><SiteHeader /></div>
      <section className="docs-page">
        <header className="docs-hero">
          <p className="bracket-label">LOOMON docs</p>
          <h1>Custom ceramic commerce, made legible.</h1>
          <p>LOOMON is a curated demo for Vietnamese ceramic souvenirs: AI-assisted customization, buyer-seller workflow, Arc escrow and proof NFTs in one simple web app.</p>
          <div>
            <Link className="gradient-stroke-button" href="/app">Open app <ArrowRight size={17} /></Link>
            <Link className="ghost-button" href="/app/orders">View orders</Link>
          </div>
        </header>
        <div className="docs-grid">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <article key={section.title} className="docs-card">
                <span><Icon size={21} /></span>
                <h2>{section.title}</h2>
                <ul>
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
