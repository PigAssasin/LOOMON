"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock3,
  Copy,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/src/components/site-header";
import {
  commerceWorkspaceSchema,
  emptyCommerceWorkspace,
  statusLabel,
  type CommerceItem,
} from "@/src/domain/commerce-workspace";
import { useLoomonSession } from "@/src/features/auth/use-loomon-session";

type ThreadMessage = {
  id: string;
  senderType: string;
  body?: string | null;
  kind: string;
  structuredBody?: { event?: string; reason?: string } | null;
  createdAt: string;
};

export function OrderDetailExperience({ reference }: { reference: string }) {
  const session = useLoomonSession();
  const [item, setItem] = useState<CommerceItem>();
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!session.supabase) return;
    setLoading(true);
    const { data, error: workspaceError } = await session.supabase.rpc("get_my_commerce_workspace");
    if (workspaceError) {
      setError("This order could not be loaded.");
      setLoading(false);
      return;
    }
    const workspace = commerceWorkspaceSchema.parse(data ?? emptyCommerceWorkspace);
    const buyerItem = workspace.buyingOrders.find((order) => order.reference === reference);
    const sellerItem = workspace.sellingOrders.find((order) => order.reference === reference);
    const found = buyerItem ?? sellerItem;
    setItem(found);
    setRole(buyerItem ? "buyer" : "seller");
    if (found?.threadId) {
      const { data: threadData } = await session.supabase.rpc("list_thread_messages", {
        p_thread_id: found.threadId,
      });
      setMessages(Array.isArray(threadData) ? threadData as ThreadMessage[] : []);
    }
    setLoading(false);
  }, [reference, session.supabase]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void load();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  useEffect(() => {
    if (!session.supabase || !item?.threadId) return;
    const channel = session.supabase
      .channel(`loomon-order-${item.id}`)
      .on("postgres_changes", { event: "*", schema: "commerce", table: "orders", filter: `id=eq.${item.id}` }, () => {
        void load();
      })
      .on("postgres_changes", { event: "INSERT", schema: "messaging", table: "messages", filter: `thread_id=eq.${item.threadId}` }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "commerce", table: "order_proof_nfts", filter: `order_id=eq.${item.id}` }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void session.supabase?.removeChannel(channel);
    };
  }, [item?.id, item?.threadId, load, session.supabase]);

  const steps = useMemo(() => {
    if (!item) return [];
    if (item.kind === "request") {
      const ranks = ["submitted", "seller_review", "changes_requested", "accepted"];
      const current = ranks.indexOf(item.status);
      return [
        { key: "submitted", title: "Request submitted", detail: "The maker received the customization brief." },
        { key: "seller_review", title: "Seller review", detail: "Use the order chat for production questions or requested changes." },
        { key: "accepted", title: "Accepted as an order", detail: "Once accepted, this request moves to Active." },
      ].map((step) => {
        const rank = ranks.indexOf(step.key);
        const terminal = ["rejected", "withdrawn"].includes(item.status);
        return { ...step, state: terminal ? "next" : current > rank || item.status === "accepted" ? "done" : current === rank ? "current" : "next" };
      });
    }
    const ranks = [
      "seller_accepted",
      "in_progress",
      "seller_marked_delivered",
      "buyer_confirmed_received",
      "proof_pending",
      "proof_minted",
    ];
    const current = ranks.indexOf(item.status);
    return [
      { key: "seller_accepted", title: "Seller accepted", detail: "The maker accepted the customization request." },
      { key: "in_progress", title: "Preparing the order", detail: "The seller is preparing the demo order." },
      { key: "seller_marked_delivered", title: "Seller marked delivered", detail: "The buyer must confirm receipt before minting." },
      { key: "proof_minted", title: "Order proof on Arc", detail: "A non-transferable proof appears under Purchased." },
    ].map((step) => {
      const rank = ranks.indexOf(step.key);
      return { ...step, state: current > rank || item.status === "proof_minted" ? "done" : current === rank ? "current" : "next" };
    });
  }, [item]);

  async function transition(action: "mark_delivered" | "confirm_received" | "report_issue" | "cancel", reason = "") {
    if (!session.supabase || !item) return;
    setBusy(true);
    setError("");
    const { error: transitionError } = await session.supabase.rpc("transition_demo_order", {
      p_order_id: item.id,
      p_action: action,
      p_reason: reason,
      p_request_key: crypto.randomUUID(),
    });
    if (!transitionError && action === "confirm_received") {
      const response = await fetch(`/api/orders/${item.id}/proof`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestKey: crypto.randomUUID() }),
      });
      if (!response.ok) setError("Receipt confirmed. Arc proof minting will retry safely.");
    } else if (transitionError) {
      setError("The order changed before this action completed.");
    }
    setBusy(false);
    await load();
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session.supabase || !item?.threadId || !message.trim()) return;
    setBusy(true);
    const { error: sendError } = await session.supabase.rpc("send_thread_message", {
      p_thread_id: item.threadId,
      p_body: message.trim(),
    });
    setBusy(false);
    if (sendError) {
      setError("Your message was not sent. Please try again.");
      return;
    }
    setMessage("");
    await load();
  }

  if (loading) {
    return <OrderPageShell><div className="order-stage-empty"><RefreshCw size={22} /><div><h2>Loading order</h2><p>Checking the latest status and messages.</p></div></div></OrderPageShell>;
  }

  if (!item) {
    return <OrderPageShell><Link className="order-back-link" href="/app/orders"><ArrowLeft size={17} /> Back to orders</Link><div className="order-stage-empty"><span>—</span><div><h2>Order not found.</h2><p>Connect the wallet that bought or manages this order.</p></div></div></OrderPageShell>;
  }

  return <OrderPageShell>
    <Link className="order-back-link" href="/app/orders"><ArrowLeft size={17} /> Back to orders</Link>
    <header className="real-order-header">
      <div className="order-reference"><span>{item.kind === "request" ? "Request" : "Order"}</span><strong>{item.reference}</strong><button type="button" onClick={async () => { await navigator.clipboard.writeText(item.reference); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }}><Copy size={15} /> {copied ? "Copied" : "Copy"}</button></div>
      <h1>{item.productTitle}</h1>
      <p>{role === "buyer" ? item.makerName : item.buyerName ?? "Buyer"} · {statusLabel(item.status)}</p>
    </header>
    {error || session.error ? <p className="form-error" role="alert">{error || session.error}</p> : null}

    <div className="order-grid real-order-grid">
      <section>
        <ol className="timeline">{steps.map((step) => <li className={`timeline-${step.state}`} key={step.key}><span>{step.state === "done" ? <Check size={18} /> : step.state === "current" ? <Clock3 size={18} /> : null}</span><div><strong>{step.title}</strong><p>{step.detail}</p></div></li>)}</ol>
        <div className="order-detail-actions">
          {role === "seller" && ["seller_accepted", "in_progress"].includes(item.status) ? <button className="gradient-stroke-button" disabled={busy} type="button" onClick={() => void transition("mark_delivered")}><PackageCheck size={17} /> Mark delivered</button> : null}
          {role === "buyer" && item.status === "seller_marked_delivered" ? <>
            <button className="gradient-stroke-button" disabled={busy} type="button" onClick={() => void transition("confirm_received")}><Check size={17} /> Confirm received</button>
            <button className="ghost-button" disabled={busy} type="button" onClick={() => { const reason = window.prompt("Describe the delivery issue"); if (reason) void transition("report_issue", reason); }}>Report an issue</button>
          </> : null}
          {["seller_accepted", "in_progress"].includes(item.status) ? <button className="ghost-button" disabled={busy} type="button" onClick={() => { const reason = window.prompt("Why are you cancelling this order?"); if (reason) void transition("cancel", reason); }}>Cancel order</button> : null}
        </div>
      </section>

      <aside className="order-chat-panel">
        <header><MessageCircle size={20} /><div><h2>Buyer · Seller chat</h2><p>Messages stay with this order.</p></div></header>
        <div className="order-chat-messages">
          {messages.length ? messages.map((entry) => entry.kind === "text" ? <article className={`order-chat-message order-chat-message--${entry.senderType}`} key={entry.id}><span>{entry.senderType}</span><p>{entry.body}</p><time>{new Date(entry.createdAt).toLocaleString()}</time></article> : <article className="order-chat-event" key={entry.id}><p>{entry.structuredBody?.event?.replaceAll("_", " ") ?? "Order updated"}</p>{entry.structuredBody?.reason ? <small>{entry.structuredBody.reason}</small> : null}</article>) : <p className="order-chat-empty">No messages yet. Start with a production or delivery question.</p>}
        </div>
        <form className="order-chat-form" onSubmit={sendMessage}><label><span className="sr-only">Message</span><textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message…" /></label><button type="submit" disabled={busy || !message.trim()}><Send size={17} /> Send</button></form>
      </aside>
    </div>
  </OrderPageShell>;
}

function OrderPageShell({ children }: { children: React.ReactNode }) {
  return <main><div className="static-header-wrap"><SiteHeader /></div><section className="order-page">{children}</section></main>;
}
