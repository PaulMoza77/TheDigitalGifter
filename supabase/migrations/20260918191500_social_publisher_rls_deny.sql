-- Deny-all client policies. Service role bypasses RLS; PostgREST must not read tokens.

begin;

create policy social_publisher_settings_no_client
  on public.social_publisher_settings for all using (false) with check (false);
create policy social_accounts_no_client
  on public.social_accounts for all using (false) with check (false);
create policy social_oauth_states_no_client
  on public.social_oauth_states for all using (false) with check (false);
create policy social_publications_no_client
  on public.social_publications for all using (false) with check (false);
create policy social_publication_targets_no_client
  on public.social_publication_targets for all using (false) with check (false);
create policy social_auto_queues_no_client
  on public.social_auto_queues for all using (false) with check (false);
create policy social_auto_queue_items_no_client
  on public.social_auto_queue_items for all using (false) with check (false);

commit;
