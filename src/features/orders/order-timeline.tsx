"use client";

import Link from "next/link";
import { ArrowLeft, BellRing, Check, Clock3, Copy, ExternalLink, Mail, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/src/components/site-header";
import { DEMO_ORDER_REFERENCE } from "@/src/domain/order-reference";

const milestones = [
  { title: "Deposit confirmed", detail: "96.00 USDC on Arc Testnet", status: "done" },
  { title: "Maker review", detail: "Lam Xưởng is checking your logo and deadline", status: "current" },
  { title: "Design approval", detail: "The agent will ask you to approve the placement proof", status: "next" },
  { title: "Production", detail: "Estimated 24–35 days after approval", status: "next" },
] as const;

export function OrderTimeline() {
  const [copied, setCopied] = useState(false);

  async function copyReference() {
    await navigator.clipboard.writeText(DEMO_ORDER_REFERENCE);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return <main>
    <div className="static-header-wrap"><SiteHeader /></div>
    <section className="order-page">
      <Link className="order-back-link" href="/app/orders"><ArrowLeft size={17} /> Back to orders</Link>
      <header>
        <div className="order-reference"><span>Order</span><strong>{DEMO_ORDER_REFERENCE}</strong><button type="button" onClick={copyReference} aria-label="Copy order reference">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}</button></div>
        <h1>Blue Lotus Teapot</h1>
        <p>Your production window is reserved. The agent is waiting on the maker, so there is nothing you need to do right now.</p>
      </header>

      <div className="order-grid">
        <ol className="timeline">{milestones.map((milestone) => <li className={`timeline-${milestone.status}`} key={milestone.title}><span>{milestone.status === "done" ? <Check size={18} /> : milestone.status === "current" ? <Clock3 size={18} /> : null}</span><div><strong>{milestone.title}</strong><p>{milestone.detail}</p></div></li>)}</ol>
        <div className="order-side-stack">
          <aside className="order-agent-card"><Sparkles size={24} /><h2>I’ll follow up tomorrow.</h2><p>If the maker has not confirmed the logo process by 10:00, I’ll send a reminder and update this timeline.</p><button className="ghost-button" type="button">Change reminder</button></aside>
          <EmailReminderCard />
        </div>
      </div>

      <footer className="order-payment"><div><span>Deposit</span><strong>96.00 USDC</strong></div><div><span>Status</span><strong className="accent-green">Confirmed</strong></div><a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">View on ArcScan <ExternalLink size={15} /></a></footer>
    </section>
  </main>;
}

function EmailReminderCard() {
  const [email, setEmail] = useState("mai.anh@example.com");
  const [enabled, setEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedProfile = window.localStorage.getItem("pinterest-markers-profile");
      const storedReminder = window.localStorage.getItem(`pinterest-markers-order-email:${DEMO_ORDER_REFERENCE}`);
      try {
        if (storedReminder) {
          const reminder = JSON.parse(storedReminder) as { email?: string; enabled?: boolean };
          if (reminder.email) setEmail(reminder.email);
          if (typeof reminder.enabled === "boolean") setEnabled(reminder.enabled);
        } else if (storedProfile) {
          const profile = JSON.parse(storedProfile) as { email?: string };
          if (profile.email) setEmail(profile.email);
        }
      } catch {
        // Keep safe demo defaults when local profile data is malformed.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function saveReminder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(`pinterest-markers-order-email:${DEMO_ORDER_REFERENCE}`, JSON.stringify({ email: email.trim(), enabled }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return <aside className="order-email-card">
    <header><span><Mail size={19} /></span><div><h2>Email reminders</h2><p>Linked to this order only</p></div></header>
    <form onSubmit={saveReminder}>
      <label className="order-email-field"><span>Email address</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label className="order-email-toggle"><span><strong>Send order updates</strong><small>Status changes, approvals and delivery reminders.</small></span><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /></label>
      <div className="order-email-events"><span><BellRing size={15} /> Status changes</span><span><Clock3 size={15} /> 24h inactivity</span><span><Check size={15} /> Approval deadlines</span></div>
      <button className="gradient-stroke-button full-width" type="submit">{saved ? <><Check size={17} /> Reminders saved</> : "Save email reminders"}</button>
    </form>
  </aside>;
}
