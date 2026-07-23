create schema if not exists customization;
create schema if not exists messaging;

alter table agent.conversations
  drop constraint if exists conversations_context_type_check;

alter table agent.conversations
  add constraint conversations_context_type_check
  check (context_type in ('discovery', 'customization', 'quote', 'order', 'profile', 'seller_catalog', 'support'));

alter table agent.conversations
  add column if not exists title text,
  add column if not exists last_message_at timestamptz,
  add column if not exists current_goal_id uuid;

create table customization.projects (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references agent.conversations(id) on delete set null,
  selected_product_id bigint references catalog.products(id) on delete restrict,
  selected_product_version_id bigint references catalog.product_versions(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'needs_product', 'customizing', 'brief_ready', 'order_prepared', 'ordered', 'cancelled', 'archived')),
  entrypoint text not null default 'personal_agent' check (entrypoint in ('personal_agent', 'product_detail', 'inspiration', 'seller_link')),
  locale text not null default 'vi' check (locale in ('vi', 'en')),
  public_reference text not null unique default ('LM-PJ-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8))),
  selected_brief_id uuid,
  selected_render_candidate_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index projects_owner_status_idx on customization.projects(owner_user_id, status, updated_at desc);
create index projects_product_version_idx on customization.projects(selected_product_version_id) where selected_product_version_id is not null;

create table customization.assets (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references customization.projects(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  asset_role text not null check (asset_role in ('source_upload', 'artwork', 'cutout', 'product_reference', 'agent_render', 'seller_proof', 'production_snapshot')),
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  width integer check (width > 0),
  height integer check (height > 0),
  bytes bigint not null check (bytes > 0),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  rights_confirmed boolean not null default false,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected', 'needs_review')),
  visibility text not null default 'private' check (visibility in ('private', 'thread_participants', 'public_catalog')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path),
  unique (project_id, checksum_sha256, asset_role)
);
create index assets_project_role_idx on customization.assets(project_id, asset_role, created_at desc);
create index assets_owner_idx on customization.assets(owner_user_id, created_at desc);

create table customization.asset_analyses (
  id uuid primary key default extensions.gen_random_uuid(),
  asset_id uuid not null references customization.assets(id) on delete cascade,
  analyzer text not null,
  model text,
  model_version text,
  status text not null default 'completed' check (status in ('queued', 'running', 'completed', 'failed')),
  subject_summary text,
  dominant_colors text[] not null default array[]::text[],
  transparency_detected boolean,
  effective_width integer check (effective_width > 0),
  effective_height integer check (effective_height > 0),
  suitability jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index asset_analyses_asset_idx on customization.asset_analyses(asset_id, created_at desc);

create table customization.render_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references customization.projects(id) on delete cascade,
  batch_number smallint not null check (batch_number between 1 and 3),
  intent text not null check (intent in ('apply_artwork', 'text_only')),
  source_asset_id uuid references customization.assets(id) on delete restrict,
  product_version_id bigint not null references catalog.product_versions(id) on delete restrict,
  provider text not null default 'google',
  model text not null,
  fixed_prompt_version text not null,
  notes_hash text,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'partial', 'failed', 'cancelled')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_agent_run_id uuid,
  request_id text,
  latency_ms integer check (latency_ms >= 0),
  generated_count smallint not null default 0 check (generated_count between 0 and 3),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (project_id, batch_number)
);
create index render_batches_project_idx on customization.render_batches(project_id, created_at desc);
create index render_batches_status_idx on customization.render_batches(status, created_at) where status in ('queued', 'running');

create table customization.render_candidates (
  id uuid primary key default extensions.gen_random_uuid(),
  batch_id uuid not null references customization.render_batches(id) on delete cascade,
  candidate_number smallint not null check (candidate_number between 1 and 3),
  output_asset_id uuid not null references customization.assets(id) on delete restrict,
  label text not null,
  status text not null default 'available' check (status in ('available', 'selected', 'rejected', 'hidden')),
  quality_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (batch_id, candidate_number),
  unique (batch_id, output_asset_id)
);
create index render_candidates_batch_idx on customization.render_candidates(batch_id, candidate_number);
create index render_candidates_asset_idx on customization.render_candidates(output_asset_id);

create table customization.briefs (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references customization.projects(id) on delete cascade,
  product_version_id bigint not null references catalog.product_versions(id) on delete restrict,
  source_asset_id uuid references customization.assets(id) on delete restrict,
  selected_candidate_id uuid references customization.render_candidates(id) on delete restrict,
  brief_type text not null check (brief_type in ('agent_render', 'source_file_only', 'text_only', 'source_file_and_notes')),
  maker_notes text,
  status text not null default 'draft' check (status in ('draft', 'approved_by_buyer', 'sent_to_seller', 'superseded', 'cancelled')),
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  terms_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (brief_type = 'agent_render' and selected_candidate_id is not null)
    or (brief_type = 'text_only' and maker_notes is not null and length(trim(maker_notes)) > 0)
    or (brief_type in ('source_file_only', 'source_file_and_notes') and source_asset_id is not null)
  )
);
create index briefs_project_idx on customization.briefs(project_id, created_at desc);
create index briefs_product_version_idx on customization.briefs(product_version_id);

alter table customization.projects
  add constraint projects_selected_brief_id_fkey
  foreign key (selected_brief_id) references customization.briefs(id) on delete set null;

alter table customization.projects
  add constraint projects_selected_render_candidate_id_fkey
  foreign key (selected_render_candidate_id) references customization.render_candidates(id) on delete set null;

create table agent.identities (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  identity_type text not null check (identity_type in ('buyer_agent', 'seller_agent', 'platform_operations_agent')),
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'frozen', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, identity_type)
);
create index agent_identities_owner_idx on agent.identities(owner_user_id, identity_type);

create table agent.goals (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_identity_id uuid references agent.identities(id) on delete set null,
  conversation_id uuid references agent.conversations(id) on delete set null,
  project_id uuid references customization.projects(id) on delete set null,
  order_id uuid references commerce.orders(id) on delete set null,
  goal_type text not null check (goal_type in ('product_search', 'customization', 'place_order', 'cancel_order', 'manage_order', 'payment', 'seller_message_draft', 'support')),
  autonomy_mode text not null default 'prepare' check (autonomy_mode in ('observe', 'prepare', 'execute_limited', 'managed_commerce', 'frozen')),
  status text not null default 'active' check (status in ('active', 'waiting_for_user', 'waiting_for_event', 'completed', 'failed', 'cancelled', 'blocked')),
  objective text not null,
  success_condition text,
  scope jsonb not null default '{}'::jsonb,
  budget_currency text not null default 'USDC' check (budget_currency in ('USDC', 'VND')),
  budget_amount_atomic bigint check (budget_amount_atomic >= 0),
  policy_hash text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index goals_user_status_idx on agent.goals(user_id, status, updated_at desc);
create index goals_project_idx on agent.goals(project_id) where project_id is not null;
create index goals_order_idx on agent.goals(order_id) where order_id is not null;

alter table agent.conversations
  add constraint conversations_current_goal_id_fkey
  foreign key (current_goal_id) references agent.goals(id) on delete set null;

create table agent.runs (
  id uuid primary key default extensions.gen_random_uuid(),
  goal_id uuid references agent.goals(id) on delete cascade,
  conversation_id uuid references agent.conversations(id) on delete cascade,
  triggered_by_message_id bigint references agent.messages(id) on delete set null,
  trigger_type text not null default 'user_message' check (trigger_type in ('user_message', 'system_event', 'schedule', 'tool_callback')),
  status text not null default 'running' check (status in ('queued', 'running', 'waiting_for_approval', 'completed', 'failed', 'cancelled')),
  model text,
  max_steps integer not null default 12 check (max_steps between 1 and 64),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text
);
create index runs_goal_idx on agent.runs(goal_id, started_at desc);
create index runs_conversation_idx on agent.runs(conversation_id, started_at desc);

alter table agent.tool_calls
  add column if not exists run_id uuid references agent.runs(id) on delete set null,
  add column if not exists semantic_action text,
  add column if not exists risk_level text check (risk_level in ('low', 'medium', 'high', 'critical'));
create index tool_calls_run_idx on agent.tool_calls(run_id, created_at) where run_id is not null;

create table agent.observations (
  id uuid primary key default extensions.gen_random_uuid(),
  run_id uuid not null references agent.runs(id) on delete cascade,
  tool_call_id uuid references agent.tool_calls(id) on delete set null,
  observation_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index observations_run_idx on agent.observations(run_id, created_at);

create table wallet.agent_wallets (
  id uuid primary key default extensions.gen_random_uuid(),
  agent_identity_id uuid not null references agent.identities(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('buyer_commerce', 'seller_operations', 'platform_operations')),
  chain_id bigint not null default 5042002 check (chain_id = 5042002),
  address text check (address is null or address ~ '^0x[0-9a-fA-F]{40}$'),
  provider text not null,
  status text not null default 'provisioning' check (status in ('provisioning', 'active', 'frozen', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_identity_id, purpose, chain_id)
);
create index agent_wallets_owner_idx on wallet.agent_wallets(owner_user_id, purpose);

create table wallet.agent_delegation_policies (
  id uuid primary key default extensions.gen_random_uuid(),
  agent_wallet_id uuid not null references wallet.agent_wallets(id) on delete cascade,
  grantor_user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references agent.goals(id) on delete set null,
  order_id uuid references commerce.orders(id) on delete cascade,
  policy_hash text not null,
  autonomy_mode text not null check (autonomy_mode in ('observe', 'prepare', 'execute_limited', 'managed_commerce', 'frozen')),
  allowed_chain_id bigint not null default 5042002 check (allowed_chain_id = 5042002),
  allowed_token_address text not null check (allowed_token_address ~ '^0x[0-9a-fA-F]{40}$'),
  allowed_contracts text[] not null default array[]::text[],
  allowed_recipients text[] not null default array[]::text[],
  allowed_functions text[] not null default array[]::text[],
  per_action_limit_atomic bigint not null check (per_action_limit_atomic >= 0),
  period_limit_atomic bigint not null check (period_limit_atomic >= 0),
  total_limit_atomic bigint not null check (total_limit_atomic >= 0),
  approval_threshold_atomic bigint not null default 0 check (approval_threshold_atomic >= 0),
  spent_atomic bigint not null default 0 check (spent_atomic >= 0),
  revocation_nonce bigint not null default 0 check (revocation_nonce >= 0),
  status text not null default 'active' check (status in ('active', 'revoked', 'expired', 'frozen')),
  valid_from timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (expires_at > valid_from),
  check (spent_atomic <= total_limit_atomic)
);
create index agent_delegation_grantor_idx on wallet.agent_delegation_policies(grantor_user_id, status, expires_at);
create index agent_delegation_wallet_idx on wallet.agent_delegation_policies(agent_wallet_id, status, expires_at);
create index agent_delegation_order_idx on wallet.agent_delegation_policies(order_id) where order_id is not null;

create table agent.wallet_intents (
  id uuid primary key default extensions.gen_random_uuid(),
  goal_id uuid references agent.goals(id) on delete set null,
  run_id uuid references agent.runs(id) on delete set null,
  delegation_policy_id uuid references wallet.agent_delegation_policies(id) on delete restrict,
  order_id uuid references commerce.orders(id) on delete set null,
  intent_type text not null check (intent_type in ('fund_order', 'cancel_order', 'request_refund', 'release_payment', 'withdraw')),
  status text not null default 'prepared' check (status in ('prepared', 'simulation_required', 'approval_required', 'approved', 'submitted', 'confirmed', 'failed', 'denied', 'cancelled')),
  idempotency_key text not null,
  payload_hash text not null,
  typed_payload jsonb not null,
  simulation_result jsonb,
  risk_decision jsonb,
  transaction_hash text check (transaction_hash is null or transaction_hash ~ '^0x[0-9a-fA-F]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);
create index wallet_intents_goal_idx on agent.wallet_intents(goal_id, created_at desc);
create index wallet_intents_order_idx on agent.wallet_intents(order_id, created_at desc) where order_id is not null;
create index wallet_intents_policy_idx on agent.wallet_intents(delegation_policy_id, created_at desc);

create table messaging.threads (
  id uuid primary key default extensions.gen_random_uuid(),
  thread_type text not null check (thread_type in ('buyer_seller', 'support', 'agent_handoff')),
  project_id uuid references customization.projects(id) on delete set null,
  order_id uuid references commerce.orders(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed', 'archived')),
  title text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (project_id is not null or order_id is not null)
);
create index threads_project_idx on messaging.threads(project_id, updated_at desc) where project_id is not null;
create index threads_order_idx on messaging.threads(order_id, updated_at desc) where order_id is not null;

create table messaging.thread_participants (
  id uuid primary key default extensions.gen_random_uuid(),
  thread_id uuid not null references messaging.threads(id) on delete cascade,
  participant_type text not null check (participant_type in ('buyer', 'seller', 'agent', 'support')),
  user_id uuid references auth.users(id) on delete cascade,
  maker_id bigint references catalog.makers(id) on delete cascade,
  agent_identity_id uuid references agent.identities(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'observer', 'assistant', 'moderator')),
  can_send boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  check (
    (participant_type in ('buyer', 'support') and user_id is not null and maker_id is null and agent_identity_id is null)
    or (participant_type = 'seller' and maker_id is not null and agent_identity_id is null)
    or (participant_type = 'agent' and agent_identity_id is not null)
  )
);
create index thread_participants_thread_idx on messaging.thread_participants(thread_id, left_at);
create index thread_participants_user_idx on messaging.thread_participants(user_id, thread_id) where user_id is not null;
create index thread_participants_maker_idx on messaging.thread_participants(maker_id, thread_id) where maker_id is not null;
create unique index thread_participants_unique_user_idx on messaging.thread_participants(thread_id, participant_type, user_id) where user_id is not null;
create unique index thread_participants_unique_maker_idx on messaging.thread_participants(thread_id, participant_type, maker_id) where maker_id is not null;
create unique index thread_participants_unique_agent_idx on messaging.thread_participants(thread_id, participant_type, agent_identity_id) where agent_identity_id is not null;

create table messaging.messages (
  id uuid primary key default extensions.gen_random_uuid(),
  thread_id uuid not null references messaging.threads(id) on delete cascade,
  sender_participant_id uuid references messaging.thread_participants(id) on delete set null,
  sender_type text not null check (sender_type in ('buyer', 'seller', 'agent', 'support', 'system')),
  message_kind text not null default 'text' check (message_kind in ('text', 'system_event', 'agent_draft', 'status_update')),
  body text,
  structured_body jsonb,
  approval_status text not null default 'sent' check (approval_status in ('draft', 'pending_user_approval', 'approved', 'sent', 'blocked')),
  created_by_agent_run_id uuid references agent.runs(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (body is not null or structured_body is not null),
  check (
    sender_type <> 'agent'
    or message_kind in ('agent_draft', 'system_event', 'status_update')
    or approval_status in ('approved', 'sent')
  )
);
create index messages_thread_idx on messaging.messages(thread_id, created_at desc);
create index messages_sender_participant_idx on messaging.messages(sender_participant_id, created_at desc) where sender_participant_id is not null;

create table messaging.message_attachments (
  id uuid primary key default extensions.gen_random_uuid(),
  message_id uuid not null references messaging.messages(id) on delete cascade,
  asset_id uuid references customization.assets(id) on delete restrict,
  storage_bucket text,
  storage_path text,
  attachment_type text not null check (attachment_type in ('source_asset', 'render_candidate', 'brief', 'seller_proof', 'invoice', 'shipping_evidence', 'other')),
  label text,
  created_at timestamptz not null default now(),
  check (asset_id is not null or (storage_bucket is not null and storage_path is not null))
);
create index message_attachments_message_idx on messaging.message_attachments(message_id);
create index message_attachments_asset_idx on messaging.message_attachments(asset_id) where asset_id is not null;

create table commerce.order_briefs (
  order_id uuid primary key references commerce.orders(id) on delete cascade,
  project_id uuid not null references customization.projects(id) on delete restrict,
  brief_id uuid not null references customization.briefs(id) on delete restrict,
  selected_render_candidate_id uuid references customization.render_candidates(id) on delete restrict,
  production_snapshot_asset_id uuid references customization.assets(id) on delete restrict,
  terms_hash text not null,
  created_at timestamptz not null default now(),
  unique (brief_id)
);
create index order_briefs_project_idx on commerce.order_briefs(project_id);

create table commerce.order_action_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references commerce.orders(id) on delete cascade,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  requested_by_agent_goal_id uuid references agent.goals(id) on delete set null,
  action_type text not null check (action_type in ('place_order', 'cancel_order', 'request_refund', 'change_deadline', 'change_address')),
  status text not null default 'requested' check (status in ('requested', 'approved', 'executed', 'denied', 'cancelled', 'failed')),
  natural_language_request text,
  typed_payload jsonb not null default '{}'::jsonb,
  requires_human_approval boolean not null default true,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  idempotency_key text,
  created_at timestamptz not null default now(),
  executed_at timestamptz,
  unique (idempotency_key)
);
create index order_action_requests_order_idx on commerce.order_action_requests(order_id, created_at desc);
create index order_action_requests_agent_goal_idx on commerce.order_action_requests(requested_by_agent_goal_id, created_at desc) where requested_by_agent_goal_id is not null;

create table payments.contract_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  chain_id bigint not null default 5042002 check (chain_id = 5042002),
  contract_name text not null,
  version text not null,
  factory_address text check (factory_address is null or factory_address ~ '^0x[0-9a-fA-F]{40}$'),
  implementation_address text check (implementation_address is null or implementation_address ~ '^0x[0-9a-fA-F]{40}$'),
  abi_hash text,
  bytecode_hash text,
  deployment_tx_hash text check (deployment_tx_hash is null or deployment_tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  deployment_block bigint,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'retired')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  unique (chain_id, contract_name, version)
);

create table payments.escrow_instances (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null unique references commerce.orders(id) on delete cascade,
  contract_version_id uuid not null references payments.contract_versions(id) on delete restrict,
  escrow_address text not null unique check (escrow_address ~ '^0x[0-9a-fA-F]{40}$'),
  buyer_address text not null check (buyer_address ~ '^0x[0-9a-fA-F]{40}$'),
  merchant_address text not null check (merchant_address ~ '^0x[0-9a-fA-F]{40}$'),
  token_address text not null check (token_address ~ '^0x[0-9a-fA-F]{40}$'),
  amount_atomic bigint not null check (amount_atomic > 0),
  terms_hash text not null,
  status text not null default 'created' check (status in ('created', 'funded', 'design_approved', 'fulfillment_confirmed', 'settled', 'cancelled', 'refunded', 'disputed', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index escrow_instances_status_idx on payments.escrow_instances(status, updated_at desc);
create index escrow_instances_contract_version_idx on payments.escrow_instances(contract_version_id);

create table payments.chain_events (
  id uuid primary key default extensions.gen_random_uuid(),
  chain_id bigint not null check (chain_id = 5042002),
  contract_address text not null check (contract_address ~ '^0x[0-9a-fA-F]{40}$'),
  transaction_hash text not null check (transaction_hash ~ '^0x[0-9a-fA-F]{64}$'),
  log_index integer not null check (log_index >= 0),
  block_number bigint not null check (block_number >= 0),
  event_name text not null,
  decoded_payload jsonb not null,
  projection_status text not null default 'pending' check (projection_status in ('pending', 'projected', 'failed', 'ignored')),
  created_at timestamptz not null default now(),
  projected_at timestamptz,
  unique (chain_id, transaction_hash, log_index)
);
create index chain_events_pending_idx on payments.chain_events(block_number, log_index) where projection_status = 'pending';
create index chain_events_contract_idx on payments.chain_events(contract_address, block_number desc);

create or replace function customization.can_access_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from customization.projects p
    where p.id = target_project_id
      and p.owner_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from commerce.order_briefs ob
    join commerce.orders o on o.id = ob.order_id
    where ob.project_id = target_project_id
      and (o.buyer_id = (select auth.uid()) or catalog.has_maker_role(o.maker_id))
  )
$$;

create or replace function messaging.can_access_thread(target_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from messaging.thread_participants tp
    where tp.thread_id = target_thread_id
      and tp.left_at is null
      and (
        tp.user_id = (select auth.uid())
        or (tp.maker_id is not null and catalog.has_maker_role(tp.maker_id))
        or exists (
          select 1
          from agent.identities ai
          where ai.id = tp.agent_identity_id
            and ai.owner_user_id = (select auth.uid())
        )
      )
  )
$$;

alter table customization.projects enable row level security;
alter table customization.assets enable row level security;
alter table customization.asset_analyses enable row level security;
alter table customization.render_batches enable row level security;
alter table customization.render_candidates enable row level security;
alter table customization.briefs enable row level security;
alter table agent.identities enable row level security;
alter table agent.goals enable row level security;
alter table agent.runs enable row level security;
alter table agent.observations enable row level security;
alter table wallet.agent_wallets enable row level security;
alter table wallet.agent_delegation_policies enable row level security;
alter table agent.wallet_intents enable row level security;
alter table messaging.threads enable row level security;
alter table messaging.thread_participants enable row level security;
alter table messaging.messages enable row level security;
alter table messaging.message_attachments enable row level security;
alter table commerce.order_briefs enable row level security;
alter table commerce.order_action_requests enable row level security;
alter table payments.contract_versions enable row level security;
alter table payments.escrow_instances enable row level security;
alter table payments.chain_events enable row level security;

create policy projects_owner_all on customization.projects for all to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy projects_order_participant_select on customization.projects for select to authenticated using (customization.can_access_project(id));
create policy assets_project_member_select on customization.assets for select to authenticated using (customization.can_access_project(project_id));
create policy assets_owner_insert on customization.assets for insert to authenticated with check (owner_user_id = (select auth.uid()) and customization.can_access_project(project_id));
create policy assets_owner_update on customization.assets for update to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy asset_analyses_project_select on customization.asset_analyses for select to authenticated using (exists (select 1 from customization.assets a where a.id = asset_id and customization.can_access_project(a.project_id)));
create policy render_batches_project_select on customization.render_batches for select to authenticated using (customization.can_access_project(project_id));
create policy render_batches_owner_insert on customization.render_batches for insert to authenticated with check (created_by_user_id = (select auth.uid()) and customization.can_access_project(project_id));
create policy render_candidates_project_select on customization.render_candidates for select to authenticated using (exists (select 1 from customization.render_batches rb where rb.id = batch_id and customization.can_access_project(rb.project_id)));
create policy briefs_project_select on customization.briefs for select to authenticated using (customization.can_access_project(project_id));
create policy briefs_owner_insert on customization.briefs for insert to authenticated with check (exists (select 1 from customization.projects p where p.id = project_id and p.owner_user_id = (select auth.uid())));
create policy briefs_owner_update on customization.briefs for update to authenticated using (exists (select 1 from customization.projects p where p.id = project_id and p.owner_user_id = (select auth.uid()))) with check (exists (select 1 from customization.projects p where p.id = project_id and p.owner_user_id = (select auth.uid())));

create policy agent_identities_owner_select on agent.identities for select to authenticated using (owner_user_id = (select auth.uid()) or owner_user_id is null);
create policy agent_identities_owner_insert on agent.identities for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy agent_identities_owner_update on agent.identities for update to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy goals_owner_all on agent.goals for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy runs_owner_select on agent.runs for select to authenticated using (exists (select 1 from agent.goals g where g.id = goal_id and g.user_id = (select auth.uid())) or exists (select 1 from agent.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));
create policy observations_owner_select on agent.observations for select to authenticated using (exists (select 1 from agent.runs r left join agent.goals g on g.id = r.goal_id where r.id = run_id and (g.user_id = (select auth.uid()) or exists (select 1 from agent.conversations c where c.id = r.conversation_id and c.user_id = (select auth.uid())))));
create policy agent_wallets_owner_select on wallet.agent_wallets for select to authenticated using (owner_user_id = (select auth.uid()));
create policy agent_wallets_owner_insert on wallet.agent_wallets for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy agent_delegations_owner_select on wallet.agent_delegation_policies for select to authenticated using (grantor_user_id = (select auth.uid()));
create policy wallet_intents_owner_select on agent.wallet_intents for select to authenticated using (exists (select 1 from agent.goals g where g.id = goal_id and g.user_id = (select auth.uid())) or exists (select 1 from wallet.agent_delegation_policies p where p.id = delegation_policy_id and p.grantor_user_id = (select auth.uid())));

create policy threads_participant_select on messaging.threads for select to authenticated using (messaging.can_access_thread(id));
create policy threads_user_insert on messaging.threads for insert to authenticated with check (created_by_user_id = (select auth.uid()));
create policy thread_participants_select on messaging.thread_participants for select to authenticated using (messaging.can_access_thread(thread_id));
create policy thread_participants_user_insert on messaging.thread_participants for insert to authenticated with check (user_id = (select auth.uid()) or (maker_id is not null and catalog.has_maker_role(maker_id, array['owner','manager','order_manager'])));
create policy messages_participant_select on messaging.messages for select to authenticated using (messaging.can_access_thread(thread_id));
create policy messages_participant_insert on messaging.messages for insert to authenticated with check (
  messaging.can_access_thread(thread_id)
  and (
    sender_type = 'system'
    or exists (
      select 1
      from messaging.thread_participants tp
      where tp.id = sender_participant_id
        and tp.thread_id = messages.thread_id
        and tp.left_at is null
        and tp.can_send
        and (
          tp.user_id = (select auth.uid())
          or (tp.maker_id is not null and catalog.has_maker_role(tp.maker_id, array['owner','manager','order_manager']))
        )
    )
  )
);
create policy message_attachments_participant_select on messaging.message_attachments for select to authenticated using (exists (select 1 from messaging.messages m where m.id = message_id and messaging.can_access_thread(m.thread_id)));

create policy order_briefs_participant_select on commerce.order_briefs for select to authenticated using (exists (select 1 from commerce.orders o where o.id = order_id and (o.buyer_id = (select auth.uid()) or catalog.has_maker_role(o.maker_id))));
create policy order_action_requests_participant_select on commerce.order_action_requests for select to authenticated using (exists (select 1 from commerce.orders o where o.id = order_id and (o.buyer_id = (select auth.uid()) or catalog.has_maker_role(o.maker_id))));
create policy order_action_requests_buyer_insert on commerce.order_action_requests for insert to authenticated with check (requested_by_user_id = (select auth.uid()) and exists (select 1 from commerce.orders o where o.id = order_id and o.buyer_id = (select auth.uid())));

create policy contract_versions_authenticated_select on payments.contract_versions for select to authenticated using (status in ('active', 'paused', 'retired'));
create policy escrow_instances_participant_select on payments.escrow_instances for select to authenticated using (exists (select 1 from commerce.orders o where o.id = order_id and (o.buyer_id = (select auth.uid()) or catalog.has_maker_role(o.maker_id))));
create policy chain_events_participant_select on payments.chain_events for select to authenticated using (exists (select 1 from payments.escrow_instances ei join commerce.orders o on o.id = ei.order_id where lower(ei.escrow_address) = lower(contract_address) and (o.buyer_id = (select auth.uid()) or catalog.has_maker_role(o.maker_id))));

grant usage on schema customization, messaging to authenticated;
grant select, insert, update on customization.projects, customization.assets, customization.briefs to authenticated;
grant select on customization.asset_analyses, customization.render_batches, customization.render_candidates to authenticated;
grant insert on customization.render_batches to authenticated;
grant select, insert, update on agent.identities, agent.goals to authenticated;
grant select on agent.runs, agent.observations, agent.wallet_intents to authenticated;
grant select, insert on wallet.agent_wallets to authenticated;
grant select on wallet.agent_delegation_policies to authenticated;
grant select, insert on messaging.threads, messaging.thread_participants, messaging.messages to authenticated;
grant select on messaging.message_attachments to authenticated;
grant select on commerce.order_briefs, commerce.order_action_requests to authenticated;
grant insert on commerce.order_action_requests to authenticated;
grant select on payments.contract_versions, payments.escrow_instances, payments.chain_events to authenticated;
grant usage, select on all sequences in schema customization to authenticated;
grant usage, select on all sequences in schema messaging to authenticated;
