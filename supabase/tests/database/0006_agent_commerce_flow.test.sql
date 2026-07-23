begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(30);

select ok(exists (select 1 from information_schema.schemata where schema_name = 'customization'), 'customization schema exists');
select ok(exists (select 1 from information_schema.schemata where schema_name = 'messaging'), 'messaging schema exists');

select ok(to_regclass('customization.projects') is not null, 'customization.projects exists');
select ok(to_regclass('customization.assets') is not null, 'customization.assets exists');
select ok(to_regclass('customization.render_batches') is not null, 'customization.render_batches exists');
select ok(to_regclass('customization.render_candidates') is not null, 'customization.render_candidates exists');
select ok(to_regclass('customization.briefs') is not null, 'customization.briefs exists');
select ok(to_regclass('agent.goals') is not null, 'agent.goals exists');
select ok(to_regclass('agent.runs') is not null, 'agent.runs exists');
select ok(to_regclass('agent.wallet_intents') is not null, 'agent.wallet_intents exists');
select ok(to_regclass('wallet.agent_wallets') is not null, 'wallet.agent_wallets exists');
select ok(to_regclass('wallet.agent_delegation_policies') is not null, 'wallet.agent_delegation_policies exists');
select ok(to_regclass('messaging.threads') is not null, 'messaging.threads exists');
select ok(to_regclass('messaging.thread_participants') is not null, 'messaging.thread_participants exists');
select ok(to_regclass('messaging.messages') is not null, 'messaging.messages exists');
select ok(to_regclass('messaging.message_attachments') is not null, 'messaging.message_attachments exists');
select ok(to_regclass('commerce.order_briefs') is not null, 'commerce.order_briefs exists');
select ok(to_regclass('commerce.order_action_requests') is not null, 'commerce.order_action_requests exists');
select ok(to_regclass('payments.contract_versions') is not null, 'payments.contract_versions exists');
select ok(to_regclass('payments.escrow_instances') is not null, 'payments.escrow_instances exists');
select ok(to_regclass('payments.chain_events') is not null, 'payments.chain_events exists');

select ok(exists (select 1 from pg_constraint where conname = 'render_batches_batch_number_check'), 'render batch number is constrained');
select ok(exists (select 1 from pg_constraint where conname = 'render_batches_project_id_batch_number_key'), 'one render batch number per project');
select ok(exists (select 1 from pg_constraint where conname = 'render_candidates_candidate_number_check'), 'render candidate number is constrained');
select ok(exists (select 1 from pg_constraint where conname = 'render_candidates_batch_id_candidate_number_key'), 'one candidate number per batch');
select ok(exists (select 1 from pg_constraint where conname = 'briefs_check'), 'briefs require render candidate, source asset or text');

select ok(exists (select 1 from pg_tables where schemaname = 'customization' and tablename = 'projects' and rowsecurity), 'customization.projects has RLS enabled');
select ok(exists (select 1 from pg_tables where schemaname = 'messaging' and tablename = 'messages' and rowsecurity), 'messaging.messages has RLS enabled');
select ok(exists (select 1 from pg_policies where schemaname = 'messaging' and tablename = 'messages' and policyname = 'messages_participant_insert'), 'message send policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'agent' and tablename = 'goals' and policyname = 'goals_owner_all'), 'agent goal owner policy exists');

select * from finish();

rollback;
