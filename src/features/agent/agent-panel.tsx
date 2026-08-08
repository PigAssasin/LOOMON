"use client";

import Image from "next/image";
import Link from "next/link";
import { History, MessageSquarePlus, PackageCheck, Send, ShieldCheck, SmilePlus, Sparkles, UploadCloud, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/src/domain/product";
import type { AgentPageContext } from "@/src/features/agent/agent-provider";
import { useLoomonSession } from "@/src/features/auth/use-loomon-session";
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
  source?: "gemini" | "local";
};
type ChatThread = { id: string; title: string; createdAt: number; updatedAt: number; messages: ChatMessage[] };
type AgentReply = Omit<ChatMessage, "id" | "role"> & { conversationId?: string };
type OrderChatRequest = {
  orderId: string;
  orderReference: string;
  productTitle: string;
  counterpartyName: string;
};
type OrderChatEntry = {
  id: string;
  senderType: string;
  body: string | null;
  kind: string;
  createdAt: string;
  attachments?: Array<{ id: string; label: string | null; type: string; url: string | null }>;
};
type OrderChatChannel = {
  send: (args: { type: "broadcast"; event: string; payload: Record<string, unknown> }) => Promise<unknown>;
};

const THREADS_KEY = "loomon-agent-threads-v2";
const ACTIVE_THREAD_KEY = "loomon-agent-active-thread-v2";

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createThread(context: AgentPageContext): ChatThread {
  const now = Date.now();
  return {
    id: id("thread"),
    title: "New LOOMON task",
    createdAt: now,
    updatedAt: now,
    messages: [{
      id: id("message"),
      role: "assistant",
      text: `Hi — I’m your LOOMON Personal Agent. I only help inside this app: product discovery, customization flow, orders, seller chat drafts, profile, wallet and payment prep. You’re on ${context.label}, so I’ll use that page as context.`,
      context: context.label,
      source: "local",
    }],
  };
}

function isVietnamese(input: string) {
  return /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]|\b(tôi|mình|đơn|hàng|giúp|tìm|thanh toán|sản phẩm|ví|hồ sơ)\b/i.test(input);
}

function localReplyTo(input: string, context: AgentPageContext): Omit<ChatMessage, "id" | "role"> {
  const normalized = input.toLowerCase();
  const vi = isVietnamese(input);
  const here = context.detail ? `${context.label} (${context.detail})` : context.label;

  if (/find|search|recommend|compare|gift|product|tìm|gợi ý|so sánh|quà|sản phẩm/.test(normalized)) {
    const matches = recommendProducts(products, input, 3);
    return {
      source: "local",
      text: vi
        ? "Mình đã lọc catalog LOOMON theo nhu cầu của bạn. Bạn là người chọn sản phẩm cuối cùng; sau đó mở sản phẩm và bấm “Customize with agent” để tải ảnh hoặc tạo preview."
        : "I filtered the LOOMON catalog for your request. You choose the final product; then open it and tap “Customize with agent” to upload artwork or create previews.",
      productSlugs: matches.map((product) => product.slug),
    };
  }

  if (/order|đơn|delivery|shipping|status|payment|pay|cancel|refund|thanh toán|giao hàng|huỷ|hủy/.test(normalized)) {
    return {
      source: "local",
      text: vi
        ? `Mình đang dùng ngữ cảnh ${here}. Mở Orders để xem tiến trình, deposit, seller request và bước cần xác nhận. Nếu muốn đặt hoặc huỷ đơn, hãy nói rõ sản phẩm/mã đơn để mình chuẩn bị hành động.`
        : `I’m using ${here} as context. Open Orders to review milestones, deposit, seller requests and required confirmations. If you want to place or cancel an order, give me the product or order reference so I can prepare the action.`,
      action: "orders",
    };
  }

  if (/profile|email|address|wallet|địa chỉ|hồ sơ|ví|follow|language|currency|tiền|ngôn ngữ/.test(normalized)) {
    return {
      source: "local",
      text: vi
        ? "Mình có thể hỗ trợ hồ sơ, địa chỉ, email nhắc đơn, ví và store đang follow. Các thay đổi quan trọng vẫn cần bạn xem lại trước khi lưu."
        : "I can help with your profile, address, reminder email, wallet and followed stores. Important changes still need your review before saving.",
      action: "profile",
    };
  }

  if (/image|upload|render|preview|logo|ảnh|tải ảnh|tạo ảnh|mockup|custom/.test(normalized)) {
    return {
      source: "local",
      text: vi
        ? "Phần tải ảnh không nằm trong personal chat này. Bạn hãy mở một sản phẩm cụ thể rồi bấm “Customize with agent”; Agent Render sẽ dùng ảnh sản phẩm gốc + ảnh bạn tải lên để tạo preview."
        : "Image upload does not happen in this personal chat. Open a product and tap “Customize with agent”; Agent Render will use the product image plus your uploaded artwork to create previews.",
    };
  }

  return {
    source: "local",
    text: vi
      ? `Mình là Personal Agent của LOOMON, hiện ở ngữ cảnh ${here}. Mình chỉ hỗ trợ các việc trong app: tìm sản phẩm, custom, order, ví/thanh toán, hồ sơ và draft chat với shop. Nếu câu hỏi đi quá xa app, mình sẽ kéo lại đúng luồng.`
      : `I’m LOOMON’s Personal Agent, currently using ${here} as context. I only help inside the app: product discovery, customization, orders, wallet/payment, profile and seller-message drafts. If a question drifts outside LOOMON, I’ll bring it back to the app flow.`,
  };
}

async function requestAgentReply(input: string, context: AgentPageContext, history: ChatMessage[], conversationId: string) {
  const response = await fetch("/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: input,
      context,
      conversationId,
      history: history.slice(-8).map((message) => ({ role: message.role, text: message.text })),
    }),
  });
  if (!response.ok) throw new Error("Agent chat request failed");
  return await response.json() as AgentReply;
}

export function AgentPanel({
  open,
  onClose,
  initialProduct,
  initialGoal,
  contextLabel,
  orderChat,
  requestId,
  pageContext,
}: {
  open: boolean;
  onClose: () => void;
  initialProduct?: Product;
  initialGoal?: string;
  contextLabel?: string;
  orderChat?: OrderChatRequest;
  requestId?: number;
  pageContext: AgentPageContext;
}) {
  const { address, supabase } = useLoomonSession();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [activeOrderChat, setActiveOrderChat] = useState<OrderChatRequest>();
  const [orderChatRole, setOrderChatRole] = useState<string>();
  const [orderMessages, setOrderMessages] = useState<OrderChatEntry[]>([]);
  const [orderMessageInput, setOrderMessageInput] = useState("");
  const [orderMessageImage, setOrderMessageImage] = useState<File>();
  const [orderChatLoading, setOrderChatLoading] = useState(false);
  const [orderChatError, setOrderChatError] = useState("");
  const [orderUnreadCount, setOrderUnreadCount] = useState(0);
  const [orderChatThreadId, setOrderChatThreadId] = useState("");
  const processedRequest = useRef<number | undefined>(undefined);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const orderChatChannelRef = useRef<OrderChatChannel | null>(null);
  const orderChatClientId = useRef(id("order-chat-client"));
  const orderChatCursorRef = useRef("");
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
      void fetch("/api/agent/conversations")
        .then(async (response) => response.ok ? await response.json() as { conversations?: ChatThread[] } : null)
        .then((payload) => {
          if (!payload?.conversations?.length) return;
          setThreads(payload.conversations);
          setActiveId((current) => payload.conversations?.some((thread) => thread.id === current)
            ? current
            : payload.conversations![0].id);
        })
        .catch(() => undefined);
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
    if (orderChat) {
      queueMicrotask(() => {
        setActiveOrderChat(orderChat);
        setHistoryOpen(false);
      });
      return;
    }
    const prompt = initialGoal ?? (initialProduct ? `Help me understand ${initialProduct.title} before I customize it.` : "");
    if (prompt) void sendMessage(prompt);
    // sendMessage intentionally uses the newest route context for contextual entry points.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, requestId, orderChat]);

  useEffect(() => {
    if (open) chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [activeThread?.messages, open, typing]);

  function updateThread(threadId: string, updater: (thread: ChatThread) => ChatThread) {
    setThreads((current) => current.map((thread) => thread.id === threadId ? updater(thread) : thread));
  }

  async function sendMessage(value = chatInput) {
    const clean = value.trim();
    if (!clean || typing || !activeThread) return;
    const targetThreadId = activeThread.id;
    const historyBeforeSend = activeThread.messages;
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

    try {
      const reply = await requestAgentReply(clean, effectiveContext, [...historyBeforeSend, userMessage], targetThreadId);
      const persistedId = reply.conversationId;
      setThreads((current) => current.map((thread) => thread.id === targetThreadId ? {
        ...thread,
        id: persistedId ?? thread.id,
        updatedAt: Date.now(),
        messages: [...thread.messages, { id: id("assistant"), role: "assistant", ...reply, context: effectiveContext.label }],
      } : thread));
      if (persistedId) setActiveId(persistedId);
    } catch {
      const reply = localReplyTo(clean, effectiveContext);
      updateThread(targetThreadId, (thread) => ({
        ...thread,
        updatedAt: Date.now(),
        messages: [...thread.messages, { id: id("assistant"), role: "assistant", ...reply, context: effectiveContext.label }],
      }));
    } finally {
      setTyping(false);
    }
  }

  function startNewChat() {
    const next = createThread(effectiveContext);
    setThreads((current) => [next, ...current]);
    setActiveId(next.id);
    setActiveOrderChat(undefined);
    setHistoryOpen(false);
    setChatInput("");
  }

  async function loadOrderChat(chat = activeOrderChat) {
    if (!chat || !address) return;
    setOrderChatLoading(true);
    setOrderChatError("");
    try {
      const response = await fetch(`/api/orders/${chat.orderId}/messages?address=${encodeURIComponent(address)}`);
      const payload = await response.json() as { role?: string; threadId?: string; messages?: OrderChatEntry[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Order chat could not be loaded.");
      const messages = payload.messages ?? [];
      setOrderChatRole(payload.role);
      setOrderChatThreadId(payload.threadId ?? "");
      setOrderMessages(messages);
      const newest = messages.at(-1);
      orderChatCursorRef.current = newest ? `${newest.createdAt}:${newest.id}` : "empty";
      const readKey = `loomon-order-chat-read-${chat.orderId}-${address.toLowerCase()}`;
      const lastRead = Number(localStorage.getItem(readKey) ?? 0);
      setOrderUnreadCount(messages.filter((message) =>
        message.senderType !== payload.role && new Date(message.createdAt).getTime() > lastRead,
      ).length);
      if (newest) localStorage.setItem(readKey, String(new Date(newest.createdAt).getTime()));
    } catch (cause) {
      setOrderChatError(cause instanceof Error ? cause.message : "Order chat could not be loaded.");
    } finally {
      setOrderChatLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !activeOrderChat) return;
    const initial = window.setTimeout(() => void loadOrderChat(activeOrderChat), 0);
    const interval = window.setInterval(() => void loadOrderChat(activeOrderChat), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrderChat?.orderId, address, open]);

  useEffect(() => {
    if (!open || !activeOrderChat || !supabase) return;
    const channel = supabase
      .channel(`loomon-order-chat-${activeOrderChat.orderId}`)
      .on("broadcast", { event: "message_sent" }, (event) => {
        if (event.payload?.senderClientId === orderChatClientId.current) return;
        void loadOrderChat(activeOrderChat);
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "messaging", table: "messages" },
        (event) => {
          if (orderChatThreadId && String(event.new?.thread_id ?? "") === orderChatThreadId) {
            void loadOrderChat(activeOrderChat);
          }
        },
      )
      .subscribe();
    orderChatChannelRef.current = channel as OrderChatChannel;
    return () => {
      if (orderChatChannelRef.current === channel) orderChatChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
    // loadOrderChat intentionally reads the latest wallet and state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrderChat?.orderId, open, orderChatThreadId, supabase]);

  useEffect(() => {
    if (!open || !activeOrderChat || !address) return;
    const source = new EventSource(
      `/api/orders/${activeOrderChat.orderId}/messages/stream?address=${encodeURIComponent(address)}`,
    );
    source.addEventListener("ready", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { cursor?: string };
      if (payload.cursor) orderChatCursorRef.current = payload.cursor;
    });
    source.addEventListener("changed", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { cursor?: string };
      if (payload.cursor && payload.cursor !== orderChatCursorRef.current) {
        orderChatCursorRef.current = payload.cursor;
        void loadOrderChat(activeOrderChat);
      }
    });
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
    // loadOrderChat intentionally reads the latest wallet and state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrderChat?.orderId, address, open]);

  async function sendOrderMessage() {
    if (!activeOrderChat || !address || (!orderMessageInput.trim() && !orderMessageImage)) return;
    setOrderChatLoading(true);
    setOrderChatError("");
    try {
      const form = new FormData();
      form.set("address", address);
      form.set("body", orderMessageInput.trim());
      if (orderMessageImage) form.set("image", orderMessageImage);
      const response = await fetch(`/api/orders/${activeOrderChat.orderId}/messages`, {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Message could not be sent.");
      setOrderMessageInput("");
      setOrderMessageImage(undefined);
      await loadOrderChat(activeOrderChat);
      await orderChatChannelRef.current?.send({
        type: "broadcast",
        event: "message_sent",
        payload: {
          orderId: activeOrderChat.orderId,
          senderAddress: address,
          senderClientId: orderChatClientId.current,
          sentAt: new Date().toISOString(),
        },
      });
    } catch (cause) {
      setOrderChatError(cause instanceof Error ? cause.message : "Message could not be sent.");
    } finally {
      setOrderChatLoading(false);
    }
  }

  if (!open || !activeThread) return null;

  return (
    <div className="agent-layer" role="dialog" aria-modal="true" aria-label="LOOMON personal agent">
      <button className="agent-scrim" onClick={onClose} aria-label="Close agent" />
      <aside className="agent-panel agent-panel--chat-only">
        <header className="agent-header">
          <div className="agent-title">
            <span className="agent-spark"><Sparkles size={17} /></span>
            <div>
              <strong>{activeOrderChat ? "Order conversation" : "LOOMON Agent"}</strong>
              <small>{activeOrderChat ? `${activeOrderChat.orderReference} · ${activeOrderChat.counterpartyName}` : "Products · orders · wallet · profile"}</small>
            </div>
          </div>
          <div className="agent-header-actions">
            <button className="icon-button agent-history-button" onClick={() => setHistoryOpen((value) => !value)} type="button" aria-label="Conversation history"><History size={20} />{orderUnreadCount ? <span>{orderUnreadCount}</span> : null}</button>
            <button className="icon-button" onClick={startNewChat} type="button" aria-label="New conversation"><MessageSquarePlus size={20} /></button>
            <button className="icon-button" onClick={onClose} type="button" aria-label="Close agent"><X size={22} /></button>
          </div>
        </header>

        <div className="assistant-chat">
          <div className="assistant-chat-context">
            <span><i /> Context: {effectiveContext.label}</span>
            <small>{effectiveContext.kind}</small>
          </div>

          {historyOpen ? <section className="agent-history" aria-label="Previous conversations">
            <header>
              <div><strong>Conversations</strong><small>Saved on this device</small></div>
              <button type="button" onClick={startNewChat}><MessageSquarePlus size={16} /> New chat</button>
            </header>
            <div>
              {activeOrderChat ? <button className="active" type="button" onClick={() => setHistoryOpen(false)}>
                <PackageCheck size={16} />
                <span><strong>{activeOrderChat.productTitle}</strong><small>{activeOrderChat.orderReference} · order chat</small></span>
              </button> : null}
              {threads.toSorted((a, b) => b.updatedAt - a.updatedAt).map((thread) => (
              <button className={!activeOrderChat && thread.id === activeId ? "active" : ""} type="button" key={thread.id} onClick={() => { setActiveId(thread.id); setActiveOrderChat(undefined); setHistoryOpen(false); }}>
                <MessageSquarePlus size={16} />
                <span><strong>{thread.title}</strong><small>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(thread.updatedAt)}</small></span>
              </button>
            ))}</div>
          </section> : null}

          {activeOrderChat ? <div className="assistant-chat-thread assistant-order-chat-thread" aria-live="polite">
            <div className="assistant-order-chat-card">
              <PackageCheck size={17} />
              <div>
                <strong>{activeOrderChat.productTitle}</strong>
                <small>{activeOrderChat.orderReference} · chat with {activeOrderChat.counterpartyName}</small>
              </div>
            </div>
            {orderChatError ? <p className="form-error" role="alert">{orderChatError}</p> : null}
            {orderMessages.length ? orderMessages.map((message) => (
              <div className={`chat-message chat-message--${message.senderType === orderChatRole ? "user" : "assistant"}`} key={message.id}>
                {message.senderType === orderChatRole ? null : <span className="chat-avatar"><PackageCheck size={14} /></span>}
                <div>
                  {message.attachments?.map((attachment) => attachment.url ? <Image className="chat-message-image" src={attachment.url} alt={attachment.label ?? "Message image"} width={260} height={180} unoptimized key={attachment.id} /> : null)}
                  <p>{message.body}</p>
                  <small className="chat-message-context">{message.senderType} · {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}</small>
                </div>
              </div>
            )) : <p className="order-chat-empty">No messages yet. Start with a quick production or delivery question.</p>}
            {orderChatLoading ? <div className="chat-message chat-message--assistant"><span className="chat-avatar"><PackageCheck size={14} /></span><div className="chat-typing" aria-label="Loading order chat"><i /><i /><i /></div></div> : null}
            <div ref={chatEndRef} />
          </div> : <div className="assistant-chat-thread" aria-live="polite">
            {activeThread.messages.map((message) => (
              <div className={`chat-message chat-message--${message.role}`} key={message.id}>
                {message.role === "assistant" ? <span className="chat-avatar"><Sparkles size={14} /></span> : null}
                <div>
                  <p>{message.text}</p>
                  {message.context ? <small className="chat-message-context">From {message.context}{message.source === "gemini" ? " · Gemini" : ""}</small> : null}
                  {message.productSlugs?.length ? <div className="chat-product-results">{message.productSlugs.map((slug) => {
                    const product = products.find((item) => item.slug === slug);
                    return product ? (
                      <Link href={`/app/products/${product.slug}`} onClick={onClose} key={product.slug}>
                        <span className={`result-dot accent-bg-${product.accent}`} />
                        <span><strong>{product.title}</strong><small>{product.makerName} · from 1 piece</small></span>
                        <em>{formatMoney(product.priceFrom)}</em>
                      </Link>
                    ) : null;
                  })}</div> : null}
                  {message.action === "orders" ? <Link className="chat-action-link" href="/app/orders" onClick={onClose}><PackageCheck size={15} /> Open Orders</Link> : null}
                  {message.action === "profile" ? <Link className="chat-action-link" href="/app/profile" onClick={onClose}>Open Profile</Link> : null}
                </div>
              </div>
            ))}
            {typing ? <div className="chat-message chat-message--assistant"><span className="chat-avatar"><Sparkles size={14} /></span><div className="chat-typing" aria-label="Agent is typing"><i /><i /><i /></div></div> : null}
            <div ref={chatEndRef} />
          </div>}

          {!activeOrderChat && activeThread.messages.length < 3 ? <div className="assistant-suggestions" aria-label="Suggested messages">
            <button type="button" onClick={() => void sendMessage("Find a meaningful Vietnamese craft gift under 100 USDC.")}>Find product</button>
            <button type="button" onClick={() => void sendMessage("Check my active order and tell me the next action.")}>Check order</button>
            <button type="button" onClick={() => void sendMessage("Draft a polite message asking the seller about lead time.")}>Draft seller message</button>
          </div> : null}
          {activeOrderChat ? <form className="assistant-chat-composer assistant-order-chat-composer" onSubmit={(event) => { event.preventDefault(); void sendOrderMessage(); }}>
            <div className="order-chat-emoji-row" aria-label="Quick emoji">{["👍", "🙏", "✅", "📦", "✨"].map((emoji) => <button type="button" key={emoji} onClick={() => setOrderMessageInput((current) => `${current}${current ? " " : ""}${emoji}`)}><SmilePlus size={14} /> {emoji}</button>)}</div>
            {orderMessageImage ? <div className="order-chat-image-chip"><span>{orderMessageImage.name}</span><button type="button" onClick={() => setOrderMessageImage(undefined)}><X size={14} /> Remove</button></div> : null}
            <textarea aria-label="Message buyer or seller" placeholder={`Message ${activeOrderChat.counterpartyName}…`} rows={2} value={orderMessageInput} onChange={(event) => setOrderMessageInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendOrderMessage(); } }} />
            <div><label className="order-chat-upload"><UploadCloud size={14} /> Image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setOrderMessageImage(event.target.files?.[0])} /></label><button type="submit" disabled={orderChatLoading || (!orderMessageInput.trim() && !orderMessageImage)} aria-label="Send order message"><Send size={18} /></button></div>
          </form> : <form className="assistant-chat-composer" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
            <textarea aria-label="Message your personal agent" placeholder={`Ask LOOMON Agent about ${effectiveContext.label}…`} rows={2} value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} />
            <div><span><ShieldCheck size={14} /> App-scoped agent · no silent seller messages</span><button type="submit" disabled={!chatInput.trim() || typing} aria-label="Send message"><Send size={18} /></button></div>
          </form>}
        </div>
      </aside>
    </div>
  );
}
