-- Memories V1 validation funnel (subscription early-access).
-- Parallel domain: does not alter christmas_* or pet_* tables.
-- Rollback: drop memories_* objects + storage bucket policies (see bottom comments).

begin;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.memories_customers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null,
  full_name text,
  stripe_customer_id text,
  marketing_opt_in boolean not null default false,
  processing_consent_at timestamptz,
  authority_ack_at timestamptz,
  user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memories_customers_email_chk check (position('@' in email) > 1)
);

create unique index if not exists memories_customers_email_norm_uidx
  on public.memories_customers (email_normalized);

create unique index if not exists memories_customers_stripe_uidx
  on public.memories_customers (stripe_customer_id)
  where stripe_customer_id is not null and length(trim(stripe_customer_id)) > 0;

create table if not exists public.memories_funnel_sessions (
  id uuid primary key default gen_random_uuid(),
  client_session_id uuid not null,
  customer_id uuid references public.memories_customers (id) on delete set null,
  step text not null default 'landing',
  selected_plan_key text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  campaign_id text,
  adset_id text,
  ad_id text,
  referrer_host text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memories_funnel_sessions_step_chk check (
    step in ('landing', 'create', 'email', 'preview', 'plans', 'checkout', 'success', 'waitlist')
  )
);

create unique index if not exists memories_funnel_sessions_client_uidx
  on public.memories_funnel_sessions (client_session_id);

create index if not exists memories_funnel_sessions_customer_idx
  on public.memories_funnel_sessions (customer_id, created_at desc);

create table if not exists public.memories_uploads (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.memories_funnel_sessions (id) on delete cascade,
  customer_id uuid references public.memories_customers (id) on delete set null,
  public_token_hash text not null,
  bucket text not null default 'memories-source-photos',
  object_path text not null,
  content_type text not null,
  file_name text,
  byte_size integer not null,
  status text not null default 'pending',
  confirmed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint memories_uploads_type_chk check (
    content_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  constraint memories_uploads_status_chk check (
    status in ('pending', 'uploaded', 'confirmed', 'deleted', 'failed')
  ),
  constraint memories_uploads_size_chk check (byte_size > 0 and byte_size <= 15728640)
);

create index if not exists memories_uploads_session_idx
  on public.memories_uploads (session_id, created_at desc);

create index if not exists memories_uploads_token_idx
  on public.memories_uploads (public_token_hash);

create table if not exists public.memories_orders (
  id uuid primary key default gen_random_uuid(),
  public_token_hash text not null,
  public_token_ciphertext text,
  session_id uuid references public.memories_funnel_sessions (id) on delete set null,
  customer_id uuid not null references public.memories_customers (id) on delete restrict,
  email text not null,
  email_normalized text not null,
  plan_key text not null,
  plan_sku text not null,
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'draft',
  payment_status text not null default 'unpaid',
  commercial_mode text not null default 'waitlist',
  stripe_checkout_session_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  refunded_at timestamptz,
  canceled_at timestamptz,
  fulfillment_status text not null default 'early_access_pending',
  is_test boolean not null default false,
  is_live_charge boolean not null default false,
  meta_event_id text not null default gen_random_uuid()::text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memories_orders_plan_chk check (plan_key in ('starter', 'plus', 'legacy')),
  constraint memories_orders_currency_chk check (currency = 'usd'),
  constraint memories_orders_status_chk check (
    status in (
      'draft',
      'awaiting_email',
      'awaiting_plan',
      'awaiting_payment',
      'waitlisted',
      'active',
      'past_due',
      'canceled',
      'refunded',
      'failed'
    )
  ),
  constraint memories_orders_payment_chk check (
    payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded', 'void')
  ),
  constraint memories_orders_mode_chk check (
    commercial_mode in ('waitlist', 'test', 'paid_early_access')
  ),
  constraint memories_orders_fulfillment_chk check (
    fulfillment_status in (
      'early_access_pending',
      'waitlisted',
      'subscribed_pending_product',
      'notified_available',
      'canceled'
    )
  )
);

create unique index if not exists memories_orders_token_uidx
  on public.memories_orders (public_token_hash);

create unique index if not exists memories_orders_stripe_session_uidx
  on public.memories_orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null
    and length(trim(stripe_checkout_session_id)) > 0;

create index if not exists memories_orders_email_idx
  on public.memories_orders (email_normalized, created_at desc);

create index if not exists memories_orders_status_idx
  on public.memories_orders (status, created_at desc);

create table if not exists public.memories_subscriptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.memories_orders (id) on delete cascade,
  customer_id uuid not null references public.memories_customers (id) on delete restrict,
  stripe_subscription_id text not null,
  stripe_customer_id text,
  stripe_price_id text,
  plan_key text not null,
  status text not null default 'incomplete',
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  latest_invoice_id text,
  latest_invoice_paid_at timestamptz,
  amount_cents integer not null default 0,
  currency text not null default 'usd',
  is_test boolean not null default false,
  is_live_charge boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memories_subscriptions_status_chk check (
    status in (
      'incomplete',
      'incomplete_expired',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'paused'
    )
  )
);

create unique index if not exists memories_subscriptions_stripe_uidx
  on public.memories_subscriptions (stripe_subscription_id);

create index if not exists memories_subscriptions_customer_idx
  on public.memories_subscriptions (customer_id, created_at desc);

create table if not exists public.memories_waitlist (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.memories_customers (id) on delete cascade,
  session_id uuid references public.memories_funnel_sessions (id) on delete set null,
  plan_key text,
  email_normalized text not null,
  source text not null default 'memories_funnel',
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint memories_waitlist_plan_chk check (
    plan_key is null or plan_key in ('starter', 'plus', 'legacy')
  )
);

create unique index if not exists memories_waitlist_email_uidx
  on public.memories_waitlist (email_normalized);

create table if not exists public.memories_funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  funnel_session_id uuid not null,
  event_id uuid,
  idempotency_key text not null,
  device_type text,
  pathname text,
  amount_cents integer,
  product text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  campaign_id text,
  adset_id text,
  ad_id text,
  has_meta_click boolean,
  referrer_host text,
  funnel_variant text not null default 'memories_v1',
  funnel_version text not null default 'memories_v1',
  failure_category text,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists memories_funnel_events_idem_uidx
  on public.memories_funnel_events (idempotency_key);

create index if not exists memories_funnel_events_session_idx
  on public.memories_funnel_events (funnel_session_id, created_at desc);

create index if not exists memories_funnel_events_name_idx
  on public.memories_funnel_events (event_name, created_at desc);

create table if not exists public.memories_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.memories_orders (id) on delete cascade,
  customer_id uuid references public.memories_customers (id) on delete set null,
  kind text not null,
  provider_message_id text,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  constraint memories_email_deliveries_kind_chk check (
    kind in (
      'early_access_registration',
      'checkout_confirmation',
      'subscription_confirmation',
      'payment_failed',
      'cancellation_confirmation',
      'refund_confirmation',
      'product_available'
    )
  ),
  constraint memories_email_deliveries_status_chk check (
    status in ('queued', 'sent', 'skipped', 'failed')
  )
);

create unique index if not exists memories_email_deliveries_order_kind_uidx
  on public.memories_email_deliveries (order_id, kind)
  where order_id is not null;

create table if not exists public.memories_milestones (
  id uuid primary key default gen_random_uuid(),
  milestone_key text not null,
  verified_at timestamptz not null default now(),
  order_id uuid references public.memories_orders (id) on delete set null,
  subscription_id uuid references public.memories_subscriptions (id) on delete set null,
  amount_cents integer,
  currency text,
  plan_key text,
  stripe_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint memories_milestones_key_chk check (
    milestone_key in ('MEMORIES_FIRST_SALE_VERIFIED')
  )
);

create unique index if not exists memories_milestones_key_uidx
  on public.memories_milestones (milestone_key);

-- ---------------------------------------------------------------------------
-- Storage (private by default)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memories-source-photos',
  'memories-source-photos',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS: deny direct client access; service role / security definer only
-- ---------------------------------------------------------------------------

alter table public.memories_customers enable row level security;
alter table public.memories_funnel_sessions enable row level security;
alter table public.memories_uploads enable row level security;
alter table public.memories_orders enable row level security;
alter table public.memories_subscriptions enable row level security;
alter table public.memories_waitlist enable row level security;
alter table public.memories_funnel_events enable row level security;
alter table public.memories_email_deliveries enable row level security;
alter table public.memories_milestones enable row level security;

-- Service role bypasses RLS. Admins may read via is_admin().
drop policy if exists memories_customers_admin_read on public.memories_customers;
create policy memories_customers_admin_read on public.memories_customers
  for select to authenticated using (public.is_admin());

drop policy if exists memories_sessions_admin_read on public.memories_funnel_sessions;
create policy memories_sessions_admin_read on public.memories_funnel_sessions
  for select to authenticated using (public.is_admin());

drop policy if exists memories_uploads_admin_read on public.memories_uploads;
create policy memories_uploads_admin_read on public.memories_uploads
  for select to authenticated using (public.is_admin());

drop policy if exists memories_orders_admin_read on public.memories_orders;
create policy memories_orders_admin_read on public.memories_orders
  for select to authenticated using (public.is_admin());

drop policy if exists memories_subscriptions_admin_read on public.memories_subscriptions;
create policy memories_subscriptions_admin_read on public.memories_subscriptions
  for select to authenticated using (public.is_admin());

drop policy if exists memories_waitlist_admin_read on public.memories_waitlist;
create policy memories_waitlist_admin_read on public.memories_waitlist
  for select to authenticated using (public.is_admin());

drop policy if exists memories_events_admin_read on public.memories_funnel_events;
create policy memories_events_admin_read on public.memories_funnel_events
  for select to authenticated using (public.is_admin());

drop policy if exists memories_email_admin_read on public.memories_email_deliveries;
create policy memories_email_admin_read on public.memories_email_deliveries
  for select to authenticated using (public.is_admin());

drop policy if exists memories_milestones_admin_read on public.memories_milestones;
create policy memories_milestones_admin_read on public.memories_milestones
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.record_memories_funnel_event(
  p_event_name text,
  p_funnel_session_id uuid,
  p_idempotency_key text,
  p_event_id uuid default null,
  p_device_type text default null,
  p_pathname text default null,
  p_amount_cents integer default null,
  p_product text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_campaign_id text default null,
  p_adset_id text default null,
  p_ad_id text default null,
  p_has_meta_click boolean default null,
  p_referrer_host text default null,
  p_failure_category text default null,
  p_is_test boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.memories_funnel_events (
    event_name, funnel_session_id, event_id, idempotency_key, device_type, pathname,
    amount_cents, product, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    campaign_id, adset_id, ad_id, has_meta_click, referrer_host, failure_category, is_test
  ) values (
    p_event_name, p_funnel_session_id, p_event_id, p_idempotency_key, p_device_type, p_pathname,
    p_amount_cents, p_product, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term,
    p_campaign_id, p_adset_id, p_ad_id, p_has_meta_click, p_referrer_host, p_failure_category, coalesce(p_is_test, false)
  )
  on conflict (idempotency_key) do nothing;

  if found then
    return jsonb_build_object('ok', true, 'duplicate', false);
  end if;
  return jsonb_build_object('ok', true, 'duplicate', true);
end;
$$;

create or replace function public.fulfill_memories_subscription_payment(
  p_event_id text,
  p_event_type text,
  p_session_id text,
  p_subscription_id text,
  p_customer_id text,
  p_payment_status text,
  p_amount_cents integer,
  p_currency text,
  p_order_id uuid,
  p_is_live boolean default false,
  p_price_id text default null,
  p_subscription_status text default 'active',
  p_period_start timestamptz default null,
  p_period_end timestamptz default null,
  p_invoice_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.memories_orders%rowtype;
  already boolean := false;
  sub_id uuid;
  first_sale boolean := false;
  milestone_id uuid;
begin
  select * into order_row from public.memories_orders where id = p_order_id for update;
  if not found then
    raise exception 'memories order not found';
  end if;

  if order_row.paid_at is not null then
    already := true;
  else
    update public.memories_orders
    set
      status = case when coalesce(p_subscription_status, 'active') = 'active' then 'active' else status end,
      payment_status = 'paid',
      paid_at = now(),
      stripe_checkout_session_id = coalesce(nullif(p_session_id, ''), stripe_checkout_session_id),
      stripe_subscription_id = coalesce(nullif(p_subscription_id, ''), stripe_subscription_id),
      stripe_customer_id = coalesce(nullif(p_customer_id, ''), stripe_customer_id),
      stripe_price_id = coalesce(nullif(p_price_id, ''), stripe_price_id),
      is_live_charge = coalesce(p_is_live, false),
      is_test = not coalesce(p_is_live, false),
      fulfillment_status = 'subscribed_pending_product',
      updated_at = now()
    where id = p_order_id;
  end if;

  insert into public.memories_subscriptions (
    order_id, customer_id, stripe_subscription_id, stripe_customer_id, stripe_price_id,
    plan_key, status, current_period_start, current_period_end, latest_invoice_id,
    latest_invoice_paid_at, amount_cents, currency, is_test, is_live_charge
  ) values (
    p_order_id,
    order_row.customer_id,
    coalesce(nullif(p_subscription_id, ''), 'pending-' || p_order_id::text),
    nullif(p_customer_id, ''),
    nullif(p_price_id, ''),
    order_row.plan_key,
    coalesce(nullif(p_subscription_status, ''), 'active'),
    p_period_start,
    p_period_end,
    nullif(p_invoice_id, ''),
    case when p_payment_status in ('paid', 'complete') then now() else null end,
    coalesce(p_amount_cents, order_row.amount_cents),
    coalesce(nullif(p_currency, ''), order_row.currency),
    not coalesce(p_is_live, false),
    coalesce(p_is_live, false)
  )
  on conflict (stripe_subscription_id) do update
  set
    status = excluded.status,
    stripe_customer_id = coalesce(excluded.stripe_customer_id, memories_subscriptions.stripe_customer_id),
    stripe_price_id = coalesce(excluded.stripe_price_id, memories_subscriptions.stripe_price_id),
    current_period_start = coalesce(excluded.current_period_start, memories_subscriptions.current_period_start),
    current_period_end = coalesce(excluded.current_period_end, memories_subscriptions.current_period_end),
    latest_invoice_id = coalesce(excluded.latest_invoice_id, memories_subscriptions.latest_invoice_id),
    latest_invoice_paid_at = coalesce(excluded.latest_invoice_paid_at, memories_subscriptions.latest_invoice_paid_at),
    amount_cents = excluded.amount_cents,
    is_live_charge = excluded.is_live_charge,
    is_test = excluded.is_test,
    updated_at = now()
  returning id into sub_id;

  -- First verified LIVE sale only (non-zero, not test, not duplicate milestone)
  if coalesce(p_is_live, false)
     and coalesce(p_amount_cents, order_row.amount_cents) > 0
     and not already
  then
    insert into public.memories_milestones (
      milestone_key, order_id, subscription_id, amount_cents, currency, plan_key, stripe_event_id, metadata
    ) values (
      'MEMORIES_FIRST_SALE_VERIFIED',
      p_order_id,
      sub_id,
      coalesce(p_amount_cents, order_row.amount_cents),
      coalesce(nullif(p_currency, ''), order_row.currency),
      order_row.plan_key,
      p_event_id,
      jsonb_build_object('event_type', p_event_type, 'session_id', p_session_id)
    )
    on conflict (milestone_key) do nothing;

    if found then
      first_sale := true;
      select id into milestone_id from public.memories_milestones where milestone_key = 'MEMORIES_FIRST_SALE_VERIFIED';
    end if;
  end if;

  insert into public.processed_stripe_events (event_id, event_type, stripe_session_id, result)
  values (
    p_event_id,
    p_event_type,
    p_session_id,
    jsonb_build_object(
      'status', case when already then 'already_paid' else 'fulfilled' end,
      'memories_order_id', p_order_id,
      'first_sale', first_sale,
      'milestone_id', milestone_id
    )
  )
  on conflict (event_id) do nothing;

  return jsonb_build_object(
    'status', case when already then 'already_paid' else 'fulfilled' end,
    'already_paid', already,
    'memories_order_id', p_order_id,
    'subscription_id', sub_id,
    'first_sale', first_sale,
    'milestone_id', milestone_id
  );
end;
$$;

revoke all on function public.record_memories_funnel_event from public;
revoke all on function public.fulfill_memories_subscription_payment from public;
grant execute on function public.record_memories_funnel_event to service_role;
grant execute on function public.fulfill_memories_subscription_payment to service_role;

commit;

-- Rollback sketch (manual, after verifying no production Memories data needed):
-- drop function if exists public.fulfill_memories_subscription_payment;
-- drop function if exists public.record_memories_funnel_event;
-- drop table if exists public.memories_milestones cascade;
-- drop table if exists public.memories_email_deliveries cascade;
-- drop table if exists public.memories_funnel_events cascade;
-- drop table if exists public.memories_waitlist cascade;
-- drop table if exists public.memories_subscriptions cascade;
-- drop table if exists public.memories_orders cascade;
-- drop table if exists public.memories_uploads cascade;
-- drop table if exists public.memories_funnel_sessions cascade;
-- drop table if exists public.memories_customers cascade;
-- delete from storage.buckets where id = 'memories-source-photos';
