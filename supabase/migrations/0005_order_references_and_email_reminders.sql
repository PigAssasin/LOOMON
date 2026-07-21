create or replace function commerce.generate_order_number(p_created_at timestamptz default now())
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  candidate text;
  token text;
begin
  loop
    token := translate(upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 6)), '01', 'GH');
    candidate := 'PM-' || to_char(p_created_at at time zone 'UTC', 'YY-MM') || '-' || token;
    exit when not exists (select 1 from commerce.orders o where o.order_number = candidate);
  end loop;
  return candidate;
end;
$$;

alter table commerce.orders
  alter column order_number set default commerce.generate_order_number();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_order_number_format_check'
      and conrelid = 'commerce.orders'::regclass
  ) then
    alter table commerce.orders
      add constraint orders_order_number_format_check
      check (order_number ~ '^PM-[0-9]{2}-[0-9]{2}-[A-Z2-9]{6}$') not valid;
  end if;
end $$;

create table notifications.order_preferences (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references commerce.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email_address text not null check (email_address ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  email_enabled boolean not null default true,
  event_types text[] not null default array['status_change', 'approval_due', 'inactivity'],
  reminder_lead_minutes integer not null default 1440 check (reminder_lead_minutes between 60 and 10080),
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, user_id),
  check (event_types <@ array['status_change', 'approval_due', 'inactivity', 'delivery'])
);
create index order_preferences_user_idx on notifications.order_preferences(user_id, updated_at desc);

alter table notifications.reminders
  add column if not exists recipient_email text,
  add column if not exists provider_message_id text,
  add column if not exists last_error text,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists updated_at timestamptz not null default now();

create index reminders_email_due_idx
  on notifications.reminders(scheduled_for, id)
  where status = 'scheduled' and channel = 'email';

alter table notifications.order_preferences enable row level security;

create policy order_preferences_participant_select
on notifications.order_preferences
for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from commerce.orders o
    where o.id = order_id
      and (o.buyer_id = (select auth.uid()) or catalog.has_maker_role(o.maker_id))
  )
);

create policy order_preferences_participant_insert
on notifications.order_preferences
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from commerce.orders o
    where o.id = order_id
      and (o.buyer_id = (select auth.uid()) or catalog.has_maker_role(o.maker_id, array['owner', 'manager', 'order_manager']))
  )
);

create policy order_preferences_participant_update
on notifications.order_preferences
for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from commerce.orders o
    where o.id = order_id
      and (o.buyer_id = (select auth.uid()) or catalog.has_maker_role(o.maker_id, array['owner', 'manager', 'order_manager']))
  )
);

grant select, insert, update on notifications.order_preferences to authenticated;

create or replace function notifications.enqueue_order_status_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into notifications.reminders (
    user_id,
    order_id,
    reminder_type,
    channel,
    scheduled_for,
    timezone,
    deduplication_key,
    status,
    payload,
    recipient_email
  )
  select
    p.user_id,
    new.order_id,
    'order_status_change',
    'email',
    now(),
    p.timezone,
    'order-status:' || new.id::text || ':' || p.user_id::text || ':email',
    'scheduled',
    jsonb_build_object(
      'order_reference', o.order_number,
      'from_status', new.from_status,
      'to_status', new.to_status,
      'reason', new.reason
    ),
    p.email_address
  from notifications.order_preferences p
  join commerce.orders o on o.id = p.order_id
  where p.order_id = new.order_id
    and p.email_enabled
    and 'status_change' = any(p.event_types)
  on conflict (deduplication_key) do nothing;

  return new;
end;
$$;

create trigger order_status_history_enqueue_email
after insert on commerce.order_status_history
for each row execute function notifications.enqueue_order_status_email();

create or replace function public.claim_due_email_reminders(
  p_worker_id text,
  p_limit integer default 25
)
returns setof notifications.reminders
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update notifications.reminders r
  set
    status = 'sending',
    attempts = r.attempts + 1,
    locked_at = now(),
    locked_by = p_worker_id,
    updated_at = now()
  where r.id in (
    select queued.id
    from notifications.reminders queued
    where queued.status = 'scheduled'
      and queued.channel = 'email'
      and queued.scheduled_for <= now()
    order by queued.scheduled_for, queued.id
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  returning r.*;
end;
$$;

revoke execute on function public.claim_due_email_reminders(text, integer) from public, anon, authenticated;
grant execute on function public.claim_due_email_reminders(text, integer) to service_role;
