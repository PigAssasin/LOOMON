import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertOrderChatAccess,
  getOrderChatThreadId,
} from "@/src/server/commerce/order-chat-access";
import { requireWalletSession } from "@/src/server/auth/wallet-session";

const querySchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

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
  const { data: messages, error } = await access.admin
    .schema("messaging")
    .from("messages")
    .select("id, sender_type, message_kind, body, structured_body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Messages could not be loaded." }, { status: 500 });

  const messageIds = (messages ?? []).map((message: { id: unknown }) => String(message.id));
  const { data: attachments } = messageIds.length
    ? await access.admin
      .schema("messaging")
      .from("message_attachments")
      .select("id, message_id, storage_bucket, storage_path, attachment_type, label")
      .in("message_id", messageIds)
    : { data: [] };

  const attachmentsByMessage = new Map<string, Array<{ id: string; label: string | null; type: string; url: string | null }>>();
  for (const attachment of attachments ?? []) {
    const bucket = String(attachment.storage_bucket ?? "");
    const path = String(attachment.storage_path ?? "");
    let url: string | null = null;
    if (bucket && path) {
      const signed = await access.admin.storage.from(bucket).createSignedUrl(path, 60 * 10);
      url = signed.data?.signedUrl ?? null;
    }
    const key = String(attachment.message_id);
    const current = attachmentsByMessage.get(key) ?? [];
    current.push({
      id: String(attachment.id),
      label: attachment.label ? String(attachment.label) : null,
      type: String(attachment.attachment_type ?? "other"),
      url,
    });
    attachmentsByMessage.set(key, current);
  }

  return NextResponse.json({
    threadId,
    role: access.role,
    messages: (messages ?? []).map((message: {
      id: unknown;
      sender_type: unknown;
      body?: unknown;
      message_kind: unknown;
      structured_body?: unknown;
      created_at: unknown;
    }) => ({
      id: String(message.id),
      senderType: String(message.sender_type),
      body: message.body ? String(message.body) : null,
      kind: String(message.message_kind),
      structuredBody: message.structured_body ?? null,
      createdAt: String(message.created_at),
      attachments: attachmentsByMessage.get(String(message.id)) ?? [],
    })),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  if (!z.uuid().safeParse(orderId).success) {
    return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  }
  const form = await request.formData();
  const address = String(form.get("address") ?? "");
  const body = String(form.get("body") ?? "").trim().slice(0, 4_000);
  const file = form.get("image");
  const access = querySchema.safeParse({ address }).success
    && await requireWalletSession(address)
    ? await assertOrderChatAccess(orderId, address)
    : null;
  if (!access) return NextResponse.json({ error: "Order access required." }, { status: 403 });
  if (!body && !(file instanceof File)) {
    return NextResponse.json({ error: "Message or image required." }, { status: 400 });
  }
  if (file instanceof File && (!allowedImageTypes.has(file.type) || file.size > 5 * 1024 * 1024)) {
    return NextResponse.json({ error: "Image must be PNG, JPG, WebP or GIF under 5 MB." }, { status: 400 });
  }

  const threadId = await getOrderChatThreadId(orderId);
  const { data: message, error: messageError } = await access.admin
    .schema("messaging")
    .from("messages")
    .insert({
      thread_id: threadId,
      sender_type: access.role,
      message_kind: "text",
      body: body || (file instanceof File ? "Sent an image" : ""),
      approval_status: "sent",
      sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (messageError) {
    return NextResponse.json({ error: "Message could not be sent." }, { status: 500 });
  }

  if (file instanceof File) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) || "message-image";
    const storagePath = `order-chat/${orderId}/${crypto.randomUUID()}-${safeName}`;
    const upload = await access.admin.storage
      .from("customization-assets")
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (upload.error) {
      return NextResponse.json({ error: "Image could not be uploaded." }, { status: 500 });
    }
    await access.admin.schema("messaging").from("message_attachments").insert({
      message_id: String(message.id),
      storage_bucket: "customization-assets",
      storage_path: storagePath,
      attachment_type: "other",
      label: safeName,
    });
  }

  await access.admin
    .schema("messaging")
    .from("threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);

  return NextResponse.json({ ok: true, threadId });
}
