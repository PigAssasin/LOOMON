"use client";

import Image from "next/image";
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
  SmilePlus,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAddress, keccak256, toBytes } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { SiteHeader } from "@/src/components/site-header";
import {
  commerceWorkspaceSchema,
  emptyCommerceWorkspace,
  statusLabel,
  type CommerceItem,
} from "@/src/domain/commerce-workspace";
import {
  escrowOrderContextSchema,
  type EscrowAction,
  type EscrowOrderContext,
} from "@/src/domain/escrow-order";
import { getProductBySlug } from "@/src/data/products";
import { sessionMatchesWallet } from "@/src/features/auth/sign-in-wallet";
import { useLoomonSession } from "@/src/features/auth/use-loomon-session";
import { ARC_TESTNET } from "@/src/lib/arc";
import { loomonEscrowPoolAbi } from "@/src/lib/payments/escrow-pool";

const SINGLE_DEMO_SELLER_ADDRESS = "0xd59aa8db407d4219fe4b104ca4142df14301dec4";

function isSingleDemoSeller(address?: string) {
  return address?.toLowerCase() === SINGLE_DEMO_SELLER_ADDRESS;
}

type ThreadMessage = {
  id: string;
  senderType: string;
  body?: string | null;
  kind: string;
  structuredBody?: { event?: string; reason?: string } | null;
  createdAt: string;
  attachments?: Array<{ id: string; label?: string | null; type?: string; url?: string | null }>;
};
type BriefAsset = {
  id: string;
  role?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  label: string;
  url: string | null;
};
type BriefAssets = {
  briefType: string | null;
  makerNotes: string | null;
  assets: BriefAsset[];
};

function cleanProductTitle(item: CommerceItem) {
  const catalogProduct = getProductBySlug(item.productSlug);
  const raw = item.productTitle?.trim();
  if (catalogProduct && (!raw || raw === item.productSlug || raw.includes("-"))) return catalogProduct.title;
  if (!raw) return catalogProduct?.title ?? "Custom product";
  return raw
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function OrderDetailExperience({ reference }: { reference: string }) {
  const session = useLoomonSession();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: ARC_TESTNET.id });
  const [item, setItem] = useState<CommerceItem>();
  const [escrow, setEscrow] = useState<EscrowOrderContext>();
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [briefAssets, setBriefAssets] = useState<BriefAssets>();
  const [message, setMessage] = useState("");
  const [messageImage, setMessageImage] = useState<File>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pageOpenedAt] = useState(Date.now);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!session.supabase) return;
    if (!silent) setLoading(true);

    const { data: authData } = await session.supabase.auth.getSession();
    let workspace = emptyCommerceWorkspace;
    let loadedAsDemoSeller = false;
    const demoSellerAddress = isSingleDemoSeller(address) ? address : undefined;

    if (
      demoSellerAddress
      && (!authData.session || !sessionMatchesWallet(authData.session, address))
    ) {
      const response = await fetch(
        `/api/orders/demo-seller-workspace?address=${encodeURIComponent(demoSellerAddress)}`,
      );
      if (response.ok) {
        workspace = commerceWorkspaceSchema.parse(await response.json());
        loadedAsDemoSeller = true;
      }
    } else if (address && (!authData.session || !sessionMatchesWallet(authData.session, address))) {
      const response = await fetch(
        `/api/orders/wallet-workspace?address=${encodeURIComponent(address)}`,
      );
      if (response.ok) {
        workspace = commerceWorkspaceSchema.parse(await response.json());
      }
    } else {
      const { data, error: workspaceError } = await session.supabase.rpc("get_my_commerce_workspace");
      if (workspaceError) {
        setError("This order could not be loaded.");
        if (!silent) setLoading(false);
        return;
      }
      workspace = commerceWorkspaceSchema.parse(data ?? emptyCommerceWorkspace);
    }

    const buyerItem = workspace.buyingOrders.find((order) => order.reference === reference);
    const sellerItem = workspace.sellingOrders.find((order) => order.reference === reference);
    const found = buyerItem ?? sellerItem;
    setItem(found);
    setRole(buyerItem ? "buyer" : "seller");
    if (found?.kind === "order") {
      const escrowData = loadedAsDemoSeller && demoSellerAddress
        ? await fetch(
          `/api/orders/demo-seller-escrow?address=${encodeURIComponent(demoSellerAddress)}&orderId=${encodeURIComponent(found.id)}`,
        ).then((response) => response.ok ? response.json() : undefined)
        : address
          ? await fetch(
            `/api/orders/wallet-escrow?address=${encodeURIComponent(address)}&orderId=${encodeURIComponent(found.id)}`,
          ).then((response) => response.ok ? response.json() : undefined)
        : (await session.supabase.rpc(
          "get_order_escrow_context",
          { p_order_id: found.id },
        )).data;
      setEscrow(
        escrowData ? escrowOrderContextSchema.safeParse(escrowData).data : undefined,
      );
      const briefResponse = await fetch(
        `/api/orders/${found.id}/brief-assets${address ? `?address=${encodeURIComponent(address)}` : ""}`,
      );
      setBriefAssets(briefResponse.ok ? await briefResponse.json() as BriefAssets : undefined);
    } else {
      setEscrow(undefined);
      setBriefAssets(undefined);
    }
    if (found?.kind === "order" && address) {
      const messageResponse = await fetch(
        `/api/orders/${found.id}/messages?address=${encodeURIComponent(address)}`,
      );
      if (messageResponse.ok) {
        const body = await messageResponse.json() as { messages?: ThreadMessage[] };
        setMessages(Array.isArray(body.messages) ? body.messages : []);
      }
    } else if (found?.threadId) {
      const { data: threadData } = await session.supabase.rpc("list_thread_messages", {
        p_thread_id: found.threadId,
      });
      setMessages(Array.isArray(threadData) ? threadData as ThreadMessage[] : []);
    }
    if (!silent) setLoading(false);
  }, [address, reference, session.supabase]);

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
        void load({ silent: true });
      })
      .on("postgres_changes", { event: "INSERT", schema: "messaging", table: "messages", filter: `thread_id=eq.${item.threadId}` }, () => {
        void load({ silent: true });
      })
      .on("postgres_changes", { event: "*", schema: "commerce", table: "order_proof_nfts", filter: `order_id=eq.${item.id}` }, () => {
        void load({ silent: true });
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
    const prepaid = [
      "escrow_funded",
      "in_production",
      "seller_marked_delivered",
      "release_hold",
      "released",
    ].includes(item.status);
    const ranks = prepaid
      ? [
          "escrow_funded",
          "in_production",
          "seller_marked_delivered",
          "release_hold",
          "released",
        ]
      : [
          "seller_accepted",
          "in_progress",
          "seller_marked_delivered",
          "buyer_confirmed_received",
          "proof_pending",
          "proof_minted",
        ];
    const current = ranks.indexOf(item.status);
    const timeline = prepaid ? [
      { key: "escrow_funded", title: "Funded on Arc", detail: "Your USDC is protected in the LOOMON escrow pool." },
      { key: "in_production", title: "In production", detail: "The seller has started the custom order." },
      { key: "seller_marked_delivered", title: "Delivered for review", detail: "The buyer can confirm completion or report an issue." },
      { key: "release_hold", title: "Seven-day protection", detail: "Completion is confirmed; seller funds remain locked for seven days." },
      { key: "released", title: "Seller paid", detail: "The seller claimed the escrow after the protection period." },
    ] : [
      { key: "seller_accepted", title: "Seller accepted", detail: "The maker accepted the customization request." },
      { key: "in_progress", title: "Preparing the order", detail: "The seller is preparing the demo order." },
      { key: "seller_marked_delivered", title: "Seller marked delivered", detail: "The buyer must confirm receipt before minting." },
      { key: "proof_minted", title: "Order proof on Arc", detail: "A non-transferable proof appears under Purchased." },
    ];
    return timeline.map((step) => {
      const rank = ranks.indexOf(step.key);
      return { ...step, state: current > rank || ["proof_minted", "released"].includes(item.status) ? "done" : current === rank ? "current" : "next" };
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

  async function transitionEscrow(action: EscrowAction, reason = "") {
    if (!item || !escrow || !address) return;
    setBusy(true);
    setError("");
    try {
      const orderId = escrow.onchainOrderId as `0x${string}`;
      const reasonHash = keccak256(toBytes(reason || `${action}:${item.id}`));
      let transactionHash: `0x${string}`;
      if (action === "start_production") {
        transactionHash = await writeContractAsync({
          address: getAddress(escrow.poolAddress),
          abi: loomonEscrowPoolAbi,
          functionName: "startProduction",
          args: [orderId],
          chainId: ARC_TESTNET.id,
        });
      } else if (action === "mark_delivered") {
        let chainState: number | null = null;
        if (publicClient) {
          const rawOrder = await publicClient.readContract({
            address: getAddress(escrow.poolAddress),
            abi: loomonEscrowPoolAbi,
            functionName: "getOrder",
            args: [orderId],
          });
          const stateValue = Array.isArray(rawOrder)
            ? rawOrder[4]
            : (rawOrder as { state?: number | bigint }).state;
          chainState = Number(stateValue);
        }
        if (chainState === 3) {
          throw new Error("This order is already delivered on Arc. Refresh the page to restore the database view.");
        }
        if (chainState !== null && chainState !== 2) {
          throw new Error(`This order is not deliverable on Arc right now. Current onchain state: ${chainState}.`);
        }
        transactionHash = await writeContractAsync({
          address: getAddress(escrow.poolAddress),
          abi: loomonEscrowPoolAbi,
          functionName: "markDelivered",
          args: [orderId, reasonHash],
          chainId: ARC_TESTNET.id,
        });
      } else if (action === "confirm_completion") {
        transactionHash = await writeContractAsync({
          address: getAddress(escrow.poolAddress),
          abi: loomonEscrowPoolAbi,
          functionName: "confirmCompletion",
          args: [orderId, reasonHash],
          chainId: ARC_TESTNET.id,
        });
      } else if (action === "claim") {
        transactionHash = await writeContractAsync({
          address: getAddress(escrow.poolAddress),
          abi: loomonEscrowPoolAbi,
          functionName: "claimSellerFunds",
          args: [orderId],
          chainId: ARC_TESTNET.id,
        });
      } else if (action === "cancel") {
        transactionHash = await writeContractAsync({
          address: getAddress(escrow.poolAddress),
          abi: loomonEscrowPoolAbi,
          functionName: "cancelBeforeProduction",
          args: [orderId, reasonHash],
          chainId: ARC_TESTNET.id,
        });
      } else if (action === "refund") {
        transactionHash = await writeContractAsync({
          address: getAddress(escrow.poolAddress),
          abi: loomonEscrowPoolAbi,
          functionName: "refundBuyer",
          args: [orderId, reasonHash],
          chainId: ARC_TESTNET.id,
        });
      } else {
        transactionHash = await writeContractAsync({
          address: getAddress(escrow.poolAddress),
          abi: loomonEscrowPoolAbi,
          functionName: "raiseDispute",
          args: [orderId, reasonHash],
          chainId: ARC_TESTNET.id,
        });
      }

      const response = await fetch(`/api/orders/${item.id}/escrow/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, transactionHash, walletAddress: address }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body?.error ?? "Escrow event could not be verified");
      }
      if (action === "confirm_completion") {
        const proofResponse = await fetch(`/api/orders/${item.id}/proof`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requestKey: crypto.randomUUID() }),
        });
        if (!proofResponse.ok) {
          setError("Completion confirmed. The order proof will retry safely.");
        }
      }
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error && /rejected|denied/i.test(cause.message)
          ? "No change was made. The wallet request was closed."
          : cause instanceof Error
            ? cause.message
            : "The Arc order action failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item || !address || (!message.trim() && !messageImage)) return;
    setBusy(true);
    const body = new FormData();
    body.append("address", address);
    body.append("body", message.trim());
    if (messageImage) body.append("image", messageImage);
    const response = await fetch(`/api/orders/${item.id}/messages`, {
      method: "POST",
      body,
    });
    setBusy(false);
    if (!response.ok) {
      setError("Your message was not sent. Please try again.");
      return;
    }
    setMessage("");
    setMessageImage(undefined);
    await load();
  }

  if (loading) {
    return <OrderPageShell><div className="order-stage-empty"><RefreshCw size={22} /><div><h2>Loading order</h2><p>Checking the latest status and messages.</p></div></div></OrderPageShell>;
  }

  if (!item) {
    return <OrderPageShell><Link className="order-back-link" href="/app/orders"><ArrowLeft size={17} /> Back to orders</Link><div className="order-stage-empty"><span>—</span><div><h2>Order not found.</h2><p>Connect the wallet that bought or manages this order.</p></div></div></OrderPageShell>;
  }

  const sellerClaimableAt = escrow?.sellerClaimableAt
    ? new Date(escrow.sellerClaimableAt)
    : undefined;
  const sellerClaimIsLocked = Boolean(
    sellerClaimableAt && sellerClaimableAt.getTime() > pageOpenedAt,
  );

  return <OrderPageShell>
    <Link className="order-back-link" href="/app/orders"><ArrowLeft size={17} /> Back to orders</Link>
    <header className="real-order-header">
      <div className="order-reference"><span>{item.kind === "request" ? "Request" : "Order"}</span><strong>{item.reference}</strong><button type="button" onClick={async () => { await navigator.clipboard.writeText(item.reference); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }}><Copy size={15} /> {copied ? "Copied" : "Copy"}</button></div>
      <h1>{cleanProductTitle(item)}</h1>
      <p>{role === "buyer" ? item.makerName : item.buyerName ?? "Buyer"} · {statusLabel(item.status)}</p>
    </header>
    {error || session.error ? <p className="form-error" role="alert">{error || session.error}</p> : null}

    <div className="order-grid real-order-grid">
      <section>
        <ol className="timeline">{steps.map((step) => <li className={`timeline-${step.state}`} key={step.key}><span>{step.state === "done" ? <Check size={18} /> : step.state === "current" ? <Clock3 size={18} /> : null}</span><div><strong>{step.title}</strong><p>{step.detail}</p></div></li>)}</ol>
        <div className="order-detail-actions">
          {escrow && role === "seller" && item.status === "escrow_funded" ? <button className="gradient-stroke-button" disabled={busy} type="button" onClick={() => void transitionEscrow("start_production", "Seller accepted the paid order")}><Check size={17} /> Accept</button> : null}
          {escrow && role === "seller" && item.status === "escrow_funded" ? <button className="ghost-button" disabled={busy} type="button" onClick={() => void transitionEscrow("refund", "Seller rejected and refunded the buyer")}>Reject + refund</button> : null}
          {escrow && role === "seller" && item.status === "in_production" ? <button className="gradient-stroke-button" disabled={busy} type="button" onClick={() => void transitionEscrow("mark_delivered", "Seller marked the demo order delivered")}><PackageCheck size={17} /> Mark delivered</button> : null}
          {escrow && role === "buyer" && item.status === "seller_marked_delivered" ? <>
            <button className="gradient-stroke-button" disabled={busy} type="button" onClick={() => void transitionEscrow("confirm_completion", "Buyer confirmed successful completion")}><Check size={17} /> Mint NFT</button>
            <button className="ghost-button" disabled={busy} type="button" onClick={() => { const reason = window.prompt("Describe the issue"); if (reason) void transitionEscrow("dispute", reason); }}>Report an issue</button>
          </> : null}
          {escrow && role === "buyer" && item.status === "escrow_funded" ? <button className="ghost-button" disabled={busy} type="button" onClick={() => void transitionEscrow("cancel", "Buyer cancelled before production")}>Cancel and refund</button> : null}
          {escrow && role === "seller" && item.status === "in_production" ? <button className="ghost-button" disabled={busy} type="button" onClick={() => void transitionEscrow("refund", "Seller refunded the buyer")}>Cancel/refund</button> : null}
          {escrow && role === "seller" && item.status === "release_hold" ? <button className="gradient-stroke-button" disabled={busy || sellerClaimIsLocked} type="button" onClick={() => void transitionEscrow("claim")}><Check size={17} /> {sellerClaimIsLocked && sellerClaimableAt ? `Claim after ${sellerClaimableAt.toLocaleDateString()}` : "Claim USDC"}</button> : null}
          {!escrow && ["seller_accepted", "in_progress"].includes(item.status) ? <p className="order-chat-empty">This is a legacy demo order without Arc escrow. Create a new paid order to use onchain delivery, refund and proof minting.</p> : null}
          {!escrow && role === "buyer" && item.status === "seller_marked_delivered" ? <button className="gradient-stroke-button" disabled={busy} type="button" onClick={() => void transition("confirm_received")}><Check size={17} /> Confirm received</button> : null}
        </div>
      </section>

      <aside className="order-chat-panel">
        {briefAssets ? <section className="order-brief-assets">
          <header><PackageCheck size={20} /><div><h2>Custom brief</h2><p>{briefAssets.briefType?.replaceAll("_", " ") ?? "Standard product order"}</p></div></header>
          <dl className="order-brief-summary">
            <div><dt>Quantity</dt><dd>{item.quantity}</dd></div>
            <div><dt>Needed by</dt><dd>{item.requiredBy ?? "Flexible"}</dd></div>
            <div><dt>Order note</dt><dd>{item.note || briefAssets.makerNotes || "No extra note"}</dd></div>
          </dl>
          {briefAssets.assets.length ? <div className="order-brief-asset-grid">
            {briefAssets.assets.map((asset) => asset.url ? <a href={asset.url} target="_blank" rel="noreferrer" key={asset.id}>
              <Image src={asset.url} alt={asset.label} width={320} height={240} unoptimized />
              <span>{asset.label}</span>
            </a> : null)}
          </div> : <p className="order-chat-empty">No uploaded artwork. Follow the seller notes below.</p>}
          {briefAssets.makerNotes ? <p className="order-brief-notes">{briefAssets.makerNotes}</p> : null}
        </section> : null}
        <header><MessageCircle size={20} /><div><h2>Buyer · Seller chat</h2><p>Messages stay with this order.</p></div></header>
        <div className="order-chat-messages">
          {messages.length ? messages.map((entry) => entry.kind === "text" ? <article className={`order-chat-message order-chat-message--${entry.senderType}`} key={entry.id}><span>{entry.senderType}</span>{entry.attachments?.map((attachment) => attachment.url ? <Image className="order-chat-image" src={attachment.url} alt={attachment.label ?? "Chat image"} width={260} height={220} unoptimized key={attachment.id} /> : null)}<p>{entry.body}</p><time>{new Date(entry.createdAt).toLocaleString()}</time></article> : <article className="order-chat-event" key={entry.id}><p>{entry.structuredBody?.event?.replaceAll("_", " ") ?? "Order updated"}</p>{entry.structuredBody?.reason ? <small>{entry.structuredBody.reason}</small> : null}</article>) : <p className="order-chat-empty">No messages yet. Start with a production or delivery question.</p>}
        </div>
        <form className="order-chat-form" onSubmit={sendMessage}>
          <div className="order-chat-emoji-row" aria-label="Quick emoji">{["👍", "🙏", "✅", "📦", "✨"].map((emoji) => <button type="button" key={emoji} onClick={() => setMessage((current) => `${current}${current ? " " : ""}${emoji}`)}><SmilePlus size={14} /> {emoji}</button>)}</div>
          {messageImage ? <div className="order-chat-image-chip"><span>{messageImage.name}</span><button type="button" onClick={() => setMessageImage(undefined)}><X size={14} /> Remove</button></div> : null}
          <label><span className="sr-only">Message</span><textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message…" /></label>
          <div className="order-chat-submit-row"><label className="order-chat-upload"><UploadCloud size={16} /> Image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setMessageImage(event.target.files?.[0])} /></label><button type="submit" disabled={busy || (!message.trim() && !messageImage)}><Send size={17} /> Send</button></div>
        </form>
      </aside>
    </div>
  </OrderPageShell>;
}

function OrderPageShell({ children }: { children: React.ReactNode }) {
  return <main><div className="static-header-wrap"><SiteHeader /></div><section className="order-page">{children}</section></main>;
}
