import { withSupabase } from "npm:@supabase/server";

type Reminder = {
  id: string;
  attempts: number;
  deduplication_key: string;
  recipient_email: string | null;
  payload: {
    order_reference?: string;
    from_status?: string | null;
    to_status?: string;
    reason?: string | null;
  };
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

export default {
  fetch: withSupabase({ auth: "secret" }, async (_request, context) => {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("ORDER_EMAIL_FROM");
    if (!resendApiKey || !from) return Response.json({ error: "Email provider secrets are not configured." }, { status: 503 });

    const workerId = crypto.randomUUID();
    const { data, error } = await context.supabaseAdmin.rpc("claim_due_email_reminders", { p_worker_id: workerId, p_limit: 25 });
    if (error) return Response.json({ error: error.message }, { status: 500 });

    const reminders = (data ?? []) as Reminder[];
    const results: Array<{ id: string; status: "sent" | "retry" | "failed" }> = [];

    for (const reminder of reminders) {
      const reference = reminder.payload.order_reference ?? "your order";
      if (!reminder.recipient_email) {
        await context.supabaseAdmin.schema("notifications").from("reminders").update({ status: "failed", last_error: "Missing recipient email", locked_at: null, locked_by: null, updated_at: new Date().toISOString() }).eq("id", reminder.id);
        results.push({ id: reminder.id, status: "failed" });
        continue;
      }

      const toStatus = reminder.payload.to_status ?? "updated";
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": reminder.deduplication_key,
        },
        body: JSON.stringify({
          from,
          to: [reminder.recipient_email],
          subject: `${reference} · Order update`,
          html: `<div style="font-family:Arial,sans-serif;color:#191919"><h1 style="font-size:28px">Order update</h1><p><strong>${escapeHtml(reference)}</strong> is now <strong>${escapeHtml(toStatus.replaceAll("_", " "))}</strong>.</p><p>Open your order page to review the latest milestone and any action needed.</p></div>`,
          tags: [{ name: "order_reference", value: reference.replace(/[^A-Za-z0-9_-]/g, "-") }],
        }),
      });

      if (response.ok) {
        const body = await response.json() as { id?: string };
        await context.supabaseAdmin.schema("notifications").from("reminders").update({ status: "sent", provider_message_id: body.id ?? null, sent_at: new Date().toISOString(), last_error: null, locked_at: null, locked_by: null, updated_at: new Date().toISOString() }).eq("id", reminder.id);
        results.push({ id: reminder.id, status: "sent" });
        continue;
      }

      const errorText = (await response.text()).slice(0, 1000);
      const retry = reminder.attempts < 5;
      const nextAttempt = new Date(Date.now() + Math.max(15, reminder.attempts * 15) * 60_000).toISOString();
      const failureUpdate = {
        status: retry ? "scheduled" : "failed",
        last_error: errorText,
        locked_at: null,
        locked_by: null,
        updated_at: new Date().toISOString(),
        ...(retry ? { scheduled_for: nextAttempt } : {}),
      };
      await context.supabaseAdmin.schema("notifications").from("reminders").update(failureUpdate).eq("id", reminder.id);
      results.push({ id: reminder.id, status: retry ? "retry" : "failed" });
    }

    return Response.json({ claimed: reminders.length, results });
  }),
};
