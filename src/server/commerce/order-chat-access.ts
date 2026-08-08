import "server-only";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getAddress } from "viem";
import { createAdminClient } from "@/src/lib/supabase/admin";

export async function assertOrderChatAccess(orderId: string, walletAddress: string) {
  const admin = createAdminClient() as any;
  const normalized = getAddress(walletAddress).toLowerCase();
  const { data: escrow, error } = await admin
    .schema("payments")
    .from("escrow_instances")
    .select("buyer_address, merchant_address")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error || !escrow) return null;
  const buyer = String(escrow.buyer_address ?? "").toLowerCase();
  const seller = String(escrow.merchant_address ?? "").toLowerCase();
  if (normalized !== buyer && normalized !== seller) return null;
  return { admin, role: normalized === seller ? "seller" as const : "buyer" as const };
}

export async function getOrderChatThreadId(orderId: string) {
  const admin = createAdminClient() as any;
  const { data: existing } = await admin
    .schema("messaging")
    .from("threads")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existing?.id) return String(existing.id);

  const { data, error } = await admin
    .schema("messaging")
    .from("threads")
    .insert({
      thread_type: "buyer_seller",
      order_id: orderId,
      title: "Order chat",
      status: "open",
    })
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

export async function getOrderChatCursor(threadId: string) {
  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .schema("messaging")
    .from("messages")
    .select("id, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ? `${data.created_at}:${data.id}` : "empty";
}
