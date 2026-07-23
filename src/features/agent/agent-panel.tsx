"use client";

import Link from "next/link";
import { History, MessageSquarePlus, PackageCheck, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/src/domain/product";
import type { AgentPageContext } from "@/src/features/agent/agent-provider";
import { products } from "@/src/data/products";
import { formatMoney } from "@/src/lib/money";
import { recommendProducts } from "@/src/lib/recommend-products";

type ChatAction = "orders" | "profile";
type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  action?: ChatAction;
  productSlugs?: string[];
  context?: string;
};
type ChatThread = { id: string; title: string; createdAt: number; updatedAt: number; messages: ChatMessage[] };

const THREADS_KEY = "loomon-agent-threads-v1";
const ACTIVE_THREAD_KEY = "loomon-agent-active-thread-v1";

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createThread(context: AgentPageContext): ChatThread {
  const now = Date.now();
  return {
    id: id("thread"),
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
    messages: [{
      id: id("message"),
      role: "assistant",
      text: `Hi — I’m your personal LOOMON agent. I can help with products, orders, payments and profile details. You’re currently on ${context.label}, so I’ll use that context automatically.`,
      context: context.label,
    }],
  };
}

function replyTo(input: string, context: AgentPageContext): Omit<ChatMessage, "id" | "role"> {
  const normalized = input.toLowerCase();
  const isVietnamese = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]|\b(tôi|mình|đơn|hàng|giúp|tìm|thanh toán)\b/i.test(input);
  const here = context.detail ? `${context.label} (${context.detail})` : context.label;

  if (/find|search|recommend|compare|gift|product|tìm|gợi ý|so sánh|quà|sản phẩm/.test(normalized)) {
    const matches = recommendProducts(products, input, 3);
    return {
      text: isVietnamese
        ? `Mình đã tìm trong catalog và ưu tiên lựa chọn phù hợp với yêu cầu của bạn. Mở sản phẩm để xem chi tiết; phần tải ảnh và tạo mẫu sẽ bắt đầu tại “Customize with agent”.`
        : `I found the closest catalog matches. Open a product to review it; image upload and preview creation begin only from “Customize with agent”.`,
      productSlugs: matches.map((product) => product.slug),
    };
  }
  if (/order|đơn|delivery|shipping|status|payment|pay|thanh toán|giao hàng/.test(normalized)) {
    return {
      text: isVietnamese
        ? `Mình đang dùng ngữ cảnh ${here}. Bạn có thể mở Orders để xem mốc tiếp theo, khoản thanh toán và việc đang chờ buyer hoặc seller xử lý.`
        : `I’m using the context from ${here}. Open Orders to review the next milestone, payment and whether the buyer or seller needs to act.`,
      action: "orders",
    };
  }
  if (/profile|email|address|wallet|địa chỉ|hồ sơ|ví|thông báo/.test(normalized)) {
    return {
      text: isVietnamese
        ? "Mình có thể hỗ trợ kiểm tra hồ sơ, địa chỉ giao hàng, email nhắc đơn và ví đang kết nối. Mọi thay đổi quan trọng vẫn cần bạn xem lại trước khi lưu."
        : "I can help review your profile, delivery address, order-reminder email and connected wallet. You’ll still review important changes before they are saved.",
      action: "profile",
    };
  }
  return {
    text: isVietnamese
      ? `Mình đã hiểu. Hiện bạn đang ở ${here}; mình sẽ dùng ngữ cảnh này xuyên suốt. Bạn muốn mình tìm thông tin, kiểm tra đơn hàng hay hỗ trợ hồ sơ?`
      : `Understood. You’re currently on ${here}, and I’ll keep that context throughout this conversation. Should I find information, check an order or help with your profile?`,
  };
}

export function AgentPanel({
  open,
  onClose,
  initialProduct,
  initialGoal,
  contextLabel,
  requestId,
  pageContext,
}: {
  open: boolean;
  onClose: () => void;
  initialProduct?: Product;
  initialGoal?: string;
  contextLabel?: string;
  requestId?: number;
  pageContext: AgentPageContext;
}) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [typing, setTyping] = useState(false);
  const processedRequest = useRef<number | undefined>(undefined);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const effectiveContext = useMemo<AgentPageContext>(() => ({
    ...pageContext,
    label: contextLabel ?? pageContext.label,
    detail: initialProduct ? `${initialProduct.category} · ${initialProduct.makerName} · from ${initialProduct.priceFrom} USDC` : pageContext.detail,
  }), [contextLabel, initialProduct, pageContext]);

  const activeThread = threads.find((thread) => thread.id === activeId) ?? threads[0];

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = JSON.parse(localStorage.getItem(THREADS_KEY) ?? "[]") as ChatThread[];
        const next = stored.length ? stored : [createThread(pageContext)];
        const storedActive = localStorage.getItem(ACTIVE_THREAD_KEY);
        setThreads(next);
        setActiveId(next.some((thread) => thread.id === storedActive) ? storedActive! : next[0].id);
      } catch {
        const next = createThread(pageContext);
        setThreads([next]);
        setActiveId(next.id);
      }
      setHydrated(true);
    });
    // Conversation storage is hydrated once; route context updates independently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated || !threads.length) return;
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
    localStorage.setItem(ACTIVE_THREAD_KEY, activeId);
  }, [activeId, hydrated, threads]);

  useEffect(() => {
    if (!hydrated || !requestId || processedRequest.current === requestId) return;
    processedRequest.current = requestId;
    const prompt = initialGoal ?? (initialProduct ? `Help me understand ${initialProduct.title} before I customize it.` : "");
    if (prompt) sendMessage(prompt);
    // sendMessage intentionally uses the newest route context for contextual entry points.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, requestId]);

  useEffect(() => {
    if (open) chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [activeThread?.messages, open, typing]);

  function updateThread(threadId: string, updater: (thread: ChatThread) => ChatThread) {
    setThreads((current) => current.map((thread) => thread.id === threadId ? updater(thread) : thread));
  }

  function sendMessage(value = chatInput) {
    const clean = value.trim();
    if (!clean || typing || !activeThread) return;
    const targetThreadId = activeThread.id;
    const userMessage: ChatMessage = { id: id("user"), role: "user", text: clean, context: effectiveContext.label };
    const now = Date.now();
    updateThread(targetThreadId, (thread) => ({
      ...thread,
      title: thread.messages.filter((message) => message.role === "user").length === 0 ? clean.slice(0, 42) : thread.title,
      updatedAt: now,
      messages: [...thread.messages, userMessage],
    }));
    setChatInput("");
    setTyping(true);
    window.setTimeout(() => {
      const reply = replyTo(clean, effectiveContext);
      updateThread(targetThreadId, (thread) => ({ ...thread, updatedAt: Date.now(), messages: [...thread.messages, { id: id("assistant"), role: "assistant", ...reply, context: effectiveContext.label }] }));
      setTyping(false);
    }, 520);
  }

  function startNewChat() {
    const next = createThread(effectiveContext);
    setThreads((current) => [next, ...current]);
    setActiveId(next.id);
    setHistoryOpen(false);
    setChatInput("");
  }

  if (!open || !activeThread) return null;

  return (
    <div className="agent-layer" role="dialog" aria-modal="true" aria-label="LOOMON personal agent">
      <button className="agent-scrim" onClick={onClose} aria-label="Close agent" />
      <aside className="agent-panel agent-panel--chat-only">
        <header className="agent-header">
          <div className="agent-title"><span className="agent-spark"><Sparkles size={17} /></span><div><strong>Personal agent</strong><small>Products, orders, profile and payment</small></div></div>
          <div className="agent-header-actions"><button className="icon-button" onClick={() => setHistoryOpen((value) => !value)} type="button" aria-label="Conversation history"><History size={20} /></button><button className="icon-button" onClick={startNewChat} type="button" aria-label="New conversation"><MessageSquarePlus size={20} /></button><button className="icon-button" onClick={onClose} type="button" aria-label="Close agent"><X size={22} /></button></div>
        </header>

        <div className="assistant-chat">
          <div className="assistant-chat-context"><span><i /> Context: {effectiveContext.label}</span><small>{effectiveContext.kind}</small></div>

          {historyOpen ? <section className="agent-history" aria-label="Previous conversations">
            <header><div><strong>Conversations</strong><small>Saved on this device</small></div><button type="button" onClick={startNewChat}><MessageSquarePlus size={16} /> New chat</button></header>
            <div>{threads.toSorted((a, b) => b.updatedAt - a.updatedAt).map((thread) => <button className={thread.id === activeId ? "active" : ""} type="button" key={thread.id} onClick={() => { setActiveId(thread.id); setHistoryOpen(false); }}><MessageSquarePlus size={16} /><span><strong>{thread.title}</strong><small>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(thread.updatedAt)}</small></span></button>)}</div>
          </section> : null}

          <div className="assistant-chat-thread" aria-live="polite">
            {activeThread.messages.map((message) => <div className={`chat-message chat-message--${message.role}`} key={message.id}>
              {message.role === "assistant" ? <span className="chat-avatar"><Sparkles size={14} /></span> : null}
              <div><p>{message.text}</p>{message.context ? <small className="chat-message-context">From {message.context}</small> : null}{message.productSlugs?.length ? <div className="chat-product-results">{message.productSlugs.map((slug) => { const product = products.find((item) => item.slug === slug); return product ? <Link href={`/app/products/${product.slug}`} onClick={onClose} key={product.slug}><span className={`result-dot accent-bg-${product.accent}`} /><span><strong>{product.title}</strong><small>{product.makerName} · MOQ {product.minimumOrderQuantity}</small></span><em>{formatMoney(product.priceFrom)}</em></Link> : null; })}</div> : null}{message.action === "orders" ? <Link className="chat-action-link" href="/app/orders" onClick={onClose}><PackageCheck size={15} /> Open Orders</Link> : null}{message.action === "profile" ? <Link className="chat-action-link" href="/app/profile" onClick={onClose}>Open Profile</Link> : null}</div>
            </div>)}
            {typing ? <div className="chat-message chat-message--assistant"><span className="chat-avatar"><Sparkles size={14} /></span><div className="chat-typing" aria-label="Agent is typing"><i /><i /><i /></div></div> : null}
            <div ref={chatEndRef} />
          </div>

          {activeThread.messages.length < 3 ? <div className="assistant-suggestions" aria-label="Suggested messages"><button type="button" onClick={() => sendMessage("Find a meaningful gift under 100 USDC.")}>Find a product</button><button type="button" onClick={() => sendMessage("Check my active order and next action.")}>Check my order</button><button type="button" onClick={() => sendMessage("Help me review my profile and delivery details.")}>Review profile</button></div> : null}
          <form className="assistant-chat-composer" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
            <textarea aria-label="Message your personal agent" placeholder={`Ask about ${effectiveContext.label}…`} rows={2} value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} />
            <div><span><ShieldCheck size={14} /> Context follows you across LOOMON</span><button type="submit" disabled={!chatInput.trim() || typing} aria-label="Send message"><Send size={18} /></button></div>
          </form>
        </div>
      </aside>
    </div>
  );
}
