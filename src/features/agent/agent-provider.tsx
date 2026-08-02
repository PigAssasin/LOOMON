"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { Product } from "@/src/domain/product";
import { AgentPanel } from "@/src/features/agent/agent-panel";
import { products } from "@/src/data/products";
import { getStoreBySlug } from "@/src/data/stores";

type AgentRequest = {
  product?: Product;
  goal?: string;
  contextLabel?: string;
  orderChat?: {
    orderId: string;
    orderReference: string;
    productTitle: string;
    counterpartyName: string;
  };
};

export type AgentPageContext = {
  label: string;
  href: string;
  kind: "discovery" | "product" | "store" | "orders" | "order" | "profile" | "seller" | "page";
  detail?: string;
};

type AgentContextValue = {
  openAgent: (request?: AgentRequest) => void;
  closeAgent: () => void;
};

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<AgentRequest & { id?: number }>({});
  const pageContext = useMemo<AgentPageContext>(() => {
    const productSlug = pathname.match(/^\/app\/products\/([^/]+)/)?.[1];
    const product = products.find((item) => item.slug === productSlug);
    if (product) return { label: product.title, href: pathname, kind: "product", detail: `${product.category} · ${product.makerName} · from ${product.priceFrom} USDC` };
    const storeSlug = pathname.match(/^\/app\/stores\/([^/]+)/)?.[1];
    const store = storeSlug ? getStoreBySlug(storeSlug) : undefined;
    if (store) return { label: store.name, href: pathname, kind: "store", detail: `${store.province} · ${store.rating} rating` };
    const orderId = pathname.match(/^\/app\/orders\/([^/]+)/)?.[1];
    if (orderId) return { label: `Order ${orderId === "demo-order" ? "LM-26-07-000184" : orderId}`, href: pathname, kind: "order", detail: "Order detail, milestones and payment status" };
    if (pathname === "/app/orders") return { label: "Orders", href: pathname, kind: "orders", detail: "Buyer and seller order center" };
    if (pathname === "/app/profile") return { label: "Profile", href: pathname, kind: "profile", detail: "Identity, delivery details and followed stores" };
    if (pathname.startsWith("/app/seller")) return { label: "Seller workspace", href: pathname, kind: "seller", detail: "Product listing and seller operations" };
    if (pathname === "/app") return { label: "Discover", href: pathname, kind: "discovery", detail: "Vietnamese craft catalog and collections" };
    return { label: "LOOMON", href: pathname, kind: "page" };
  }, [pathname]);

  const value = useMemo<AgentContextValue>(() => ({
    openAgent(next = {}) {
      setRequest({ ...next, id: Date.now() });
      setOpen(true);
    },
    closeAgent() {
      setOpen(false);
    },
  }), []);

  return (
    <AgentContext.Provider value={value}>
      {children}
      <AgentPanel
        open={open}
        onClose={() => setOpen(false)}
        initialProduct={request.product}
        initialGoal={request.goal}
        contextLabel={request.contextLabel}
        orderChat={request.orderChat}
        requestId={request.id}
        pageContext={pageContext}
      />
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) throw new Error("useAgent must be used inside AgentProvider");
  return context;
}
