# Order references and email reminders

## Order identity

- `commerce.orders.id` is the internal UUID used by foreign keys and APIs.
- `commerce.orders.order_number` is the immutable public reference shown to buyers, sellers and support.
- New references use `LM-YY-MM-XXXXXX`, for example `LM-26-07-K7M4Q2`.
- The random suffix avoids exposing marketplace volume. The unique constraint remains the final collision guard.
- Legacy references remain readable because the format constraint is introduced as `NOT VALID`; all new or updated values must use the new format.

## Reminder flow

1. A participant links an email in `notifications.order_preferences`.
2. An order status-history insert enqueues one deduplicated email reminder.
3. Supabase Cron invokes `send-order-reminders` using a secret key.
4. The worker atomically claims due rows with `FOR UPDATE SKIP LOCKED`.
5. Resend receives a stable `Idempotency-Key`; the provider message ID or failure is written back to the reminder.
6. Failed deliveries retry with backoff and stop after five attempts.

## Deployment

Set Edge Function secrets:

```bash
supabase secrets set RESEND_API_KEY=re_... ORDER_EMAIL_FROM="LOOMON <orders@your-domain.com>"
supabase functions deploy send-order-reminders
```

Create one Supabase Cron job that invokes the function every minute. Use a named secret API key for the cron call. Do not expose that key to the browser.

The current local UI stores its demo preference in local storage until Supabase authentication is connected. The schema and worker are ready for the authenticated persistence step.
