-- Cover every foreign-key access path that is not already backed by an index.
-- This keeps deletes, joins, RLS checks, projectors and background workers
-- predictable as the database grows.

create index if not exists conversations_current_goal_id_fkey_idx on agent.conversations (current_goal_id);
create index if not exists goals_agent_identity_id_fkey_idx on agent.goals (agent_identity_id);
create index if not exists goals_conversation_id_fkey_idx on agent.goals (conversation_id);
create index if not exists observations_tool_call_id_fkey_idx on agent.observations (tool_call_id);
create index if not exists runs_triggered_by_message_id_fkey_idx on agent.runs (triggered_by_message_id);
create index if not exists wallet_intents_run_id_fkey_idx on agent.wallet_intents (run_id);

create index if not exists field_provenance_confirmed_by_fkey_idx on catalog.field_provenance (confirmed_by);
create index if not exists import_jobs_created_by_fkey_idx on catalog.import_jobs (created_by);
create index if not exists import_rows_product_id_fkey_idx on catalog.import_rows (product_id);
create index if not exists import_rows_product_version_id_fkey_idx on catalog.import_rows (product_version_id);
create index if not exists maker_memberships_invited_by_fkey_idx on catalog.maker_memberships (invited_by);
create index if not exists price_rules_variant_id_fkey_idx on catalog.price_rules (variant_id);
create index if not exists product_customizations_customization_definition_id_fkey_idx on catalog.product_customizations (customization_definition_id);
create index if not exists product_media_media_asset_id_fkey_idx on catalog.product_media (media_asset_id);
create index if not exists product_terms_confirmed_by_fkey_idx on catalog.product_terms (confirmed_by);
create index if not exists product_versions_based_on_version_id_fkey_idx on catalog.product_versions (based_on_version_id);
create index if not exists product_versions_reviewed_by_fkey_idx on catalog.product_versions (reviewed_by);
create index if not exists product_versions_submitted_by_fkey_idx on catalog.product_versions (submitted_by);
create index if not exists products_created_by_fkey_idx on catalog.products (created_by);
create index if not exists products_published_version_id_fkey_idx on catalog.products (published_version_id);
create index if not exists terms_parent_id_fkey_idx on catalog.terms (parent_id);
create index if not exists validation_issues_maker_id_fkey_idx on catalog.validation_issues (maker_id);

create index if not exists invoices_quote_version_id_fkey_idx on commerce.invoices (quote_version_id);
create index if not exists order_action_requests_approved_by_user_id_fkey_idx on commerce.order_action_requests (approved_by_user_id);
create index if not exists order_action_requests_requested_by_user_id_fkey_idx on commerce.order_action_requests (requested_by_user_id);
create index if not exists order_briefs_production_snapshot_asset_id_fkey_idx on commerce.order_briefs (production_snapshot_asset_id);
create index if not exists order_briefs_selected_render_candidate_id_fkey_idx on commerce.order_briefs (selected_render_candidate_id);
create index if not exists orders_accepted_quote_version_id_fkey_idx on commerce.orders (accepted_quote_version_id);
create index if not exists orders_deposit_invoice_id_fkey_idx on commerce.orders (deposit_invoice_id);
create index if not exists quote_request_items_product_id_fkey_idx on commerce.quote_request_items (product_id);
create index if not exists quote_request_items_product_version_id_fkey_idx on commerce.quote_request_items (product_version_id);
create index if not exists quote_request_items_variant_id_fkey_idx on commerce.quote_request_items (variant_id);

create index if not exists briefs_approved_by_user_id_fkey_idx on customization.briefs (approved_by_user_id);
create index if not exists briefs_selected_candidate_id_fkey_idx on customization.briefs (selected_candidate_id);
create index if not exists briefs_source_asset_id_fkey_idx on customization.briefs (source_asset_id);
create index if not exists projects_conversation_id_fkey_idx on customization.projects (conversation_id);
create index if not exists projects_selected_brief_id_fkey_idx on customization.projects (selected_brief_id);
create index if not exists projects_selected_product_id_fkey_idx on customization.projects (selected_product_id);
create index if not exists projects_selected_render_candidate_id_fkey_idx on customization.projects (selected_render_candidate_id);
create index if not exists render_batches_created_by_user_id_fkey_idx on customization.render_batches (created_by_user_id);
create index if not exists render_batches_product_version_id_fkey_idx on customization.render_batches (product_version_id);
create index if not exists render_batches_source_asset_id_fkey_idx on customization.render_batches (source_asset_id);

create index if not exists messages_created_by_agent_run_id_fkey_idx on messaging.messages (created_by_agent_run_id);
create index if not exists thread_participants_agent_identity_id_fkey_idx on messaging.thread_participants (agent_identity_id);
create index if not exists threads_created_by_user_id_fkey_idx on messaging.threads (created_by_user_id);
create index if not exists reminders_order_id_fkey_idx on notifications.reminders (order_id);
create index if not exists reminders_user_id_fkey_idx on notifications.reminders (user_id);
create index if not exists payment_intents_wallet_account_id_fkey_idx on payments.payment_intents (wallet_account_id);
create index if not exists agent_delegation_policies_goal_id_fkey_idx on wallet.agent_delegation_policies (goal_id);

-- FOR ALL includes SELECT and caused duplicate permissive policy evaluation.
-- Keep the existing public SELECT policies and split seller writes by action.

drop policy if exists localizations_seller_all on catalog.product_localizations;
create policy localizations_seller_insert on catalog.product_localizations for insert to authenticated
  with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));
create policy localizations_seller_update on catalog.product_localizations for update to authenticated
  using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)))
  with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));
create policy localizations_seller_delete on catalog.product_localizations for delete to authenticated
  using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));

drop policy if exists variants_seller_all on catalog.product_variants;
create policy variants_seller_insert on catalog.product_variants for insert to authenticated
  with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));
create policy variants_seller_update on catalog.product_variants for update to authenticated
  using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)))
  with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));
create policy variants_seller_delete on catalog.product_variants for delete to authenticated
  using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));

drop policy if exists prices_seller_all on catalog.price_rules;
create policy prices_seller_insert on catalog.price_rules for insert to authenticated
  with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));
create policy prices_seller_update on catalog.price_rules for update to authenticated
  using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)))
  with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));
create policy prices_seller_delete on catalog.price_rules for delete to authenticated
  using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));

drop policy if exists product_terms_seller_all on catalog.product_terms;
create policy product_terms_seller_insert on catalog.product_terms for insert to authenticated
  with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));
create policy product_terms_seller_update on catalog.product_terms for update to authenticated
  using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)))
  with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));
create policy product_terms_seller_delete on catalog.product_terms for delete to authenticated
  using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));

drop policy if exists product_customizations_seller_all on catalog.product_customizations;
create policy product_customizations_seller_insert on catalog.product_customizations for insert to authenticated
  with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));
create policy product_customizations_seller_update on catalog.product_customizations for update to authenticated
  using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)))
  with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));
create policy product_customizations_seller_delete on catalog.product_customizations for delete to authenticated
  using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));

drop policy if exists product_media_seller_all on catalog.product_media;
create policy product_media_seller_insert on catalog.product_media for insert to authenticated
  with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));
create policy product_media_seller_update on catalog.product_media for update to authenticated
  using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)))
  with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));
create policy product_media_seller_delete on catalog.product_media for delete to authenticated
  using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));

drop policy if exists projects_owner_all on customization.projects;
create policy projects_owner_insert on customization.projects for insert to authenticated
  with check (owner_user_id = (select auth.uid()));
create policy projects_owner_update on customization.projects for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));
create policy projects_owner_delete on customization.projects for delete to authenticated
  using (owner_user_id = (select auth.uid()));
