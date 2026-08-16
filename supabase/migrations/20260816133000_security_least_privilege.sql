-- Additive, reversible least-privilege hardening for production.
-- Does not drop tables, columns, buckets, or data.
-- Rollback notes are at the bottom of this file.

begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce(auth.jwt() ->> 'email', '')));
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where lower(au.email) = public.current_user_email()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function public.is_own_credit_row(
  p_user_id uuid,
  p_user_convex_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      p_user_id = auth.uid()
      or (
        p_user_convex_id is not null
        and lower(trim(p_user_convex_id)) = public.current_user_email()
        and public.current_user_email() <> ''
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- Additive columns / tables (no drops)
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists metadata jsonb default '{}'::jsonb;

alter table public.orders
  add column if not exists stripe_event_id text,
  add column if not exists metadata jsonb default '{}'::jsonb;

create table if not exists public.processed_stripe_events (
  event_id text primary key,
  event_type text,
  stripe_session_id text,
  processed_at timestamptz not null default now(),
  result jsonb default '{}'::jsonb
);

create table if not exists public.edge_rate_limits (
  rate_key text primary key,
  window_start timestamptz not null default now(),
  hit_count integer not null default 0
);

alter table public.processed_stripe_events enable row level security;
alter table public.edge_rate_limits enable row level security;

create unique index if not exists orders_stripe_session_uidx
  on public.orders (stripe_session_id)
  where stripe_session_id is not null and length(trim(stripe_session_id)) > 0;

create unique index if not exists credits_ledger_stripe_note_uidx
  on public.credits_ledger (note)
  where note like 'stripe:%';

create unique index if not exists credits_ledger_generation_note_uidx
  on public.credits_ledger (note)
  where note like 'generation:%';

create unique index if not exists credits_ledger_invoice_note_uidx
  on public.credits_ledger (note)
  where note like 'stripe_invoice:%';

-- Credit packs used by the website (server-side amounts; never trust the client).
insert into public.pricing_items (
  key, category, name, description, price_cents, currency, credits, active, is_active, sort_order
)
values
  ('starter', 'credits', 'Starter', 'One-time credit pack', 498, 'eur', 110, true, true, 10),
  ('creator', 'credits', 'Creator', 'One-time credit pack', 998, 'eur', 300, true, true, 11),
  ('pro', 'credits', 'Pro', 'One-time credit pack', 7898, 'eur', 4600, true, true, 12),
  ('enterprise', 'credits', 'Enterprise', 'One-time credit pack', 49998, 'eur', 60000, true, true, 13)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Views: invoke as the caller so underlying RLS applies
-- ---------------------------------------------------------------------------
alter view public.client_dashboard_summary set (security_invoker = true);
alter view public.orders_admin_view set (security_invoker = true);
alter view public.credits_admin_view set (security_invoker = true);
alter view public.customers_admin_view_unified set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- Tighten security-definer RPCs
-- ---------------------------------------------------------------------------
create or replace function public.get_result_page_generation(
  p_session_id text,
  p_generation_id uuid default null
)
returns table (
  id uuid,
  status text,
  final_image_url text,
  result_image_url text,
  preview_image_url text,
  source_image_url text,
  template_id uuid,
  style_id text,
  style_slug text,
  prompt text,
  error text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    g.id, g.status, g.final_image_url, g.result_image_url, g.preview_image_url,
    g.source_image_url, g.template_id, g.style_id, g.style_slug, g.prompt, g.error,
    g.created_at, g.updated_at
  from public.generations g
  where p_session_id is not null
    and length(trim(p_session_id)) > 8
    and (
      g.stripe_session_id = trim(p_session_id)
      or g.checkout_session_id = trim(p_session_id)
      or (g.metadata->>'session_id') = trim(p_session_id)
      or (g.metadata->>'stripe_session_id') = trim(p_session_id)
    )
    and (p_generation_id is null or g.id = p_generation_id)
  order by g.created_at desc
  limit 1;
$$;

create or replace function public.get_upgrade_result_by_checkout_session(
  p_checkout_session_id text
)
returns table (
  fulfillment_id uuid,
  generation_id uuid,
  action_type text,
  fulfillment_status text,
  output_generation_id uuid,
  output_image_url text,
  final_image_url text,
  generation_status text,
  generation_created_at timestamptz,
  generation_updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    uf.id as fulfillment_id,
    uf.generation_id,
    uf.action_type,
    uf.fulfillment_status,
    uf.output_generation_id,
    uf.output_image_url,
    coalesce(og.final_image_url, og.result_image_url, g.final_image_url, g.result_image_url) as final_image_url,
    coalesce(og.status, g.status) as generation_status,
    coalesce(og.created_at, g.created_at) as generation_created_at,
    coalesce(og.updated_at, g.updated_at) as generation_updated_at
  from public.upgrade_fulfillments uf
  left join public.generations g on g.id = uf.generation_id
  left join public.generations og on og.id = uf.output_generation_id
  where p_checkout_session_id is not null
    and length(trim(p_checkout_session_id)) > 8
    and uf.checkout_session_id = trim(p_checkout_session_id)
  limit 1;
$$;

create or replace function public.upsert_funnel_lead(
  p_email text,
  p_occasion text default null,
  p_style_id text default null,
  p_funnel_slug text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  lead_id uuid;
begin
  normalized := lower(trim(coalesce(p_email, '')));
  if normalized = '' or position('@' in normalized) = 0 then
    raise exception 'email required';
  end if;

  insert into public.funnel_leads (email, occasion, style_id, funnel_slug, updated_at)
  values (
    normalized,
    nullif(trim(coalesce(p_occasion, '')), ''),
    nullif(trim(coalesce(p_style_id, '')), ''),
    nullif(trim(coalesce(p_funnel_slug, '')), ''),
    now()
  )
  on conflict (email) do update
    set occasion = coalesce(excluded.occasion, public.funnel_leads.occasion),
        style_id = coalesce(excluded.style_id, public.funnel_leads.style_id),
        funnel_slug = coalesce(excluded.funnel_slug, public.funnel_leads.funnel_slug),
        updated_at = now()
  returning id into lead_id;

  return lead_id;
end;
$$;

create or replace function public.unsubscribe_marketing(
  p_email text default null,
  p_user_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
begin
  normalized := lower(trim(coalesce(p_email, '')));
  if p_user_id is null and normalized = '' then
    raise exception 'email or user_id required';
  end if;

  if p_user_id is not null then
    insert into public.email_preferences (user_id, email, marketing, updated_at)
    values (p_user_id, nullif(normalized, ''), false, now())
    on conflict (user_id) do update
      set marketing = false, updated_at = now(), email = coalesce(excluded.email, public.email_preferences.email);
    return true;
  end if;

  insert into public.email_preferences (email, marketing, updated_at)
  values (normalized, false, now())
  on conflict (email) do update
    set marketing = false, updated_at = now();
  return true;
end;
$$;

create or replace function public.lookup_affiliate_promo(p_code text)
returns table (
  code text,
  discount_percent numeric,
  affiliate_user_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized text;
begin
  normalized := upper(trim(coalesce(p_code, '')));
  if normalized = '' then
    return;
  end if;

  return query
  select
    coalesce(nullif(trim(c.code), ''), normalized),
    coalesce(c.discount_percent, 0),
    c.user_id
  from public.affiliate_codes c
  where upper(trim(c.code)) = normalized
    and coalesce(c.active, false) = true
    and (c.max_uses is null or c.max_uses <= 0 or coalesce(c.times_used, 0) < c.max_uses)
  limit 1;

  if found then
    return;
  end if;

  return query
  select
    coalesce(nullif(trim(p.affiliate_code), ''), nullif(trim(p.referral_slug), ''), normalized),
    10::numeric,
    p.user_id
  from public.affiliate_profiles p
  where upper(trim(coalesce(p.affiliate_code, ''))) = normalized
     or upper(trim(coalesce(p.referral_slug, ''))) = normalized
  limit 1;
end;
$$;

create or replace function public.load_support_thread(p_ticket_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ticket public.support_tickets%rowtype;
  can_read boolean;
begin
  if p_ticket_id is null then
    return null;
  end if;

  select * into ticket from public.support_tickets where id = p_ticket_id;
  if not found then
    return null;
  end if;

  can_read :=
    public.is_admin()
    or (auth.uid() is not null and ticket.user_id = auth.uid())
    or (auth.uid() is null and ticket.user_id is null);

  if not can_read then
    return null;
  end if;

  return jsonb_build_object(
    'ticket', to_jsonb(ticket),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at)
      from public.support_ticket_messages m
      where m.ticket_id = ticket.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.touch_edge_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.edge_rate_limits%rowtype;
  allowed boolean;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    return false;
  end if;

  insert into public.edge_rate_limits (rate_key, window_start, hit_count)
  values (trim(p_key), now(), 1)
  on conflict (rate_key) do update
    set hit_count = case
      when public.edge_rate_limits.window_start < now() - make_interval(secs => greatest(p_window_seconds, 1))
        then 1
      else public.edge_rate_limits.hit_count + 1
    end,
        window_start = case
      when public.edge_rate_limits.window_start < now() - make_interval(secs => greatest(p_window_seconds, 1))
        then now()
      else public.edge_rate_limits.window_start
    end
  returning * into rec;

  allowed := rec.hit_count <= greatest(p_limit, 1);
  return allowed;
end;
$$;

create or replace function public.fulfill_paid_checkout(
  p_event_id text,
  p_session_id text,
  p_event_type text,
  p_email text,
  p_user_id uuid,
  p_pack text,
  p_product_type text,
  p_credits integer,
  p_amount_cents integer,
  p_currency text,
  p_mode text,
  p_customer_id text,
  p_subscription_id text,
  p_generation_id uuid,
  p_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.processed_stripe_events%rowtype;
  order_row public.orders%rowtype;
  email_norm text;
  credits_to_grant integer;
  note_text text;
begin
  if p_event_id is null or length(trim(p_event_id)) = 0 then
    raise exception 'event_id required';
  end if;

  select * into existing
  from public.processed_stripe_events
  where event_id = trim(p_event_id);

  if found then
    return jsonb_build_object('status', 'already_processed', 'event_id', existing.event_id, 'result', existing.result);
  end if;

  email_norm := lower(trim(coalesce(p_email, '')));
  credits_to_grant := greatest(coalesce(p_credits, 0), 0);
  note_text := 'stripe:' || trim(coalesce(p_session_id, p_event_id));

  if p_session_id is not null and length(trim(p_session_id)) > 0 then
    select * into order_row from public.orders where stripe_session_id = trim(p_session_id);
  end if;

  if not found then
    insert into public.orders (
      user_id, email, amount, amount_total_cents, currency, pack, product_type,
      status, credits_granted, stripe_session_id, stripe_event_id, metadata
    ) values (
      p_user_id,
      nullif(email_norm, ''),
      coalesce(p_amount_cents, 0) / 100.0,
      coalesce(p_amount_cents, 0),
      coalesce(nullif(trim(p_currency), ''), 'eur'),
      nullif(trim(coalesce(p_pack, '')), ''),
      coalesce(nullif(trim(p_product_type), ''), p_mode),
      'completed',
      credits_to_grant,
      nullif(trim(coalesce(p_session_id, '')), ''),
      trim(p_event_id),
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning * into order_row;
  else
    update public.orders
    set status = 'completed',
        credits_granted = coalesce(credits_granted, credits_to_grant),
        stripe_event_id = trim(p_event_id)
    where id = order_row.id;
  end if;

  if credits_to_grant > 0 and email_norm <> '' then
    if not exists (
      select 1 from public.credits_ledger cl where cl.note = note_text
    ) then
      insert into public.credits_ledger (
        user_convex_id, user_id, direction, credits, event_type, category,
        amount, currency, note, order_convex_id
      ) values (
        email_norm,
        p_user_id,
        'in',
        credits_to_grant,
        'stripe',
        coalesce(nullif(trim(p_product_type), ''), 'credits'),
        coalesce(p_amount_cents, 0) / 100.0,
        coalesce(nullif(trim(p_currency), ''), 'eur'),
        note_text,
        order_row.id::text
      );
    end if;
  end if;

  if coalesce(p_mode, '') = 'subscription' and p_user_id is not null then
    insert into public.customers (
      user_id, email, subscription_status, stripe_customer_id, stripe_subscription_id, metadata
    )
    values (
      p_user_id,
      nullif(email_norm, ''),
      'active',
      nullif(trim(coalesce(p_customer_id, '')), ''),
      nullif(trim(coalesce(p_subscription_id, '')), ''),
      coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (user_id) do update
      set email = coalesce(excluded.email, public.customers.email),
          subscription_status = 'active',
          cancel_at_period_end = false,
          stripe_customer_id = coalesce(excluded.stripe_customer_id, public.customers.stripe_customer_id),
          stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.customers.stripe_subscription_id),
          metadata = coalesce(excluded.metadata, public.customers.metadata);
  end if;

  if p_generation_id is not null then
    update public.generations
    set stripe_session_id = coalesce(stripe_session_id, nullif(trim(coalesce(p_session_id, '')), '')),
        checkout_session_id = coalesce(checkout_session_id, nullif(trim(coalesce(p_session_id, '')), '')),
        email = coalesce(email, nullif(email_norm, '')),
        user_id = coalesce(user_id, p_user_id),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('payment_status', 'paid', 'stripe_event_id', trim(p_event_id))
    where id = p_generation_id;
  end if;

  insert into public.processed_stripe_events (event_id, event_type, stripe_session_id, result)
  values (
    trim(p_event_id),
    nullif(trim(coalesce(p_event_type, '')), ''),
    nullif(trim(coalesce(p_session_id, '')), ''),
    jsonb_build_object(
      'status', 'fulfilled',
      'order_id', order_row.id,
      'credits_granted', credits_to_grant
    )
  )
  on conflict (event_id) do nothing;

  return jsonb_build_object(
    'status', 'fulfilled',
    'order_id', order_row.id,
    'credits_granted', credits_to_grant
  );
exception
  when unique_violation then
    select * into existing from public.processed_stripe_events where event_id = trim(p_event_id);
    if found then
      return jsonb_build_object('status', 'already_processed', 'event_id', existing.event_id, 'result', existing.result);
    end if;
    raise;
end;
$$;

-- ---------------------------------------------------------------------------
-- Drop overly-permissive policies, then recreate least-privilege ones
-- ---------------------------------------------------------------------------
drop policy if exists admin_users_read on public.admin_users;
drop policy if exists app_users_read on public.app_users;
drop policy if exists credits_own_read on public.credits_ledger;
drop policy if exists customers_own on public.customers;
drop policy if exists orders_read on public.orders;
drop policy if exists generations_select on public.generations;
drop policy if exists generations_insert on public.generations;
drop policy if exists generations_update on public.generations;
drop policy if exists jobs_read on public.jobs;
drop policy if exists upgrades_read on public.upgrade_fulfillments;
drop policy if exists funnel_leads_upsert on public.funnel_leads;
drop policy if exists support_tickets_all on public.support_tickets;
drop policy if exists support_msgs_all on public.support_ticket_messages;
drop policy if exists email_prefs_own on public.email_preferences;
drop policy if exists email_offers_read on public.email_offers;
drop policy if exists aff_clicks_read on public.affiliate_clicks;
drop policy if exists aff_codes_read on public.affiliate_codes;
drop policy if exists aff_conv_insert on public.affiliate_conversions;
drop policy if exists aff_wd_insert on public.affiliate_withdrawals;

create policy admin_users_self_read on public.admin_users
  for select using (
    public.is_admin()
    or (public.current_user_email() <> '' and lower(email) = public.current_user_email())
  );

create policy app_users_own_read on public.app_users
  for select using (
    public.is_admin()
    or (public.current_user_email() <> '' and lower(email) = public.current_user_email())
  );

create policy credits_own_read on public.credits_ledger
  for select using (
    public.is_admin()
    or public.is_own_credit_row(user_id, user_convex_id)
  );

create policy customers_own on public.customers
  for select using (user_id = auth.uid() or public.is_admin());

create policy customers_own_update on public.customers
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy orders_own_read on public.orders
  for select using (
    public.is_admin()
    or user_id = auth.uid()
    or (public.current_user_email() <> '' and lower(coalesce(email, '')) = public.current_user_email())
  );

create policy generations_select on public.generations
  for select using (
    public.is_admin()
    or user_id = auth.uid()
    or (public.current_user_email() <> '' and lower(coalesce(email, '')) = public.current_user_email())
  );

create policy generations_insert on public.generations
  for insert with check (
    auth.uid() is not null
    and (user_id = auth.uid() or user_id is null)
  );

create policy generations_update on public.generations
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin() or user_id is null);

create policy jobs_own_read on public.jobs
  for select using (user_id = auth.uid() or public.is_admin());

create policy upgrades_own_or_admin on public.upgrade_fulfillments
  for select using (public.is_admin());

create policy funnel_leads_insert on public.funnel_leads
  for insert with check (email is not null and length(trim(email)) > 3);

create policy funnel_leads_admin on public.funnel_leads
  for all using (public.is_admin()) with check (public.is_admin());

create policy support_tickets_select on public.support_tickets
  for select using (user_id = auth.uid() or public.is_admin());

create policy support_tickets_insert on public.support_tickets
  for insert with check (
    user_id = auth.uid()
    or (auth.uid() is null and user_id is null)
  );

create policy support_tickets_update on public.support_tickets
  for update using (user_id = auth.uid() or public.is_admin() or (auth.uid() is null and user_id is null))
  with check (user_id = auth.uid() or public.is_admin() or (auth.uid() is null and user_id is null));

create policy support_msgs_select on public.support_ticket_messages
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.user_id = auth.uid()
    )
  );

create policy support_msgs_insert on public.support_ticket_messages
  for insert with check (
    public.is_admin()
    or exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and (t.user_id = auth.uid() or (auth.uid() is null and t.user_id is null))
    )
  );

create policy email_prefs_own on public.email_preferences
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy email_offers_admin_read on public.email_offers
  for select using (public.is_admin());

create policy aff_codes_public_read on public.affiliate_codes
  for select using (coalesce(active, false) = true);

create policy aff_clicks_admin_read on public.affiliate_clicks
  for select using (public.is_admin());

create policy aff_conv_insert on public.affiliate_conversions
  for insert with check (auth.uid() is not null and user_id = auth.uid());

create policy aff_wd_insert on public.affiliate_withdrawals
  for insert with check (affiliate_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants: revoke blanket ALL, then grant least privilege
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated, public;
revoke all on all functions in schema public from anon, authenticated, public;

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- Public catalog / marketing reads
grant select on public.templates, public.occasions, public.occasion_collections,
  public.pricing_items, public.seo_pages, public.blog_posts, public.affiliate_codes
  to anon, authenticated;

-- Authenticated self-service
grant select on public.generations, public.jobs, public.profiles, public.user_profiles,
  public.app_users, public.admin_users, public.customers, public.credits_ledger,
  public.orders, public.affiliate_profiles, public.affiliate_conversions,
  public.affiliate_earnings, public.affiliate_withdrawals, public.support_tickets,
  public.support_ticket_messages, public.email_preferences, public.client_dashboard_summary
  to authenticated;

grant select, insert, update on public.profiles, public.user_profiles, public.affiliate_profiles
  to authenticated;
grant insert, update on public.generations to authenticated;
grant insert on public.affiliate_clicks, public.affiliate_conversions, public.affiliate_withdrawals,
  public.support_tickets, public.support_ticket_messages, public.funnel_leads
  to authenticated;
grant update on public.support_tickets, public.customers, public.email_preferences
  to authenticated;

-- Admin-only views: authenticated may query; RLS/security_invoker hides non-admin rows
grant select on public.orders_admin_view, public.credits_admin_view,
  public.customers_admin_view_unified, public.email_offers, public.email_templates,
  public.upgrade_fulfillments, public.funnel_leads
  to authenticated;

grant insert, update, delete on public.templates, public.occasions, public.occasion_collections,
  public.pricing_items, public.seo_pages, public.blog_posts, public.email_offers,
  public.email_templates
  to authenticated;

-- Anonymous funnel / support / tracking
grant insert on public.affiliate_clicks, public.funnel_leads, public.support_tickets,
  public.support_ticket_messages
  to anon;
grant update on public.support_tickets to anon;

grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.current_user_email() to anon, authenticated, service_role;
grant execute on function public.is_own_credit_row(uuid, text) to authenticated, service_role;
grant execute on function public.get_result_page_generation(text, uuid) to anon, authenticated, service_role;
grant execute on function public.get_upgrade_result_by_checkout_session(text) to anon, authenticated, service_role;
grant execute on function public.upsert_funnel_lead(text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.unsubscribe_marketing(text, uuid) to anon, authenticated, service_role;
grant execute on function public.lookup_affiliate_promo(text) to anon, authenticated, service_role;
grant execute on function public.load_support_thread(uuid) to anon, authenticated, service_role;
grant execute on function public.touch_edge_rate_limit(text, integer, integer) to service_role;
grant execute on function public.fulfill_paid_checkout(text, text, text, text, uuid, text, text, integer, integer, text, text, text, text, uuid, jsonb) to service_role;

revoke all on table public.processed_stripe_events from anon, authenticated, public;
revoke all on table public.edge_rate_limits from anon, authenticated, public;
grant all on table public.processed_stripe_events to service_role;
grant all on table public.edge_rate_limits to service_role;

alter default privileges in schema public revoke all on tables from anon, authenticated, public;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- ---------------------------------------------------------------------------
-- Storage: keep public reads; stop anonymous writes to catalog/generated buckets
-- ---------------------------------------------------------------------------
drop policy if exists "Anon upload templates" on storage.objects;
drop policy if exists "Auth upload generated-images" on storage.objects;
drop policy if exists "Auth update own objects" on storage.objects;
drop policy if exists "Auth delete own objects" on storage.objects;

create policy "Auth upload generated-images"
on storage.objects for insert
with check (
  bucket_id = 'generated-images'
  and auth.role() = 'authenticated'
);

create policy "Auth update own objects"
on storage.objects for update
using (
  auth.role() = 'authenticated'
  and (owner = auth.uid() or public.is_admin())
)
with check (
  auth.role() = 'authenticated'
  and (owner = auth.uid() or public.is_admin())
);

create policy "Auth delete own objects"
on storage.objects for delete
using (
  auth.role() = 'authenticated'
  and (owner = auth.uid() or public.is_admin())
);

commit;

-- Rollback (manual): restore previous policies from
-- supabase/backups/2026-08-16_production_schema.sql and re-grant ALL to
-- anon/authenticated if you must revert. No data is deleted by this migration.
