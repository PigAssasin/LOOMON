"use client";

import Link from "next/link";
import { ArrowUpRight, Check, Clock3, PackageCheck, ShoppingBag, Sparkles, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/src/components/site-header";
import { ProductVisual } from "@/src/components/product-visual";
import { AgentPanel } from "@/src/features/agent/agent-panel";
import { getProductBySlug } from "@/src/data/products";
import { DEMO_ORDER_REFERENCE } from "@/src/domain/order-reference";

const orderProduct = getProductBySlug("blue-lotus-teapot")!;

type OrderMode = "buyer" | "seller";
type BuyerTab = "fund" | "active" | "history";
type SellerTab = "requests" | "active" | "history";
type RequestState = "pending" | "accepted" | "declined";

export function OrdersCenter() {
  const [agentOpen, setAgentOpen] = useState(false);
  const [mode, setMode] = useState<OrderMode>("buyer");
  const [buyerTab, setBuyerTab] = useState<BuyerTab>("active");
  const [sellerTab, setSellerTab] = useState<SellerTab>("requests");
  const [requestState, setRequestState] = useState<RequestState>("pending");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem("pinterest-markers-profile");
      if (!stored) return;
      try {
        const profile = JSON.parse(stored) as { role?: OrderMode };
        if (profile.role === "seller" || profile.role === "buyer") setMode(profile.role);
      } catch {
        // Keep the buyer workspace when a saved demo profile cannot be read.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const sellerRequestCount = requestState === "pending" ? 1 : 0;
  const sellerActiveCount = requestState === "accepted" ? 1 : 0;
  const sellerHistoryCount = requestState === "declined" ? 1 : 0;

  function acceptRequest() {
    setRequestState("accepted");
    setSellerTab("active");
  }

  function declineRequest() {
    setRequestState("declined");
    setSellerTab("history");
  }

  return (
    <main>
      <div className="static-header-wrap"><SiteHeader onOpenAgent={() => setAgentOpen(true)} /></div>
      <section className="orders-center">
        <header className="orders-center-heading">
          <div><h1>Orders</h1><p>Buying and selling stay separate, while the agent keeps both sides coordinated.</p></div>
          <span><i /> Agent online</span>
        </header>

        <nav className="orders-mode-switch" aria-label="Order workspace">
          <button className={mode === "buyer" ? "active" : ""} aria-pressed={mode === "buyer"} onClick={() => setMode("buyer")} type="button"><ShoppingBag size={19} /><span><strong>Buying</strong><small>Orders you placed</small></span></button>
          <button className={mode === "seller" ? "active" : ""} aria-pressed={mode === "seller"} onClick={() => setMode("seller")} type="button"><Store size={19} /><span><strong>Selling</strong><small>Orders for your shop</small></span></button>
        </nav>

        {mode === "buyer" ? <>
          <OrderStatusStrip items={[{ label: "Active purchases", value: "01" }, { label: "Need your attention", value: "00" }, { label: "Next update", value: "Tomorrow · 10:00" }]} />
          <nav className="order-contract-tabs" aria-label="Buying order stages" role="tablist">
            <OrderTab index="01" label="Confirm & fund" count={0} active={buyerTab === "fund"} onClick={() => setBuyerTab("fund")} />
            <OrderTab index="02" label="In progress" count={1} active={buyerTab === "active"} onClick={() => setBuyerTab("active")} />
            <OrderTab index="03" label="History" count={0} active={buyerTab === "history"} onClick={() => setBuyerTab("history")} />
          </nav>
          <BuyerWorkspace tab={buyerTab} onOpenAgent={() => setAgentOpen(true)} />
        </> : <>
          <OrderStatusStrip items={[{ label: "Open requests", value: sellerRequestCount.toString().padStart(2, "0") }, { label: "Active production", value: sellerActiveCount.toString().padStart(2, "0") }, { label: "Response target", value: sellerRequestCount ? "Today · 17:00" : "All clear" }]} />
          <nav className="order-contract-tabs" aria-label="Selling order stages" role="tablist">
            <OrderTab index="01" label="New requests" count={sellerRequestCount} active={sellerTab === "requests"} onClick={() => setSellerTab("requests")} />
            <OrderTab index="02" label="Active" count={sellerActiveCount} active={sellerTab === "active"} onClick={() => setSellerTab("active")} />
            <OrderTab index="03" label="History" count={sellerHistoryCount} active={sellerTab === "history"} onClick={() => setSellerTab("history")} />
          </nav>
          <SellerWorkspace tab={sellerTab} requestState={requestState} onAccept={acceptRequest} onDecline={declineRequest} onRequestChanges={() => setAgentOpen(true)} />
        </>}
      </section>
      <AgentPanel open={agentOpen} onClose={() => setAgentOpen(false)} initialProduct={orderProduct} />
    </main>
  );
}

function OrderStatusStrip({ items }: { items: Array<{ label: string; value: string }> }) {
  return <div className="orders-status-strip">{items.map((item) => <div key={item.label}><small>{item.label}</small><strong>{item.value}</strong></div>)}</div>;
}

function OrderTab({ index, label, count, active, onClick }: { index: string; label: string; count: number; active: boolean; onClick: () => void }) {
  return <button aria-selected={active} className={active ? "active" : ""} onClick={onClick} role="tab" type="button"><span>{index}</span>{label}<small>{count}</small></button>;
}

function BuyerWorkspace({ tab, onOpenAgent }: { tab: BuyerTab; onOpenAgent: () => void }) {
  if (tab === "fund") return <OrderStageEmpty index="01" title="Nothing needs funding." detail="When a maker accepts your request, the agreed deposit will appear here for confirmation." />;
  if (tab === "history") return <OrderStageEmpty index="03" title="No completed purchases yet." detail="Delivered, refunded and cancelled purchases will stay here as a clear payment history." />;

  return <div className="orders-workspace">
    <section className="active-orders" aria-label="Active purchases">
      <div className="orders-section-title"><h2>In progress</h2><span>1 purchase</span></div>
      <Link className="order-feature-row" href="/app/orders/demo-order">
        <ProductVisual product={orderProduct} />
        <div className="order-feature-copy">
          <span className="order-stage"><i /> In production</span>
          <h3>Blue Lotus Teapot</h3>
          <p>Lam Xưởng · Huế</p>
          <dl><div><dt>Order</dt><dd>{DEMO_ORDER_REFERENCE}</dd></div><div><dt>Deposit</dt><dd>96 USDC · Confirmed</dd></div><div><dt>Estimated delivery</dt><dd>18–24 August</dd></div></dl>
        </div>
        <span className="order-open-icon"><ArrowUpRight size={20} /></span>
      </Link>
    </section>
    <AgentWatch mode="buyer" onOpenAgent={onOpenAgent} />
  </div>;
}

function SellerWorkspace({ tab, requestState, onAccept, onDecline, onRequestChanges }: { tab: SellerTab; requestState: RequestState; onAccept: () => void; onDecline: () => void; onRequestChanges: () => void }) {
  if (tab === "requests" && requestState === "pending") return <div className="orders-workspace orders-workspace--seller">
    <section className="active-orders" aria-label="New order requests">
      <div className="orders-section-title"><h2>Needs review</h2><span>1 request</span></div>
      <article className="order-feature-row seller-request-row">
        <ProductVisual product={orderProduct} />
        <div className="order-feature-copy">
          <span className="order-stage order-stage--attention"><i /> New request</span>
          <h3>Blue Lotus Teapot</h3>
          <p>Mai Anh · Buyer</p>
          <dl><div><dt>Quantity</dt><dd>80 pieces</dd></div><div><dt>Requested by</dt><dd>20 August</dd></div><div><dt>Quote</dt><dd>240 USDC</dd></div><div><dt>Custom work</dt><dd>Logo decal</dd></div></dl>
        </div>
      </article>
    </section>
    <aside className="seller-review-panel">
      <header><span><Sparkles size={19} /></span><div><h2>Ready to review</h2><p>The agent checked the request</p></div></header>
      <p>Quantity, artwork and delivery timing are complete. Accepting confirms your quote and production window; the buyer will fund the deposit next.</p>
      <ul><li><Check size={15} /> MOQ satisfied</li><li><Check size={15} /> Logo file attached</li><li><Check size={15} /> 28-day lead time available</li></ul>
      <div className="seller-review-actions"><button className="gradient-stroke-button" type="button" onClick={onAccept}>Accept order</button><button className="ghost-button" type="button" onClick={onRequestChanges}>Request changes</button><button type="button" onClick={onDecline}>Decline request</button></div>
    </aside>
  </div>;

  if (tab === "active" && requestState === "accepted") return <div className="orders-workspace">
    <section className="active-orders" aria-label="Active production orders">
      <div className="orders-section-title"><h2>Accepted</h2><span>1 order</span></div>
      <article className="order-feature-row seller-request-row">
        <ProductVisual product={orderProduct} />
        <div className="order-feature-copy">
          <span className="order-stage order-stage--waiting"><Clock3 size={14} /> Waiting for deposit</span>
          <h3>Blue Lotus Teapot</h3>
          <p>Mai Anh · Buyer</p>
          <dl><div><dt>Order</dt><dd>{DEMO_ORDER_REFERENCE}</dd></div><div><dt>Deposit</dt><dd>96 USDC · Pending</dd></div><div><dt>Your production window</dt><dd>22 July–18 August</dd></div></dl>
        </div>
      </article>
    </section>
    <AgentWatch mode="seller" onOpenAgent={onRequestChanges} />
  </div>;

  if (tab === "requests") return <OrderStageEmpty index="01" title="No requests waiting." detail="New buyer requests will appear here only after the agent confirms that the required order details are complete." />;
  if (tab === "active") return <OrderStageEmpty index="02" title="No active production." detail="Accepted and funded orders will move here with their proof, production and delivery milestones." />;
  return <OrderStageEmpty index="03" title={requestState === "declined" ? "One request was declined." : "No seller history yet."} detail={requestState === "declined" ? "The buyer has been notified. The agent preserved the request details in case they return with changes." : "Completed, cancelled and declined seller orders will remain here."} />;
}

function AgentWatch({ mode, onOpenAgent }: { mode: OrderMode; onOpenAgent: () => void }) {
  const seller = mode === "seller";
  return <aside className="orders-agent-watch">
    <div className="agent-watch-heading"><span><Sparkles size={20} /></span><div><h2>Agent watch</h2><p>Working in the background</p></div></div>
    <p className="agent-watch-message">{seller ? "I’ll notify you as soon as the buyer funds the deposit. Production does not need to start before then." : "I’m waiting for the maker to confirm the final lotus motif. You don’t need to do anything right now."}</p>
    <ol>
      <li className="complete"><span><Check size={15} /></span><div><strong>{seller ? "Order accepted" : "Deposit verified"}</strong><small>{seller ? "Quote and production window confirmed" : "Arc · 96 USDC"}</small></div></li>
      <li className="current"><span><Clock3 size={15} /></span><div><strong>{seller ? "Buyer funding" : "Maker follow-up"}</strong><small>{seller ? "Agent reminder scheduled in 24 hours" : "Scheduled tomorrow at 10:00"}</small></div></li>
      <li><span><PackageCheck size={15} /></span><div><strong>Production proof</strong><small>Agent will notify both sides when ready</small></div></li>
    </ol>
    <button className="gradient-stroke-button full-width" type="button" onClick={onOpenAgent}><Sparkles size={17} /> Ask about this order</button>
  </aside>;
}

function OrderStageEmpty({ index, title, detail }: { index: string; title: string; detail: string }) {
  return <section className="order-stage-empty"><span>{index}</span><div><h2>{title}</h2><p>{detail}</p></div></section>;
}
