create or replace function catalog.has_maker_role(target_maker_id bigint, accepted_roles text[] default array['owner','manager','catalog_editor','order_manager','viewer'])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from catalog.maker_memberships mm
    where mm.maker_id = target_maker_id
      and mm.user_id = (select auth.uid())
      and mm.status = 'active'
      and mm.role = any(accepted_roles)
  )
$$;

create or replace function catalog.can_edit_product(target_product_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from catalog.products p
    where p.id = target_product_id
      and catalog.has_maker_role(p.maker_id, array['owner','manager','catalog_editor'])
  )
$$;

alter table public.profiles enable row level security;
alter table catalog.makers enable row level security;
alter table catalog.maker_memberships enable row level security;
alter table catalog.products enable row level security;
alter table catalog.product_versions enable row level security;
alter table catalog.product_localizations enable row level security;
alter table catalog.product_variants enable row level security;
alter table catalog.price_rules enable row level security;
alter table catalog.vocabularies enable row level security;
alter table catalog.terms enable row level security;
alter table catalog.term_localizations enable row level security;
alter table catalog.term_synonyms enable row level security;
alter table catalog.product_terms enable row level security;
alter table catalog.customization_definitions enable row level security;
alter table catalog.product_customizations enable row level security;
alter table catalog.media_assets enable row level security;
alter table catalog.product_media enable row level security;
alter table catalog.import_jobs enable row level security;
alter table catalog.import_rows enable row level security;
alter table catalog.validation_issues enable row level security;
alter table catalog.field_provenance enable row level security;
alter table commerce.quote_requests enable row level security;
alter table commerce.quote_request_items enable row level security;
alter table commerce.quote_versions enable row level security;
alter table commerce.invoices enable row level security;
alter table commerce.orders enable row level security;
alter table commerce.order_status_history enable row level security;
alter table wallet.accounts enable row level security;
alter table wallet.delegations enable row level security;
alter table payments.payment_intents enable row level security;
alter table payments.transactions enable row level security;
alter table agent.conversations enable row level security;
alter table agent.messages enable row level security;
alter table agent.tool_calls enable row level security;
alter table notifications.reminders enable row level security;
alter table search.product_documents enable row level security;

create policy profiles_own_select on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_own_update on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy makers_public_select on catalog.makers for select to anon, authenticated using (verification_status = 'verified' or catalog.has_maker_role(id));
create policy makers_member_update on catalog.makers for update to authenticated using (catalog.has_maker_role(id, array['owner','manager'])) with check (catalog.has_maker_role(id, array['owner','manager']));
create policy memberships_member_select on catalog.maker_memberships for select to authenticated using (user_id = (select auth.uid()) or catalog.has_maker_role(maker_id, array['owner','manager']));

create policy products_public_select on catalog.products for select to anon, authenticated using (status = 'published' or catalog.has_maker_role(maker_id));
create policy products_seller_insert on catalog.products for insert to authenticated with check (catalog.has_maker_role(maker_id, array['owner','manager','catalog_editor']));
create policy products_seller_update on catalog.products for update to authenticated using (catalog.has_maker_role(maker_id, array['owner','manager','catalog_editor'])) with check (catalog.has_maker_role(maker_id, array['owner','manager','catalog_editor']));

create policy versions_public_select on catalog.product_versions for select to anon, authenticated using (
  workflow_status = 'published' or catalog.can_edit_product(product_id)
);
create policy versions_seller_insert on catalog.product_versions for insert to authenticated with check (catalog.can_edit_product(product_id));
create policy versions_seller_update on catalog.product_versions for update to authenticated using (catalog.can_edit_product(product_id) and workflow_status in ('draft','validation_failed','ready_for_review','rejected')) with check (catalog.can_edit_product(product_id));

create policy localizations_public_select on catalog.product_localizations for select to anon, authenticated using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and (pv.workflow_status = 'published' or catalog.can_edit_product(pv.product_id))));
create policy localizations_seller_all on catalog.product_localizations for all to authenticated using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id))) with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));

create policy variants_public_select on catalog.product_variants for select to anon, authenticated using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and (pv.workflow_status = 'published' or catalog.can_edit_product(pv.product_id))));
create policy variants_seller_all on catalog.product_variants for all to authenticated using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id))) with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));

create policy prices_public_select on catalog.price_rules for select to anon, authenticated using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and (pv.workflow_status = 'published' or catalog.can_edit_product(pv.product_id))));
create policy prices_seller_all on catalog.price_rules for all to authenticated using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id))) with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));

create policy vocabularies_read on catalog.vocabularies for select to anon, authenticated using (true);
create policy terms_read on catalog.terms for select to anon, authenticated using (status = 'active');
create policy term_localizations_read on catalog.term_localizations for select to anon, authenticated using (true);
create policy term_synonyms_read on catalog.term_synonyms for select to anon, authenticated using (true);
create policy customizations_read on catalog.customization_definitions for select to anon, authenticated using (true);

create policy product_terms_public_select on catalog.product_terms for select to anon, authenticated using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and (pv.workflow_status = 'published' or catalog.can_edit_product(pv.product_id))));
create policy product_terms_seller_all on catalog.product_terms for all to authenticated using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id))) with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));
create policy product_customizations_public_select on catalog.product_customizations for select to anon, authenticated using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and (pv.workflow_status = 'published' or catalog.can_edit_product(pv.product_id))));
create policy product_customizations_seller_all on catalog.product_customizations for all to authenticated using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id))) with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));

create policy media_assets_member_select on catalog.media_assets for select to authenticated using (catalog.has_maker_role(maker_id));
create policy media_assets_member_insert on catalog.media_assets for insert to authenticated with check (catalog.has_maker_role(maker_id, array['owner','manager','catalog_editor']));
create policy media_assets_member_update on catalog.media_assets for update to authenticated using (catalog.has_maker_role(maker_id, array['owner','manager','catalog_editor'])) with check (catalog.has_maker_role(maker_id, array['owner','manager','catalog_editor']));
create policy product_media_public_select on catalog.product_media for select to anon, authenticated using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and (pv.workflow_status = 'published' or catalog.can_edit_product(pv.product_id))));
create policy product_media_seller_all on catalog.product_media for all to authenticated using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id))) with check (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));

create policy import_jobs_member_all on catalog.import_jobs for all to authenticated using (catalog.has_maker_role(maker_id, array['owner','manager','catalog_editor'])) with check (catalog.has_maker_role(maker_id, array['owner','manager','catalog_editor']));
create policy import_rows_member_all on catalog.import_rows for all to authenticated using (exists (select 1 from catalog.import_jobs j where j.id = import_job_id and catalog.has_maker_role(j.maker_id, array['owner','manager','catalog_editor']))) with check (exists (select 1 from catalog.import_jobs j where j.id = import_job_id and catalog.has_maker_role(j.maker_id, array['owner','manager','catalog_editor'])));
create policy validation_issues_member_select on catalog.validation_issues for select to authenticated using (catalog.has_maker_role(maker_id));
create policy provenance_member_select on catalog.field_provenance for select to authenticated using (exists (select 1 from catalog.product_versions pv where pv.id = product_version_id and catalog.can_edit_product(pv.product_id)));

create policy quote_requests_participant_select on commerce.quote_requests for select to authenticated using (buyer_id = (select auth.uid()) or catalog.has_maker_role(maker_id));
create policy quote_requests_buyer_insert on commerce.quote_requests for insert to authenticated with check (buyer_id = (select auth.uid()));
create policy quote_requests_participant_update on commerce.quote_requests for update to authenticated using (buyer_id = (select auth.uid()) or catalog.has_maker_role(maker_id, array['owner','manager','order_manager'])) with check (buyer_id = (select auth.uid()) or catalog.has_maker_role(maker_id, array['owner','manager','order_manager']));
create policy quote_items_participant_select on commerce.quote_request_items for select to authenticated using (exists (select 1 from commerce.quote_requests qr where qr.id = quote_request_id and (qr.buyer_id = (select auth.uid()) or catalog.has_maker_role(qr.maker_id))));
create policy quote_items_buyer_insert on commerce.quote_request_items for insert to authenticated with check (exists (select 1 from commerce.quote_requests qr where qr.id = quote_request_id and qr.buyer_id = (select auth.uid()) and qr.status = 'draft'));
create policy quote_versions_participant_select on commerce.quote_versions for select to authenticated using (exists (select 1 from commerce.quote_requests qr where qr.id = quote_request_id and (qr.buyer_id = (select auth.uid()) or catalog.has_maker_role(qr.maker_id))));
create policy invoices_participant_select on commerce.invoices for select to authenticated using (buyer_id = (select auth.uid()) or catalog.has_maker_role(maker_id));
create policy orders_participant_select on commerce.orders for select to authenticated using (buyer_id = (select auth.uid()) or catalog.has_maker_role(maker_id));
create policy order_history_participant_select on commerce.order_status_history for select to authenticated using (exists (select 1 from commerce.orders o where o.id = order_id and (o.buyer_id = (select auth.uid()) or catalog.has_maker_role(o.maker_id))));

create policy wallet_accounts_own_all on wallet.accounts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy wallet_delegations_own_select on wallet.delegations for select to authenticated using (exists (select 1 from wallet.accounts wa where wa.id = wallet_account_id and wa.user_id = (select auth.uid())));
create policy wallet_delegations_own_insert on wallet.delegations for insert to authenticated with check (exists (select 1 from wallet.accounts wa where wa.id = wallet_account_id and wa.user_id = (select auth.uid())));
create policy wallet_delegations_own_update on wallet.delegations for update to authenticated using (exists (select 1 from wallet.accounts wa where wa.id = wallet_account_id and wa.user_id = (select auth.uid()))) with check (exists (select 1 from wallet.accounts wa where wa.id = wallet_account_id and wa.user_id = (select auth.uid())));

create policy payment_intents_participant_select on payments.payment_intents for select to authenticated using (exists (select 1 from commerce.invoices i where i.id = invoice_id and (i.buyer_id = (select auth.uid()) or catalog.has_maker_role(i.maker_id))));
create policy transactions_participant_select on payments.transactions for select to authenticated using (exists (select 1 from payments.payment_intents pi join commerce.invoices i on i.id = pi.invoice_id where pi.id = payment_intent_id and (i.buyer_id = (select auth.uid()) or catalog.has_maker_role(i.maker_id))));

create policy conversations_own_all on agent.conversations for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy messages_own_select on agent.messages for select to authenticated using (exists (select 1 from agent.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));
create policy messages_own_insert on agent.messages for insert to authenticated with check (exists (select 1 from agent.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));
create policy tool_calls_own_select on agent.tool_calls for select to authenticated using (exists (select 1 from agent.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));
create policy reminders_own_select on notifications.reminders for select to authenticated using (user_id = (select auth.uid()));
create policy reminders_own_update on notifications.reminders for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy product_documents_public_select on search.product_documents for select to anon, authenticated using (exists (select 1 from catalog.products p where p.id = product_id and p.status = 'published' and p.published_version_id = product_version_id));

grant usage on schema catalog, search to anon;
grant usage on schema catalog, commerce, agent, wallet, payments, search, notifications to authenticated;
grant select on public.published_products to anon, authenticated;
grant execute on function public.search_published_products(text, text, integer, numeric, integer, integer) to anon, authenticated;
grant select on catalog.makers, catalog.products, catalog.product_versions, catalog.product_localizations, catalog.product_variants, catalog.price_rules, catalog.vocabularies, catalog.terms, catalog.term_localizations, catalog.term_synonyms, catalog.product_terms, catalog.customization_definitions, catalog.product_customizations, catalog.product_media to anon, authenticated;
grant select, insert, update on catalog.makers, catalog.maker_memberships, catalog.products, catalog.product_versions, catalog.product_localizations, catalog.product_variants, catalog.price_rules, catalog.product_terms, catalog.product_customizations, catalog.media_assets, catalog.product_media, catalog.import_jobs, catalog.import_rows to authenticated;
grant select on catalog.validation_issues, catalog.field_provenance to authenticated;
grant select, insert, update on commerce.quote_requests, commerce.quote_request_items to authenticated;
grant select on commerce.quote_versions, commerce.invoices, commerce.orders, commerce.order_status_history to authenticated;
grant select, insert, update on wallet.accounts, wallet.delegations to authenticated;
grant select on payments.payment_intents, payments.transactions to authenticated;
grant select, insert, update on agent.conversations, agent.messages to authenticated;
grant select on agent.tool_calls to authenticated;
grant select, update on notifications.reminders to authenticated;
grant select on search.product_documents to anon, authenticated;
grant usage, select on all sequences in schema catalog to authenticated;
grant usage, select on all sequences in schema commerce to authenticated;
grant usage, select on all sequences in schema agent to authenticated;

revoke execute on function catalog.publish_product_version(bigint) from public, anon;
grant execute on function catalog.publish_product_version(bigint) to authenticated;
