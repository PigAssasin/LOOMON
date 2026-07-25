import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

type AgentConversation = {
  id: string;
  title: string | null;
  context_type: string;
  context_id: string | null;
  created_at: string;
  updated_at: string;
};

type AgentMessage = {
  id: number;
  conversation_id: string;
  role: "user" | "assistant";
  content: string | null;
  structured_content: {
    action?: "orders" | "profile";
    productSlugs?: string[];
    context?: string;
    source?: "gemini" | "local";
  } | null;
  created_at: string;
};

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ conversations: [] }, { status: 503 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ conversations: [] }, { status: 401 });
  }

  const db = supabase as unknown as SupabaseClient;
  const { data: conversationData, error: conversationError } = await db
    .schema("agent")
    .from("conversations")
    .select("id,title,context_type,context_id,created_at,updated_at")
    .eq("user_id", user.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(30);
  if (conversationError) {
    return NextResponse.json({ conversations: [] }, { status: 500 });
  }

  const conversations = (conversationData ?? []) as AgentConversation[];
  if (!conversations.length) {
    return NextResponse.json({ conversations: [] });
  }

  const { data: messageData, error: messageError } = await db
    .schema("agent")
    .from("messages")
    .select("id,conversation_id,role,content,structured_content,created_at")
    .in("conversation_id", conversations.map((conversation) => conversation.id))
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });
  if (messageError) {
    return NextResponse.json({ conversations: [] }, { status: 500 });
  }

  const messages = (messageData ?? []) as AgentMessage[];
  return NextResponse.json({
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title ?? "LOOMON task",
      createdAt: new Date(conversation.created_at).getTime(),
      updatedAt: new Date(conversation.updated_at).getTime(),
      messages: messages
        .filter((message) => message.conversation_id === conversation.id)
        .map((message) => ({
          id: `db-message-${message.id}`,
          role: message.role,
          text: message.content ?? "",
          action: message.structured_content?.action,
          productSlugs: message.structured_content?.productSlugs,
          context: message.structured_content?.context,
          source: message.structured_content?.source,
        })),
    })),
  });
}
