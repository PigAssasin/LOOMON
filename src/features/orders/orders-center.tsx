"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Clock3,
  PackageCheck,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/src/components/site-header";
import { ProductVisual } from "@/src/components/product-visual";
import {
  buyingStage,
  commerceWorkspaceSchema,
  emptyCommerceWorkspace,
  sellingStage,
  statusLabel,
  type CommerceItem,
  type CommerceWorkspace,
} from "@/src/domain/commerce-workspace";
import { getProductBySlug, products } from "@/src/data/products";
import { useLoomonSession } from "@/src/features/auth/use-loomon-session";

type OrderMode = "buyer" | "seller";
type BuyerTab = "requests" | "active" | "history";
type SellerTab = "incoming" | "active" | "history";
type PendingAction = {
  item: CommerceItem;
  action: "reject" | "request_changes" | "withdraw" | "cancel";
};

const actionCopy: Record<PendingAction["action"], { title: string; placeholder: string; confirm: string }> = {
  reject: {
    title: "Reject this request?",
    placeholder: "Tell the buyer why the request cannot be accepted.",
    confirm: "Reject request",
  },
  request_changes: {
    title: "What needs to change?",
    placeholder: "Describe the artwork, quantity, timing, or production detail to update.",
    confirm: "Send change request",
  },
  withdraw: {
    title: "Withdraw this request?",
    placeholder: "Optional context for the seller.",
    confirm: "Withdraw request",
  },
  cancel: {
    title: "Cancel this order?",
    placeholder: "Give the other side a short reason.",
    confirm: "Cancel order",
  },
};

export function OrdersCenter() {
  const session = useLoomonSession();
  const [mode, setMode] = useState<OrderMode>("buyer");
  const [buyerTab, setBuyerTab] = useState<BuyerTab>("requests");
  const [sellerTab, setSellerTab] = useState<SellerTab>("incoming");
  const [workspace, setWorkspace] = useState<CommerceWorkspace>(emptyCommerceWorkspace);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>();
  const [actionBusy, setActionBusy] = useState(false);
  const [claimableMakers, setClaimableMakers] = useState<Array<{ id: number; slug: string; display_name: string }>>([]);

  const loadWorkspace = useCallback(async () => {
    if (!session.supabase) {
      setError("LOOMON is temporarily unavailable.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const { data: authData } = await session.supabase.auth.getSession();
    if (!authData.session) {
      setWorkspace(emptyCommerceWorkspace);
      setLoading(false);
      return;
    }

    const [{ data, error: workspaceError }, { data: makers }] = await Promise.all([
      session.supabase.rpc("get_my_commerce_workspace"),
      session.supabase.rpc("list_claimable_demo_makers"),
    ]);
    if (workspaceError) {
      setError("Your orders could not be loaded. Please try again.");
    } else {
      setWorkspace(commerceWorkspaceSchema.parse(data));
    }
    setClaimableMakers(makers ?? []);
    setLoading(false);
  }, [session.supabase]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadWorkspace();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadWorkspace]);

  useEffect(() => {
    if (!session.supabase) return;
    const channel = session.supabase
      .channel("loomon-commerce-workspace")
      .on("postgres_changes", { event: "*", schema: "commerce", table: "quote_requests" }, () => {
        void loadWorkspace();
      })
      .on("postgres_changes", { event: "*", schema: "commerce", table: "orders" }, () => {
        void loadWorkspace();
      })
      .on("postgres_changes", { event: "*", schema: "commerce", table: "order_proof_nfts" }, () => {
        void loadWorkspace();
      })
      .subscribe();
    return () => {
      void session.supabase?.removeChannel(channel);
    };
  }, [loadWorkspace, session.supabase]);

  const buying = useMemo(
    () => [...workspace.buyingRequests, ...workspace.buyingOrders],
    [workspace],
  );
  const selling = useMemo(
    () => [...workspace.sellingRequests, ...workspace.sellingOrders],
    [workspace],
  );

  const buyerCounts = {
    requests: buying.filter((item) => buyingStage(item) === "requests").length,
    active: buying.filter((item) => buyingStage(item) === "active").length,
    history: buying.filter((item) => buyingStage(item) === "history").length,
  };
  const sellerCounts = {
    incoming: selling.filter((item) => sellingStage(item) === "incoming").length,
    active: selling.filter((item) => sellingStage(item) === "active").length,
    history: selling.filter((item) => sellingStage(item) === "history").length,
  };

  async function connectAndLoad() {
    if (await session.ensureSession()) await loadWorkspace();
  }

  async function claimMaker(makerId: number) {
    if (!session.supabase || !(await session.ensureSession())) return;
    setActionBusy(true);
    const { error: claimError } = await session.supabase.rpc("claim_demo_maker", {
      p_maker_id: makerId,
    });
    setActionBusy(false);
    if (claimError) {
      setError(
        /already_claimed/i.test(claimError.message)
          ? "That shop already has an owner."
          : "The shop could not be claimed.",
      );
      return;
    }
    await loadWorkspace();
  }

  async function transitionRequest(
    item: CommerceItem,
    action: "accept" | "reject" | "request_changes" | "withdraw",
    reason = "",
  ) {
    if (!session.supabase) return;
    setActionBusy(true);
    setError("");
    const { error: actionError } = await session.supabase.rpc("transition_quote_request", {
      p_request_id: item.id,
      p_action: action,
      p_reason: reason,
      p_request_key: crypto.randomUUID(),
    });
    setActionBusy(false);
    setPendingAction(undefined);
    if (actionError) {
      setError("This request changed before your action completed. Refresh and try again.");
      return;
    }
    await loadWorkspace();
    if (action === "accept") setSellerTab("active");
  }

  async function transitionOrder(
    item: CommerceItem,
    action: "mark_delivered" | "confirm_received" | "report_issue" | "cancel",
    reason = "",
  ) {
    if (!session.supabase) return;
    setActionBusy(true);
    setError("");
    const { data, error: actionError } = await session.supabase.rpc("transition_demo_order", {
      p_order_id: item.id,
      p_action: action,
      p_reason: reason,
      p_request_key: crypto.randomUUID(),
    });
    if (!actionError && action === "confirm_received") {
      const response = await fetch(`/api/orders/${item.id}/proof`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestKey: crypto.randomUUID() }),
      });
      if (!response.ok) {
        setError("Delivery was confirmed. Your Arc proof is queued and can be retried safely.");
      }
    }
    setActionBusy(false);
    setPendingAction(undefined);
    if (actionError) {
      setError("This order changed before your action completed. Refresh and try again.");
      return;
    }
    if (data) await loadWorkspace();
  }

  if (loading) {
    return <OrdersShell><OrderStageEmpty index="…" title="Loading your orders" detail="Checking the latest buyer and seller activity." /></OrdersShell>;
  }

  const isAuthenticated = Boolean(
    workspace.buyingRequests.length
      || workspace.buyingOrders.length
      || workspace.sellingRequests.length
      || workspace.sellingOrders.length,
  );

  return (
    <OrdersShell>
      <header className="orders-center-heading">
        <div><h1>Orders</h1><p>Requests, active work, delivery and history in one place.</p></div>
        <button className="ghost-button" type="button" onClick={() => void loadWorkspace()}>
          <Clock3 size={16} /> Refresh
        </button>
      </header>

      {error || session.error ? <p className="form-error" role="alert">{error || session.error}</p> : null}

      <nav className="orders-mode-switch" aria-label="Order workspace">
        <button className={mode === "buyer" ? "active" : ""} aria-pressed={mode === "buyer"} onClick={() => setMode("buyer")} type="button"><ShoppingBag size={19} /><span><strong>Buying</strong><small>{buying.length} total</small></span></button>
        <button className={mode === "seller" ? "active" : ""} aria-pressed={mode === "seller"} onClick={() => setMode("seller")} type="button"><Store size={19} /><span><strong>Selling</strong><small>{selling.length} total</small></span></button>
      </nav>

      {!isAuthenticated && !session.isConnected ? (
        <OrderStageEmpty
          index="01"
          title="Connect your wallet to view orders."
          detail="Your Buying and Selling activity is private to your LOOMON wallet."
          action={<button className="gradient-stroke-button" type="button" onClick={() => void connectAndLoad()} disabled={session.busy}>Connect wallet</button>}
        />
      ) : mode === "buyer" ? (
        <>
          <nav className="order-contract-tabs" aria-label="Buying order stages" role="tablist">
            <OrderTab index="01" label="Requests" count={buyerCounts.requests} active={buyerTab === "requests"} onClick={() => setBuyerTab("requests")} />
            <OrderTab index="02" label="Active" count={buyerCounts.active} active={buyerTab === "active"} onClick={() => setBuyerTab("active")} />
            <OrderTab index="03" label="History" count={buyerCounts.history} active={buyerTab === "history"} onClick={() => setBuyerTab("history")} />
          </nav>
          <CommerceList
            items={buying.filter((item) => buyingStage(item) === buyerTab)}
            mode="buyer"
            busy={actionBusy}
            onRequestAction={(item, action) => {
              if (action === "withdraw") setPendingAction({ item, action });
            }}
            onOrderAction={(item, action) => {
              if (action === "confirm_received") void transitionOrder(item, action);
              else setPendingAction({ item, action: "cancel" });
            }}
          />
        </>
      ) : (
        <>
          <nav className="order-contract-tabs" aria-label="Selling order stages" role="tablist">
            <OrderTab index="01" label="Incoming" count={sellerCounts.incoming} active={sellerTab === "incoming"} onClick={() => setSellerTab("incoming")} />
            <OrderTab index="02" label="Active" count={sellerCounts.active} active={sellerTab === "active"} onClick={() => setSellerTab("active")} />
            <OrderTab index="03" label="History" count={sellerCounts.history} active={sellerTab === "history"} onClick={() => setSellerTab("history")} />
          </nav>
          {!selling.length && claimableMakers.length ? (
            <ClaimShopPanel makers={claimableMakers} busy={actionBusy} onClaim={claimMaker} />
          ) : (
            <CommerceList
              items={selling.filter((item) => sellingStage(item) === sellerTab)}
              mode="seller"
              busy={actionBusy}
              onRequestAction={(item, action) => {
                if (action === "accept") void transitionRequest(item, action);
                else setPendingAction({ item, action });
              }}
              onOrderAction={(item, action) => {
                if (action === "mark_delivered") void transitionOrder(item, action);
                else setPendingAction({ item, action: "cancel" });
              }}
            />
          )}
        </>
      )}

      {pendingAction ? (
        <ReasonDialog
          action={pendingAction.action}
          busy={actionBusy}
          onClose={() => setPendingAction(undefined)}
          onConfirm={(reason) => {
            if (pendingAction.item.kind === "request") {
              void transitionRequest(pendingAction.item, pendingAction.action as "reject" | "request_changes" | "withdraw", reason);
            } else {
              void transitionOrder(pendingAction.item, "cancel", reason);
            }
          }}
        />
      ) : null}
    </OrdersShell>
  );
}

function OrdersShell({ children }: { children: React.ReactNode }) {
  return <main><div className="static-header-wrap"><SiteHeader /></div><section className="orders-center">{children}</section></main>;
}

function OrderTab({ index, label, count, active, onClick }: { index: string; label: string; count: number; active: boolean; onClick: () => void }) {
  return <button aria-selected={active} className={active ? "active" : ""} onClick={onClick} role="tab" type="button"><span>{index}</span>{label}<small>{count}</small></button>;
}

function CommerceList({
  items,
  mode,
  busy,
  onRequestAction,
  onOrderAction,
}: {
  items: CommerceItem[];
  mode: OrderMode;
  busy: boolean;
  onRequestAction: (item: CommerceItem, action: "accept" | "reject" | "request_changes" | "withdraw") => void;
  onOrderAction: (item: CommerceItem, action: "mark_delivered" | "confirm_received" | "cancel") => void;
}) {
  if (!items.length) {
    return <OrderStageEmpty index="—" title="Nothing here yet." detail={mode === "buyer" ? "Your next buyer action will appear here." : "New seller activity will appear here."} />;
  }

  return <section className="active-orders orders-real-list">
    <div className="orders-section-title"><h2>{mode === "buyer" ? "Your purchases" : "Your shop"}</h2><span>{items.length}</span></div>
    {items.map((item) => <CommerceRow key={`${item.kind}-${item.id}`} item={item} mode={mode} busy={busy} onRequestAction={onRequestAction} onOrderAction={onOrderAction} />)}
  </section>;
}

function CommerceRow({
  item,
  mode,
  busy,
  onRequestAction,
  onOrderAction,
}: {
  item: CommerceItem;
  mode: OrderMode;
  busy: boolean;
  onRequestAction: (item: CommerceItem, action: "accept" | "reject" | "request_changes" | "withdraw") => void;
  onOrderAction: (item: CommerceItem, action: "mark_delivered" | "confirm_received" | "cancel") => void;
}) {
  const product = getProductBySlug(item.productSlug) ?? products[0];
  const href = `/app/orders/${encodeURIComponent(item.reference)}`;
  return <article className="order-feature-row seller-request-row order-real-row">
    <ProductVisual product={product} />
    <div className="order-feature-copy">
      <span className="order-stage"><i /> {statusLabel(item.status)}</span>
      <h3>{item.productTitle}</h3>
      <p>{mode === "buyer" ? item.makerName : `${item.buyerName ?? "Buyer"} · Buyer`}</p>
      <dl>
        <div><dt>{item.kind === "order" ? "Order" : "Request"}</dt><dd>{item.reference}</dd></div>
        <div><dt>Quantity</dt><dd>{item.quantity}</dd></div>
        <div><dt>Needed by</dt><dd>{item.requiredBy ?? "Flexible"}</dd></div>
      </dl>
    </div>
    <div className="order-row-actions">
      {item.kind === "request" && mode === "buyer" && ["submitted", "seller_review", "changes_requested"].includes(item.status) ? <button type="button" onClick={() => onRequestAction(item, "withdraw")} disabled={busy}>Withdraw</button> : null}
      {item.kind === "request" && mode === "seller" && ["submitted", "seller_review", "changes_requested"].includes(item.status) ? <>
        <button className="gradient-stroke-button" type="button" onClick={() => onRequestAction(item, "accept")} disabled={busy}>Accept</button>
        <button type="button" onClick={() => onRequestAction(item, "request_changes")} disabled={busy}>Request changes</button>
        <button type="button" onClick={() => onRequestAction(item, "reject")} disabled={busy}>Reject</button>
      </> : null}
      {item.kind === "order" && mode === "seller" && ["seller_accepted", "in_progress"].includes(item.status) ? <button className="gradient-stroke-button" type="button" onClick={() => onOrderAction(item, "mark_delivered")} disabled={busy}><PackageCheck size={16} /> Mark delivered</button> : null}
      {item.kind === "order" && mode === "buyer" && item.status === "seller_marked_delivered" ? <button className="gradient-stroke-button" type="button" onClick={() => onOrderAction(item, "confirm_received")} disabled={busy}><Check size={16} /> Confirm received</button> : null}
      {item.kind === "order" && ["seller_accepted", "in_progress"].includes(item.status) ? <button type="button" onClick={() => onOrderAction(item, "cancel")} disabled={busy}>Cancel</button> : null}
      <Link href={href} aria-label={`Open ${item.reference}`}><ArrowUpRight size={18} /></Link>
    </div>
  </article>;
}

function ClaimShopPanel({ makers, busy, onClaim }: { makers: Array<{ id: number; slug: string; display_name: string }>; busy: boolean; onClaim: (makerId: number) => void }) {
  return <section className="order-stage-empty claim-shop-panel">
    <Store size={24} />
    <div><h2>Choose the demo shop you manage.</h2><p>Claiming a shop creates your real seller membership. A shop can have only one demo owner.</p>
      <div className="claim-shop-options">{makers.map((maker) => <button type="button" disabled={busy} onClick={() => onClaim(maker.id)} key={maker.id}>{maker.display_name}</button>)}</div>
    </div>
  </section>;
}

function ReasonDialog({ action, busy, onClose, onConfirm }: { action: PendingAction["action"]; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const copy = actionCopy[action];
  const required = action !== "withdraw";
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={copy.title}>
    <button className="modal-scrim" onClick={onClose} aria-label="Close" />
    <section className="settings-panel order-action-dialog">
      <header><div><span><h2>{copy.title}</h2><p>This update is shared with the other side.</p></span></div><button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button></header>
      <form onSubmit={(event) => { event.preventDefault(); onConfirm(reason.trim() || "No longer needed"); }}>
        <label><span>Reason {required ? "" : "(optional)"}</span><textarea autoFocus rows={5} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={copy.placeholder} required={required} /></label>
        <button className="gradient-stroke-button full-width" type="submit" disabled={busy || (required && !reason.trim())}>{copy.confirm}</button>
      </form>
    </section>
  </div>;
}

function OrderStageEmpty({ index, title, detail, action }: { index: string; title: string; detail: string; action?: React.ReactNode }) {
  return <section className="order-stage-empty"><span>{index}</span><div><h2>{title}</h2><p>{detail}</p>{action}</div></section>;
}
