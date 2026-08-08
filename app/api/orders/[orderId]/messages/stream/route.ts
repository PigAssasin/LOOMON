import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertOrderChatAccess,
  getOrderChatCursor,
  getOrderChatThreadId,
} from "@/src/server/commerce/order-chat-access";
import { requireWalletSession } from "@/src/server/auth/wallet-session";

const querySchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

function encodeEvent(event: string, data: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  if (!z.uuid().safeParse(orderId).success) {
    return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  }

  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!query.success) {
    return NextResponse.json({ error: "Wallet address required." }, { status: 400 });
  }
  if (!(await requireWalletSession(query.data.address))) {
    return NextResponse.json({ error: "Wallet sign-in required." }, { status: 401 });
  }
  const access = await assertOrderChatAccess(orderId, query.data.address);
  if (!access) return NextResponse.json({ error: "Order access required." }, { status: 403 });

  const threadId = await getOrderChatThreadId(orderId);
  const encoder = new TextEncoder();
  let closed = false;
  request.signal.addEventListener("abort", () => {
    closed = true;
  });

  const stream = new ReadableStream({
    async start(controller) {
      let lastCursor = await getOrderChatCursor(threadId);
      controller.enqueue(encoder.encode(encodeEvent("ready", { cursor: lastCursor, threadId })));

      while (!closed) {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        if (closed) break;
        try {
          const cursor = await getOrderChatCursor(threadId);
          if (cursor !== lastCursor) {
            lastCursor = cursor;
            controller.enqueue(encoder.encode(encodeEvent("changed", { cursor, threadId })));
          } else {
            controller.enqueue(encoder.encode(encodeEvent("ping", { at: Date.now() })));
          }
        } catch {
          controller.enqueue(encoder.encode(encodeEvent("error", { message: "Order chat stream lost sync." })));
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
    },
  });
}
