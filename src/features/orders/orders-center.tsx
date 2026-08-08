"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock3,
  ExternalLink,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAddress, keccak256, toBytes } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { SiteHeader } from "@/src/components/site-header";
import { ProductVisual } from "@/src/components/product-visual";
import {
  buyingStage,
  applyEscrowActionToWorkspace,
  commerceWorkspaceSchema,
  emptyCommerceWorkspace,
  mergeCommerceWorkspaces,
  sellingStage,
  statusLabel,
  type CommerceItem,
  type CommerceWorkspace,
} from "@/src/domain/commerce-workspace";
import { getProductBySlug, products } from "@/src/data/products";
import {
  escrowOrderContextSchema,
  type EscrowAction,
  type EscrowOrderContext,
} from "@/src/domain/escrow-order";
import { buildOrderProofExplorerUrl } from "@/src/domain/order-proof";
import type { OrderProofRecord } from "@/src/domain/order-proof";
import { useAgent } from "@/src/features/agent/agent-provider";
import { useLoomonSession } from "@/src/features/auth/use-loomon-session";
import { sessionMatchesWallet } from "@/src/features/auth/sign-in-wallet";
import { ARC_TESTNET } from "@/src/lib/arc";
import {
  LOOMON_QUOTE_DECISION_ADDRESS,
  loomonQuoteDecisionAbi,
  quoteDecisionCode,
} from "@/src/lib/payments/quote-decision";
import { loomonEscrowPoolAbi } from "@/src/lib/payments/escrow-pool";

type OrderMode = "buyer" | "seller";
type BuyerTab = "requests" | "active" | "history";
type SellerTab = "incoming" | "active" | "history";
type PendingAction = {
  item: CommerceItem;
  action: "reject" | "request_changes" | "withdraw" | "cancel";
};
type OrderAssetPreview = { url: string; label: string };

const SINGLE_DEMO_SELLER_ADDRESS = "0xd59aa8db407d4219fe4b104ca4142df14301dec4";

function isSingleDemoSeller(address?: string) {
  return address?.toLowerCase() === SINGLE_DEMO_SELLER_ADDRESS;
}

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

function chooseOrderAsset(assets: Array<{ role?: string | null; label?: string | null; url?: string | null }> = []) {
  const withUrl = assets.filter((asset) => asset.url);
  return (
    withUrl.find((asset) => asset.role === "agent_render")
    ?? withUrl.find((asset) => /selected|approved|preview/i.test(asset.label ?? ""))
    ?? withUrl.find((asset) => !/uploaded artwork|source/i.test(asset.label ?? ""))
    ?? withUrl[0]
  );
}

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
  const {
    address,
    authTick,
    busy: sessionBusy,
    ensureSession,
    error: sessionError,
    isConnected,
    supabase,
  } = session;
  const [mode, setMode] = useState<OrderMode>("buyer");
  const [buyerTab, setBuyerTab] = useState<BuyerTab>("requests");
  const [sellerTab, setSellerTab] = useState<SellerTab>("incoming");
  const [workspace, setWorkspace] = useState<CommerceWorkspace>(emptyCommerceWorkspace);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>();
  const [actionBusy, setActionBusy] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string>();
  const setActionStatus = useCallback((message?: string) => {
    void message;
  }, []);
  const [orderAssetsById, setOrderAssetsById] = useState<Record<string, OrderAssetPreview>>({});
  const actionBusyRef = useRef(false);
  const [proofsByOrderId, setProofsByOrderId] = useState<Record<string, OrderProofRecord>>({});
  const [claimableMakers, setClaimableMakers] = useState<Array<{ id: number; slug: string; display_name: string }>>([]);
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: ARC_TESTNET.id });

  const loadSingleDemoSellerWorkspace = useCallback(async () => {
    if (!address || !isSingleDemoSeller(address)) return false;
    const response = await fetch(
      `/api/orders/demo-seller-workspace?address=${encodeURIComponent(address)}`,
    );
    if (!response.ok) return false;
    const data = await response.json();
    setWorkspace(commerceWorkspaceSchema.parse(data));
    setClaimableMakers([]);
    return true;
  }, [address]);

  const loadWalletBuyerWorkspace = useCallback(async () => {
    if (!address || isSingleDemoSeller(address)) return false;
    const response = await fetch(
      `/api/orders/wallet-workspace?address=${encodeURIComponent(address)}`,
    );
    if (!response.ok) return false;
    const data = await response.json();
    setWorkspace(commerceWorkspaceSchema.parse(data));
    setClaimableMakers([]);
    return true;
  }, [address]);

  const loadWorkspace = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!supabase) {
      setError("LOOMON is temporarily unavailable.");
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
      setError("");
    }

    const { data: authData } = await supabase.auth.getSession();
    let currentSession = authData.session;
    if (!currentSession && isConnected && address && await ensureSession()) {
      const { data: refreshedAuthData } = await supabase.auth.getSession();
      currentSession = refreshedAuthData.session;
    }

    if (!currentSession) {
      const loadedWalletWorkspace = await loadSingleDemoSellerWorkspace() || await loadWalletBuyerWorkspace();
      if (!loadedWalletWorkspace) {
        setWorkspace(emptyCommerceWorkspace);
      }
      if (!silent) setLoading(false);
      return;
    }
    if (isConnected && !sessionMatchesWallet(currentSession, address)) {
      if (address && await ensureSession()) {
        const { data: refreshedAuthData } = await supabase.auth.getSession();
        currentSession = refreshedAuthData.session;
      }
    }

    if (isConnected && !sessionMatchesWallet(currentSession, address)) {
      if (!(await loadSingleDemoSellerWorkspace()) && !(await loadWalletBuyerWorkspace())) {
        await supabase.auth.signOut();
        setWorkspace(emptyCommerceWorkspace);
      }
      if (!silent) setLoading(false);
      return;
    }

    const [{ data, error: workspaceError }, { data: makers }] = await Promise.all([
      supabase.rpc("get_my_commerce_workspace"),
      supabase.rpc("list_claimable_demo_makers"),
    ]);
    let nextWorkspace = emptyCommerceWorkspace;
    if (workspaceError) {
      setError("Your orders could not be loaded. Please try again.");
    } else {
      nextWorkspace = commerceWorkspaceSchema.parse(data);
    }

    if (address) {
      const walletWorkspaceResponse = isSingleDemoSeller(address)
        ? await fetch(`/api/orders/demo-seller-workspace?address=${encodeURIComponent(address)}`)
        : await fetch(`/api/orders/wallet-workspace?address=${encodeURIComponent(address)}`);
      if (walletWorkspaceResponse.ok) {
        const walletWorkspace = commerceWorkspaceSchema.parse(await walletWorkspaceResponse.json());
        nextWorkspace = mergeCommerceWorkspaces(nextWorkspace, walletWorkspace);
      }
    }
    setWorkspace(nextWorkspace);
    const proofUrl = address
      ? `/api/purchases/proofs?address=${encodeURIComponent(address)}`
      : "/api/purchases/proofs";
    const proofResponse = await fetch(proofUrl);
    if (proofResponse.ok) {
      const proofData = await proofResponse.json() as { proofs: Array<OrderProofRecord & { orderNumber?: string }> };
      setProofsByOrderId(Object.fromEntries(proofData.proofs.map((proof) => [proof.orderId, proof])));
    } else {
      setProofsByOrderId({});
    }
    setClaimableMakers(makers ?? []);
    if (!silent) setLoading(false);
  }, [address, ensureSession, isConnected, loadSingleDemoSellerWorkspace, loadWalletBuyerWorkspace, supabase]);

  async function readEscrowState(escrow: EscrowOrderContext) {
    if (!publicClient) return null;
    const rawOrder = await publicClient.readContract({
      address: getAddress(escrow.poolAddress),
      abi: loomonEscrowPoolAbi,
      functionName: "getOrder",
      args: [escrow.onchainOrderId as `0x${string}`],
    });
    const stateValue = Array.isArray(rawOrder)
      ? rawOrder[4]
      : (rawOrder as { state?: number | bigint }).state;
    return Number(stateValue);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadWorkspace();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadWorkspace, address, authTick, isConnected]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("loomon-commerce-workspace")
      .on("postgres_changes", { event: "*", schema: "commerce", table: "quote_requests" }, () => {
        if (actionBusyRef.current) return;
        void loadWorkspace({ silent: true });
      })
      .on("postgres_changes", { event: "*", schema: "commerce", table: "orders" }, () => {
        if (actionBusyRef.current) return;
        void loadWorkspace({ silent: true });
      })
      .on("postgres_changes", { event: "*", schema: "commerce", table: "order_proof_nfts" }, () => {
        if (actionBusyRef.current) return;
        void loadWorkspace({ silent: true });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadWorkspace, supabase]);

  useEffect(() => {
    const orders = [...workspace.buyingOrders, ...workspace.sellingOrders];
    const missing = orders.filter((item) => !orderAssetsById[item.id]);
    if (!missing.length) return;
    let active = true;
    void Promise.all(missing.map(async (item) => {
      const url = `/api/orders/${item.id}/brief-assets${address ? `?address=${encodeURIComponent(address)}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const body = await response.json() as {
        assets?: Array<{ role?: string | null; label?: string | null; url?: string | null }>;
      };
      const asset = chooseOrderAsset(body.assets);
      return asset?.url ? [item.id, { url: asset.url, label: asset.label ?? "Order image" }] as const : null;
    })).then((results) => {
      if (!active) return;
      const entries = results.filter(Boolean) as Array<readonly [string, OrderAssetPreview]>;
      if (entries.length) {
        setOrderAssetsById((current) => ({ ...current, ...Object.fromEntries(entries) }));
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [address, orderAssetsById, workspace.buyingOrders, workspace.sellingOrders]);

  const buying = useMemo(
    () => [...workspace.buyingRequests, ...workspace.buyingOrders],
    [workspace],
  );
  const selling = useMemo(
    () => [...workspace.sellingRequests, ...workspace.sellingOrders],
    [workspace],
  );
  const connectedAddressLabel = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : "";

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

  useEffect(() => {
    if (isSingleDemoSeller(address)) {
      window.queueMicrotask(() => setMode("seller"));
    }
  }, [address]);

  async function connectAndLoad() {
    if (await ensureSession()) await loadWorkspace();
  }

  async function claimMaker(makerId: number) {
    if (!supabase || !(await ensureSession())) return;
    setActionBusy(true);
    const { error: claimError } = await supabase.rpc("claim_demo_maker", {
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
    if (!supabase) return;
    setBusyOrderId(item.id);
    setActionBusy(true);
    setError("");
    const { error: actionError } = await supabase.rpc("transition_quote_request", {
      p_request_id: item.id,
      p_action: action,
      p_reason: reason,
      p_request_key: crypto.randomUUID(),
    });
    setActionBusy(false);
    setBusyOrderId(undefined);
    setPendingAction(undefined);
    if (actionError) {
      setError("This request changed before your action completed. Refresh and try again.");
      return;
    }
    await loadWorkspace();
    if (action === "accept") setSellerTab("active");
  }

  async function transitionRequestOnchain(item: CommerceItem, action: "accept" | "reject") {
    if (!isSingleDemoSeller(address)) {
      setError("Switch to the Lò Mây seller wallet to sign this request decision.");
      return;
    }
    setBusyOrderId(item.id);
    setActionBusy(true);
    actionBusyRef.current = true;
    setError("");
    setActionStatus("");
    try {
      const requestIdHash = keccak256(toBytes(item.id));
      const decisionHash = keccak256(toBytes([
        "loomon-quote-decision",
        item.id,
        item.reference,
        action,
      ].join(":")));
      setActionStatus(action === "accept" ? "Confirm seller accept in your wallet..." : "Confirm seller reject in your wallet...");
      const transactionHash = await writeContractAsync({
        address: LOOMON_QUOTE_DECISION_ADDRESS,
        abi: loomonQuoteDecisionAbi,
        functionName: "decide",
        args: [requestIdHash, quoteDecisionCode[action], decisionHash],
        chainId: ARC_TESTNET.id,
      });
      setActionStatus("Confirming the seller decision on Arc...");
      const requestKey = crypto.randomUUID();
      const response = await fetch(`/api/quote-requests/${item.id}/decision/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, requestKey, transactionHash }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Quote decision could not be confirmed");
      }
      if (action === "accept") setSellerTab("active");
      if (action === "reject") setSellerTab("history");
      setActionStatus(action === "accept" ? "Accepted on Arc. Loading active work..." : "Rejected on Arc. Moving to history...");
      setWorkspace((current) => ({
        ...current,
        sellingRequests: current.sellingRequests.filter((request) => request.id !== item.id),
      }));
      await loadWorkspace({ silent: true });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Arc quote decision failed";
      setError(/user rejected|user denied|rejected the request/i.test(message)
        ? "Transaction was cancelled in your wallet."
        : /request limit reached|rate limit|too many requests|32011/i.test(message)
          ? "Arc RPC is rate-limited for a moment. Wait a few seconds and try again."
        : message);
    } finally {
      actionBusyRef.current = false;
      setActionBusy(false);
      setBusyOrderId(undefined);
      window.setTimeout(() => setActionStatus(""), 3500);
    }
  }

  async function transitionOrder(
    item: CommerceItem,
    action: "mark_delivered" | "confirm_received" | "report_issue" | "cancel",
    reason = "",
  ) {
    if (!supabase) return;
    setBusyOrderId(item.id);
    setActionBusy(true);
    setError("");
    const { data, error: actionError } = await supabase.rpc("transition_demo_order", {
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
    setBusyOrderId(undefined);
    setPendingAction(undefined);
    if (actionError) {
      setError("This order changed before your action completed. Refresh and try again.");
      return;
    }
    if (data) await loadWorkspace();
  }

  async function loadEscrowContext(item: CommerceItem): Promise<EscrowOrderContext | null> {
    if (!supabase || item.kind !== "order") return null;
    if (isSingleDemoSeller(address)) {
      const response = await fetch(
        `/api/orders/demo-seller-escrow?address=${encodeURIComponent(address ?? "")}&orderId=${encodeURIComponent(item.id)}`,
      );
      if (!response.ok) return null;
      return escrowOrderContextSchema.parse(await response.json());
    }
    if (address) {
      const response = await fetch(
        `/api/orders/wallet-escrow?address=${encodeURIComponent(address)}&orderId=${encodeURIComponent(item.id)}`,
      );
      if (response.ok) return escrowOrderContextSchema.parse(await response.json());
    }
    const { data, error: escrowError } = await supabase.rpc("get_order_escrow_context", {
      p_order_id: item.id,
    });
    if (escrowError || !data) return null;
    return escrowOrderContextSchema.parse(data);
  }

  async function transitionEscrowOrder(
    item: CommerceItem,
    action: Extract<EscrowAction, "start_production" | "mark_delivered" | "confirm_completion" | "cancel" | "refund">,
  ) {
    if (actionBusyRef.current) return;
    if (!address) {
      setError("Connect your Arc wallet before signing this order action.");
      return;
    }
    setBusyOrderId(item.id);
    setActionBusy(true);
    actionBusyRef.current = true;
    setError("");
    setActionStatus("");
    try {
      const escrow = await loadEscrowContext(item);
      if (!escrow) throw new Error("This order has no Arc escrow context yet.");
      const orderId = escrow.onchainOrderId as `0x${string}`;
      const reasonHash = keccak256(toBytes(`${action}:${item.id}:${item.reference}`));
      let transactionHash: `0x${string}`;

      if (action === "start_production") {
        const chainState = await readEscrowState(escrow);
        if (chainState === 2) {
          setActionStatus("Seller already accepted on Arc. Syncing LOOMON...");
          await loadWorkspace({ silent: true });
          return;
        }
        if (chainState !== null && chainState !== 1) {
          throw new Error(`This order cannot be accepted on Arc right now. Current onchain state: ${chainState}.`);
        }
        setActionStatus("Confirm seller accept in your wallet...");
        transactionHash = await writeContractAsync({
          address: getAddress(escrow.poolAddress),
          abi: loomonEscrowPoolAbi,
          functionName: "startProduction",
          args: [orderId],
          chainId: ARC_TESTNET.id,
        });
      } else if (action === "mark_delivered") {
        const chainState = await readEscrowState(escrow);
        if (chainState === 3) {
          throw new Error("This order is already delivered on Arc. Refreshing the database view will restore it.");
        }
        if (chainState !== null && chainState !== 2) {
          throw new Error(`This order is not deliverable on Arc right now. Current onchain state: ${chainState}.`);
        }
        setActionStatus("Confirm delivered in your wallet...");
        transactionHash = await writeContractAsync({
          address: getAddress(escrow.poolAddress),
          abi: loomonEscrowPoolAbi,
          functionName: "markDelivered",
          args: [orderId, reasonHash],
          chainId: ARC_TESTNET.id,
        });
      } else if (action === "confirm_completion") {
        setActionStatus("Confirm received and mint your proof NFT...");
        transactionHash = await writeContractAsync({
          address: getAddress(escrow.poolAddress),
          abi: loomonEscrowPoolAbi,
          functionName: "confirmCompletion",
          args: [orderId, reasonHash],
          chainId: ARC_TESTNET.id,
        });
      } else if (action === "cancel") {
        setActionStatus("Confirm refund cancellation in your wallet...");
        transactionHash = await writeContractAsync({
          address: getAddress(escrow.poolAddress),
          abi: loomonEscrowPoolAbi,
          functionName: "cancelBeforeProduction",
          args: [orderId, reasonHash],
          chainId: ARC_TESTNET.id,
        });
      } else {
        setActionStatus("Confirm buyer refund in your wallet...");
        transactionHash = await writeContractAsync({
          address: getAddress(escrow.poolAddress),
          abi: loomonEscrowPoolAbi,
          functionName: "refundBuyer",
          args: [orderId, reasonHash],
          chainId: ARC_TESTNET.id,
        });
      }

      setActionStatus(
        action === "mark_delivered"
          ? "Confirming delivery on Arc..."
          : action === "confirm_completion"
            ? "Minting proof NFT and moving this order to history..."
            : action === "start_production"
              ? "Seller accepted. Moving order to active..."
              : "Confirming refund on Arc...",
      );
      const response = await fetch(`/api/orders/${item.id}/escrow/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, transactionHash, walletAddress: address }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Escrow action could not be confirmed");
      }
      if (body?.orderId && body.orderId !== item.id) {
        throw new Error("Escrow confirmation returned a different order. Refresh before trying again.");
      }

      if (action === "mark_delivered") {
        setSellerTab("history");
        setActionStatus("Delivered on Arc. Waiting for buyer to mint the proof NFT.");
      }
      if (action === "start_production") {
        setSellerTab("active");
        setActionStatus("Accepted on Arc. Order is now active.");
      }
      if (action === "confirm_completion") {
        setBuyerTab("history");
        setActionStatus("Proof NFT minted. Order moved to history.");
      }
      if (action === "cancel" || action === "refund") {
        if (mode === "buyer") setBuyerTab("history");
        else setSellerTab("history");
      }
      setWorkspace((current) => applyEscrowActionToWorkspace(current, item.id, action));
      await loadWorkspace({ silent: true });
    } catch (cause) {
      setActionStatus("");
      const message = cause instanceof Error ? cause.message : "The Arc order action failed.";
      setError(/user rejected|user denied|rejected the request/i.test(message)
        ? "Transaction was cancelled in your wallet."
        : /request limit reached|rate limit|too many requests|32011/i.test(message)
          ? "Arc RPC is rate-limited for a moment. Wait a few seconds and try again."
          : message);
    } finally {
      actionBusyRef.current = false;
      setActionBusy(false);
      setBusyOrderId(undefined);
      window.setTimeout(() => setActionStatus(""), 4500);
    }
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
        <div className="orders-heading-actions">
          {connectedAddressLabel ? <span className="orders-wallet-pill">{connectedAddressLabel}</span> : null}
          <button className="ghost-button" type="button" disabled={loading || sessionBusy} onClick={() => void loadWorkspace()}>
            <Clock3 size={16} /> {loading || sessionBusy ? "Syncing" : "Refresh"}
          </button>
        </div>
      </header>

      {error || sessionError ? <p className="form-error" role="alert">{error || sessionError}</p> : null}
      <nav className="orders-mode-switch" aria-label="Order workspace">
        <button className={mode === "buyer" ? "active" : ""} aria-pressed={mode === "buyer"} onClick={() => setMode("buyer")} type="button"><ShoppingBag size={19} /><span><strong>Buying</strong><small>{buying.length} total</small></span></button>
        <button className={mode === "seller" ? "active" : ""} aria-pressed={mode === "seller"} onClick={() => setMode("seller")} type="button"><Store size={19} /><span><strong>Selling</strong><small>{selling.length} total</small></span></button>
      </nav>

      {!isAuthenticated && !isConnected ? (
        <OrderStageEmpty
          index="01"
          title="Connect your wallet to view orders."
          detail="Your Buying and Selling activity is private to your LOOMON wallet."
          action={<button className="gradient-stroke-button" type="button" onClick={() => void connectAndLoad()} disabled={sessionBusy}>Connect wallet</button>}
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
              compact={buyerTab === "history"}
              proofsByOrderId={proofsByOrderId}
              orderAssetsById={orderAssetsById}
              busy={actionBusy}
              busyOrderId={busyOrderId}
            onRequestAction={(item, action) => {
              if (action === "withdraw") setPendingAction({ item, action });
            }}
            onOrderAction={(item, action) => {
              if (action === "cancel" || action === "confirm_completion") void transitionEscrowOrder(item, action);
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
              compact={sellerTab === "history"}
              proofsByOrderId={proofsByOrderId}
              orderAssetsById={orderAssetsById}
              busy={actionBusy}
              busyOrderId={busyOrderId}
              onRequestAction={(item, action) => {
                if (action === "accept" || action === "reject") void transitionRequestOnchain(item, action);
                else setPendingAction({ item, action });
              }}
              onOrderAction={(item, action) => {
                if (action === "start_production" || action === "mark_delivered" || action === "refund") {
                  void transitionEscrowOrder(item, action);
                }
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
  compact,
  proofsByOrderId,
  orderAssetsById,
  busy,
  busyOrderId,
  onRequestAction,
  onOrderAction,
}: {
  items: CommerceItem[];
  mode: OrderMode;
  compact?: boolean;
  proofsByOrderId: Record<string, OrderProofRecord>;
  orderAssetsById: Record<string, OrderAssetPreview>;
  busy: boolean;
  busyOrderId?: string;
  onRequestAction: (item: CommerceItem, action: "accept" | "reject" | "request_changes" | "withdraw") => void;
  onOrderAction: (item: CommerceItem, action: "start_production" | "mark_delivered" | "confirm_completion" | "cancel" | "refund") => void;
}) {
  const { openAgent } = useAgent();
  if (!items.length) {
    return <OrderStageEmpty index="—" title="Nothing here yet." detail={mode === "buyer" ? "Your next buyer action will appear here." : "New seller activity will appear here."} />;
  }

  return <section className="active-orders orders-real-list">
    <div className="orders-section-title"><h2>{mode === "buyer" ? "Your purchases" : "Your shop"}</h2><span>{items.length}</span></div>
    {compact
      ? <div className="orders-history-list">{items.map((item) => <HistoryRow key={`${item.kind}-${item.id}`} item={item} mode={mode} proof={proofsByOrderId[item.id]} />)}</div>
      : items.map((item) => <CommerceRow
        key={`${item.kind}-${item.id}`}
        item={item}
        mode={mode}
        asset={orderAssetsById[item.id]}
        busy={busy}
        busyOrderId={busyOrderId}
        onRequestAction={onRequestAction}
        onOrderAction={onOrderAction}
        onOpenMessage={() => openAgent({
          contextLabel: `${item.reference} · ${cleanProductTitle(item)}`,
          orderChat: {
            orderId: item.id,
            orderReference: item.reference,
            productTitle: cleanProductTitle(item),
            counterpartyName: mode === "buyer" ? item.makerName : item.buyerName ?? "Buyer",
          },
        })}
      />)}
  </section>;
}

function CommerceRow({
  item,
  mode,
  asset,
  busy,
  busyOrderId,
  onRequestAction,
  onOrderAction,
  onOpenMessage,
}: {
  item: CommerceItem;
  mode: OrderMode;
  asset?: OrderAssetPreview;
  busy: boolean;
  busyOrderId?: string;
  onRequestAction: (item: CommerceItem, action: "accept" | "reject" | "request_changes" | "withdraw") => void;
  onOrderAction: (item: CommerceItem, action: "start_production" | "mark_delivered" | "confirm_completion" | "cancel" | "refund") => void;
  onOpenMessage: () => void;
}) {
  const router = useRouter();
  const product = getProductBySlug(item.productSlug) ?? products[0];
  const productTitle = cleanProductTitle(item);
  const rowBusy = busy && busyOrderId === item.id;
  const siblingBusy = busy && Boolean(busyOrderId) && busyOrderId !== item.id;
  function openDetail() {
    if (item.kind === "order") router.push(`/app/orders/${encodeURIComponent(item.id)}`);
  }
  return <article
    className="order-feature-row seller-request-row order-real-row"
    onClick={openDetail}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetail();
      }
    }}
    role={item.kind === "order" ? "link" : undefined}
    tabIndex={item.kind === "order" ? 0 : undefined}
  >
    {asset?.url ? <div className="order-custom-visual"><Image src={asset.url} alt={asset.label} width={520} height={520} unoptimized /></div> : <ProductVisual product={product} />}
    <div className="order-feature-copy">
      <span className="order-stage"><i /> {statusLabel(item.status)}</span>
      <h3>{productTitle}</h3>
      <p>{mode === "buyer" ? item.makerName : item.buyerName ?? "Buyer"}</p>
      <dl>
        <div><dt>{item.kind === "order" ? "Order" : "Request"}</dt><dd>{item.reference}</dd></div>
        <div><dt>Quantity</dt><dd>{item.quantity}</dd></div>
        <div><dt>Needed by</dt><dd>{item.requiredBy ?? "Flexible"}</dd></div>
      </dl>
    </div>
    <div className="order-row-actions" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      {item.kind === "request" && mode === "buyer" && ["submitted", "seller_review", "changes_requested"].includes(item.status) ? <button type="button" onClick={() => onRequestAction(item, "withdraw")} disabled={rowBusy || siblingBusy}>Withdraw</button> : null}
      {item.kind === "request" && mode === "seller" && ["submitted", "seller_review", "changes_requested"].includes(item.status) ? <>
        <button className="gradient-stroke-button" type="button" onClick={() => onRequestAction(item, "accept")} disabled={rowBusy || siblingBusy}>{rowBusy ? "Accepting..." : "Accept"}</button>
        <button type="button" onClick={() => onRequestAction(item, "reject")} disabled={rowBusy || siblingBusy}>{rowBusy ? "Rejecting..." : "Reject"}</button>
      </> : null}
      {item.kind === "order" && mode === "seller" && item.status === "escrow_funded" ? <>
        <button className="gradient-stroke-button" type="button" onClick={() => onOrderAction(item, "start_production")} disabled={rowBusy || siblingBusy}>{rowBusy ? "Accepting..." : "Accept"}</button>
        <button type="button" onClick={() => onOrderAction(item, "refund")} disabled={rowBusy || siblingBusy}>{rowBusy ? "Working..." : "Reject + refund"}</button>
      </> : null}
      {item.kind === "order" && mode === "seller" && item.status === "in_production" ? <button className="gradient-stroke-button" type="button" onClick={() => onOrderAction(item, "mark_delivered")} disabled={rowBusy || siblingBusy}><PackageCheck size={16} /> {rowBusy ? "Marking..." : "Mark delivered"}</button> : null}
      {item.kind === "order" && mode === "seller" && item.status === "in_production" ? <button type="button" onClick={() => onOrderAction(item, "refund")} disabled={rowBusy || siblingBusy}>{rowBusy ? "Working..." : "Cancel/refund"}</button> : null}
      {item.kind === "order" && mode === "buyer" && item.status === "seller_marked_delivered" ? <button className="gradient-stroke-button" type="button" onClick={() => onOrderAction(item, "confirm_completion")} disabled={rowBusy || siblingBusy}><Check size={16} /> {rowBusy ? "Minting..." : "Mint NFT"}</button> : null}
      {item.kind === "order" && mode === "buyer" && item.status === "escrow_funded" ? <button type="button" onClick={() => onOrderAction(item, "cancel")} disabled={rowBusy || siblingBusy}>{rowBusy ? "Cancelling..." : "Cancel + refund"}</button> : null}
      {siblingBusy ? <span className="orders-wallet-pill">Another order is signing</span> : null}
      {item.kind === "order" && ["seller_accepted", "in_progress"].includes(item.status) ? <span className="orders-wallet-pill">Legacy · no escrow</span> : null}
      {item.kind === "order" ? <button className="order-message-button" type="button" onClick={onOpenMessage}><MessageCircle size={16} /> Message</button> : null}
    </div>
  </article>;
}

function HistoryRow({ item, mode, proof }: { item: CommerceItem; mode: OrderMode; proof?: OrderProofRecord }) {
  const explorerUrl = buildOrderProofExplorerUrl(proof?.mintTransactionHash ?? item.proofTransactionHash ?? null);
  const success = ["proof_minted", "released", "release_hold"].includes(item.status);
  const tokenId = proof?.tokenId ?? (item.proofTokenId ? String(item.proofTokenId) : null);
  const proofLabel =
    item.status === "seller_marked_delivered"
      ? "Proof ready for buyer"
      : ["buyer_confirmed_received", "proof_pending"].includes(item.status)
        ? "Indexing proof mint"
        : proof?.mintStatus === "confirmed"
          ? "Proof minted"
          : proof?.mintStatus === "failed"
            ? "Proof mint failed"
            : "No proof NFT";
  return <article className="orders-history-row">
    <span className={success ? "orders-history-dot orders-history-dot--success" : "orders-history-dot"} />
    <div>
      <strong>{item.reference}</strong>
      <span>{statusLabel(item.status)}</span>
    </div>
    <p>{cleanProductTitle(item)}</p>
    <small>{mode === "buyer" ? item.makerName : item.buyerName ?? "Buyer"} · Qty {item.quantity}</small>
    {explorerUrl ? <a href={explorerUrl} target="_blank" rel="noreferrer">Proof mint tx {tokenId ? `#${tokenId}` : ""} <ExternalLink size={13} /></a> : <em>{proofLabel}</em>}
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
