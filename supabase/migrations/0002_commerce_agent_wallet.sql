create table commerce.quote_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  buyer_id uuid not null references auth.users(id),
  maker_id bigint not null references catalog.makers(id),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'seller_review', 'quoted', 'accepted', 'rejected', 'expired', 'cancelled')),
  locale text not null default 'vi',
  required_by date,
  occasion text,
  buyer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quote_requests_buyer_idx on commerce.quote_requests(buyer_id, created_at desc);
create index quote_requests_maker_idx on commerce.quote_requests(maker_id, status, created_at desc);

create table commerce.quote_request_items (
  id bigint generated always as identity primary key,
  quote_request_id uuid not null references commerce.quote_requests(id) on delete cascade,
  product_id bigint not null references catalog.products(id),
  product_version_id bigint not null references catalog.product_versions(id),
  variant_id bigint references catalog.product_variants(id),
  quantity integer not null check (quantity > 0),
  requested_configuration jsonb not null default '{}'::jsonb
);
create index quote_request_items_quote_idx on commerce.quote_request_items(quote_request_id);

create table commerce.quote_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  quote_request_id uuid not null references commerce.quote_requests(id) on delete cascade,
  version_number integer not null,
  status text not null check (status in ('draft', 'issued', 'accepted', 'superseded', 'expired')),
  currency_code text not null check (currency_code in ('USDC', 'VND')),
  subtotal numeric(20,6) not null check (subtotal >= 0),
  customization_total numeric(20,6) not null default 0 check (customization_total >= 0),
  total numeric(20,6) not null check (total >= 0),
  deposit_percentage numeric(5,2) not null check (deposit_percentage between 0 and 100),
  snapshot jsonb not null,
  issued_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(quote_request_id, version_number)
);

create table commerce.invoices (
  id uuid primary key default extensions.gen_random_uuid(),
  invoice_number text not null unique,
  quote_version_id uuid not null references commerce.quote_versions(id),
  buyer_id uuid not null references auth.users(id),
  maker_id bigint not null references catalog.makers(id),
  invoice_type text not null default 'deposit' check (invoice_type in ('deposit', 'balance', 'refund')),
  currency_code text not null default 'USDC' check (currency_code = 'USDC'),
  token_decimals smallint not null default 6 check (token_decimals = 6),
  amount numeric(20,6) not null check (amount > 0),
  amount_atomic bigint not null check (amount_atomic > 0),
  recipient_address text not null check (recipient_address ~ '^0x[0-9a-fA-F]{40}$'),
  chain_id bigint not null default 5042002 check (chain_id = 5042002),
  status text not null default 'ready' check (status in ('ready', 'pending', 'paid', 'failed', 'expired', 'cancelled')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  paid_at timestamptz,
  snapshot jsonb not null
);
create index invoices_buyer_idx on commerce.invoices(buyer_id, issued_at desc);
create index invoices_maker_idx on commerce.invoices(maker_id, status, issued_at desc);

create table commerce.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  order_number text not null unique,
  buyer_id uuid not null references auth.users(id),
  maker_id bigint not null references catalog.makers(id),
  accepted_quote_version_id uuid not null references commerce.quote_versions(id),
  deposit_invoice_id uuid references commerce.invoices(id),
  status text not null check (status in ('deposit_pending', 'deposit_paid', 'production_confirmed', 'design_approval_pending', 'in_production', 'ready', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_buyer_idx on commerce.orders(buyer_id, created_at desc);
create index orders_maker_idx on commerce.orders(maker_id, status, created_at desc);

create table commerce.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references commerce.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_type text not null check (actor_type in ('buyer', 'seller', 'agent', 'system')),
  actor_id uuid,
  reason text,
  correlation_id uuid not null default extensions.gen_random_uuid(),
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on commerce.order_status_history(order_id, created_at);

create table wallet.accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  wallet_type text not null check (wallet_type in ('embedded', 'external')),
  custody_type text not null check (custody_type in ('user_controlled', 'developer_controlled')),
  chain_id bigint not null default 5042002 check (chain_id = 5042002),
  address text not null check (address ~ '^0x[0-9a-fA-F]{40}$'),
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, chain_id, address)
);
create unique index wallet_one_primary_per_user_idx on wallet.accounts(user_id) where is_primary;
create index wallet_accounts_user_idx on wallet.accounts(user_id, created_at desc);

create table wallet.delegations (
  id uuid primary key default extensions.gen_random_uuid(),
  wallet_account_id uuid not null references wallet.accounts(id) on delete cascade,
  capability_scope jsonb not null,
  allowed_recipients jsonb not null default '[]'::jsonb,
  allowed_contracts jsonb not null default '[]'::jsonb,
  per_transaction_limit numeric(20,6),
  period_limit numeric(20,6),
  valid_from timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  authorization_evidence jsonb not null,
  created_at timestamptz not null default now(),
  check (expires_at > valid_from)
);
create index wallet_delegations_account_idx on wallet.delegations(wallet_account_id, expires_at) where revoked_at is null;

create table payments.payment_intents (
  id uuid primary key default extensions.gen_random_uuid(),
  invoice_id uuid not null unique references commerce.invoices(id),
  wallet_account_id uuid references wallet.accounts(id),
  idempotency_key text not null unique,
  status text not null default 'prepared' check (status in ('prepared', 'approval_required', 'submitted', 'confirmed', 'failed', 'cancelled')),
  prepared_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table payments.transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  payment_intent_id uuid not null unique references payments.payment_intents(id),
  chain_id bigint not null check (chain_id = 5042002),
  transaction_hash text not null unique check (transaction_hash ~ '^0x[0-9a-fA-F]{64}$'),
  sender_address text not null,
  recipient_address text not null,
  token_address text not null,
  amount_atomic bigint not null check (amount_atomic > 0),
  receipt_status text not null check (receipt_status in ('pending', 'success', 'reverted')),
  block_number bigint,
  confirmed_at timestamptz,
  raw_receipt jsonb,
  created_at timestamptz not null default now()
);
create index payment_transactions_sender_idx on payments.transactions(sender_address, created_at desc);

create table agent.conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context_type text not null default 'discovery' check (context_type in ('discovery', 'quote', 'order', 'seller_catalog')),
  context_id text,
  status text not null default 'active' check (status in ('active', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_idx on agent.conversations(user_id, updated_at desc);

create table agent.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references agent.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content text,
  structured_content jsonb,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on agent.messages(conversation_id, id);

create table agent.tool_calls (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references agent.conversations(id) on delete cascade,
  tool_name text not null,
  input jsonb not null,
  output jsonb,
  authorization_context jsonb not null,
  status text not null check (status in ('requested', 'authorized', 'completed', 'failed', 'denied')),
  idempotency_key text,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index tool_calls_conversation_idx on agent.tool_calls(conversation_id, created_at desc);
create unique index tool_calls_idempotency_idx on agent.tool_calls(idempotency_key) where idempotency_key is not null;

create table notifications.reminders (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references commerce.orders(id) on delete cascade,
  reminder_type text not null,
  channel text not null check (channel in ('in_app', 'email')),
  scheduled_for timestamptz not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  deduplication_key text not null unique,
  status text not null default 'scheduled' check (status in ('scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  payload jsonb not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index reminders_due_idx on notifications.reminders(status, scheduled_for) where status = 'scheduled';
