-- TDG-PET-FUNNEL-FORENSIC-005
-- P0 root cause: pet_v2_funnel_events_name_chk never expanded when teaser/checkout
-- event names were added to record_pet_v2_funnel_event(). Production inserts for
-- v2_teaser_viewed / v2_checkout_session_* fail with 23514 while offer/begin land.
-- Also expands allow-list for payment diagnostic events + admin diagnostics RPC.

begin;

-- ---------------------------------------------------------------------------
-- 1) Expand CHECK constraint (this is the production P0)
-- ---------------------------------------------------------------------------
alter table public.pet_v2_funnel_events
  drop constraint if exists pet_v2_funnel_events_name_chk;

alter table public.pet_v2_funnel_events
  add constraint pet_v2_funnel_events_name_chk check (
    event_name in (
      'v2_landing_view',
      'v2_upload_started',
      'v2_upload_completed',
      'v2_upload_failed',
      'v2_species_confirmed',
      'v2_teaser_generation_started',
      'v2_teaser_generation_completed',
      'v2_teaser_generation_failed',
      'v2_teaser_viewed',
      'v2_offer_viewed',
      'v2_checkout_session_requested',
      'v2_checkout_session_created',
      'v2_checkout_failed',
      'v2_begin_checkout',
      'v2_checkout_canceled',
      'v2_payment_ui_visible',
      'v2_payment_attempt_started',
      'v2_payment_requires_action',
      'v2_payment_failed',
      'v2_checkout_abandoned',
      'v2_purchase',
      'v2_paid_generation_started',
      'v2_paid_generation_completed',
      'v2_paid_generation_failed',
      'v2_collection_viewed',
      'v2_provider_unavailable',
      'v2_preview_generation_started',
      'v2_preview_generation_completed',
      'v2_preview_generation_failed',
      'v2_preview_viewed',
      'v2_preview_regenerated',
      'v2_unlock_clicked'
    )
  );

-- Optional safe diagnostic columns (nullable; no card/PII secrets)
alter table public.pet_v2_funnel_events
  add column if not exists error_code text;
alter table public.pet_v2_funnel_events
  add column if not exists browser_family text;
alter table public.pet_v2_funnel_events
  add column if not exists in_app_browser text;

comment on column public.pet_v2_funnel_events.error_code is
  'Safe Stripe/client error category code only — never card numbers or secrets.';

-- ---------------------------------------------------------------------------
-- 2) Refresh record_pet_v2_funnel_event allow-list (+ optional diagnostic cols)
-- Drop prior 23-arg overload so we do not leave dual signatures.
-- ---------------------------------------------------------------------------
drop function if exists public.record_pet_v2_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text, text, text, text
);

create or replace function public.record_pet_v2_funnel_event(
  p_event_name text,
  p_funnel_session_id uuid,
  p_idempotency_key text,
  p_species text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_campaign_id text default null,
  p_adset_id text default null,
  p_ad_id text default null,
  p_device_type text default null,
  p_pathname text default null,
  p_amount_cents integer default null,
  p_has_meta_click boolean default false,
  p_referrer_host text default null,
  p_client_event_id uuid default null,
  p_is_test boolean default false,
  p_environment text default null,
  p_client_ip text default null,
  p_client_ip_hostname text default null,
  p_country_code text default null,
  p_error_code text default null,
  p_browser_family text default null,
  p_in_app_browser text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed constant text[] := array[
    'v2_landing_view',
    'v2_upload_started',
    'v2_upload_completed',
    'v2_upload_failed',
    'v2_species_confirmed',
    'v2_teaser_generation_started',
    'v2_teaser_generation_completed',
    'v2_teaser_generation_failed',
    'v2_teaser_viewed',
    'v2_offer_viewed',
    'v2_checkout_session_requested',
    'v2_checkout_session_created',
    'v2_checkout_failed',
    'v2_begin_checkout',
    'v2_checkout_canceled',
    'v2_payment_ui_visible',
    'v2_payment_attempt_started',
    'v2_payment_requires_action',
    'v2_payment_failed',
    'v2_checkout_abandoned',
    'v2_purchase',
    'v2_paid_generation_started',
    'v2_paid_generation_completed',
    'v2_paid_generation_failed',
    'v2_collection_viewed',
    'v2_provider_unavailable',
    'v2_preview_generation_started',
    'v2_preview_generation_completed',
    'v2_preview_generation_failed',
    'v2_preview_viewed',
    'v2_preview_regenerated',
    'v2_unlock_clicked'
  ];
  new_id uuid;
  clean_path text;
  is_test boolean;
  country text;
  browser_family text;
  in_app text;
  err_code text;
begin
  if p_funnel_session_id is null then
    return null;
  end if;
  if p_event_name is null or not (p_event_name = any (allowed)) then
    return null;
  end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) < 8 then
    return null;
  end if;

  clean_path := left(split_part(coalesce(p_pathname, ''), '?', 1), 64);
  if clean_path is not null
     and clean_path not in ('/pet/dog-v2', '/pet/cat-v2', '/pet/other-v2', '/pet-v2')
     and left(clean_path, 8) <> '/pet-v2/' then
    clean_path := null;
  end if;

  country := upper(left(btrim(coalesce(p_country_code, '')), 2));
  if country !~ '^[A-Z]{2}$' then
    country := null;
  end if;

  is_test := coalesce(p_is_test, false)
    or public.pet_funnel_country_is_internal(country);

  browser_family := lower(left(btrim(coalesce(p_browser_family, '')), 32));
  if browser_family not in ('safari', 'chrome', 'firefox', 'edge', 'samsung', 'other') then
    browser_family := null;
  end if;

  in_app := lower(left(btrim(coalesce(p_in_app_browser, '')), 32));
  if in_app not in ('facebook_iab', 'instagram_iab', 'other_iab') then
    in_app := null;
  end if;

  err_code := left(regexp_replace(coalesce(p_error_code, ''), '[^a-zA-Z0-9_:\-.]', '', 'g'), 64);
  if err_code = '' then
    err_code := null;
  end if;

  insert into public.pet_v2_funnel_events (
    event_name,
    funnel_session_id,
    idempotency_key,
    species,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    campaign_id,
    adset_id,
    ad_id,
    device_type,
    pathname,
    amount_cents,
    has_meta_click,
    referrer_host,
    client_event_id,
    is_test,
    environment,
    client_ip,
    client_ip_hostname,
    country_code,
    error_code,
    browser_family,
    in_app_browser
  )
  values (
    p_event_name,
    p_funnel_session_id,
    left(btrim(p_idempotency_key), 180),
    case when p_species in ('dog', 'cat', 'other') then p_species else null end,
    public.pet_funnel_safe_text(p_utm_source),
    public.pet_funnel_safe_text(p_utm_medium),
    public.pet_funnel_safe_text(p_utm_campaign),
    public.pet_funnel_safe_text(p_utm_content),
    public.pet_funnel_safe_text(p_utm_term),
    public.pet_funnel_safe_text(p_campaign_id),
    public.pet_funnel_safe_text(p_adset_id),
    public.pet_funnel_safe_text(p_ad_id),
    case when p_device_type in ('mobile', 'tablet', 'desktop') then p_device_type else null end,
    clean_path,
    case when p_amount_cents is not null and p_amount_cents >= 0 then p_amount_cents else null end,
    coalesce(p_has_meta_click, false),
    public.pet_funnel_safe_text(p_referrer_host, 120),
    p_client_event_id,
    is_test,
    public.pet_funnel_safe_text(p_environment, 32),
    public.pet_funnel_safe_text(p_client_ip, 64),
    public.pet_funnel_safe_text(p_client_ip_hostname, 200),
    country,
    err_code,
    browser_family,
    in_app
  )
  on conflict (idempotency_key) do nothing
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.record_pet_v2_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text, text, text, text, text, text, text
) from public;
grant execute on function public.record_pet_v2_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text, text, text, text, text, text, text
) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Admin checkout diagnostics — raw vs sequential vs Stripe order truth
-- ---------------------------------------------------------------------------
create or replace function public.admin_pet_v2_checkout_diagnostics(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  with
  ev as (
    select *
    from public.pet_v2_funnel_events e
    where e.created_at >= p_from
      and e.created_at < p_to
      and coalesce(e.is_test, false) = false
  ),
  raw_counts as (
    select event_name,
           count(*)::int as event_count,
           count(distinct funnel_session_id)::int as unique_sessions
    from ev
    group by event_name
  ),
  landing as (
    select distinct funnel_session_id from ev where event_name = 'v2_landing_view'
  ),
  upload as (
    select distinct l.funnel_session_id
    from landing l
    inner join ev e on e.funnel_session_id = l.funnel_session_id and e.event_name = 'v2_upload_completed'
  ),
  teaser as (
    select distinct u.funnel_session_id
    from upload u
    inner join ev e on e.funnel_session_id = u.funnel_session_id
      and e.event_name in ('v2_teaser_viewed', 'v2_preview_viewed')
  ),
  offer as (
    select distinct t.funnel_session_id
    from teaser t
    inner join ev e on e.funnel_session_id = t.funnel_session_id and e.event_name = 'v2_offer_viewed'
  ),
  -- Human UX stage: payment UI actually rendered (not Stripe session creation).
  payment_ui_visible as (
    select distinct o.funnel_session_id
    from offer o
    inner join ev e on e.funnel_session_id = o.funnel_session_id
      and e.event_name = 'v2_payment_ui_visible'
  ),
  payment_attempt as (
    select distinct u.funnel_session_id
    from payment_ui_visible u
    inner join ev e on e.funnel_session_id = u.funnel_session_id
      and e.event_name in ('v2_payment_attempt_started', 'v2_begin_checkout')
  ),
  purchase as (
    select distinct p.funnel_session_id
    from payment_attempt p
    inner join ev e on e.funnel_session_id = p.funnel_session_id and e.event_name = 'v2_purchase'
  ),
  orders as (
    select
      o.id,
      o.status,
      o.amount_cents,
      o.charged_amount_cents,
      o.stripe_checkout_session_id,
      o.stripe_payment_intent_id,
      o.stripe_payment_status,
      o.paid_at,
      o.last_error,
      o.meta_purchase_sent_at,
      (select count(*) from public.pet_checkout_sessions cs where cs.order_id = o.id)::int as session_rows
    from public.pet_orders o
    where o.funnel_variant = 'v2'
      and o.created_at >= p_from
      and o.created_at < p_to
  ),
  failures as (
    select error_category, count(*)::int as n
    from public.pet_funnel_event_failures
    where created_at >= p_from
      and created_at < p_to
      and coalesce(funnel_dataset, '') = 'v2'
    group by error_category
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'definitions', jsonb_build_object(
      'raw', 'Independent unique-session counts per event — stages are NOT nested.',
      'sequential_human', 'Landing→Upload→Teaser→Offer→Payment UI visible→Attempt→Purchase. Never equate Stripe session_created with Payment UI viewed.',
      'stripe_infrastructure', 'pet_orders / Stripe session rows are infrastructure, not proof a human saw payment UI.',
      'purchase_authority', 'Stripe/server verified pet_orders.paid_at is authoritative.'
    ),
    'raw_event_counts', coalesce((select jsonb_agg(to_jsonb(raw_counts) order by unique_sessions desc) from raw_counts), '[]'::jsonb),
    'sequential_cohort', jsonb_build_object(
      'landing', (select count(*) from landing),
      'upload', (select count(*) from upload),
      'teaser', (select count(*) from teaser),
      'offer', (select count(*) from offer),
      'payment_ui_visible', (select count(*) from payment_ui_visible),
      'payment_attempt', (select count(*) from payment_attempt),
      'purchase', (select count(*) from purchase)
    ),
    'orders', jsonb_build_object(
      'total', (select count(*) from orders),
      'with_stripe_session', (select count(*) from orders where stripe_checkout_session_id is not null),
      'with_payment_intent', (select count(*) from orders where stripe_payment_intent_id is not null),
      'awaiting_payment', (select count(*) from orders where status = 'awaiting_payment'),
      'paid', (select count(*) from orders where paid_at is not null),
      'paid_revenue_cents', (select coalesce(sum(coalesce(charged_amount_cents, amount_cents)), 0) from orders where paid_at is not null),
      'meta_purchase_sent', (select count(*) from orders where paid_at is not null and meta_purchase_sent_at is not null),
      'multi_session_orders', (select count(*) from orders where session_rows > 1)
    ),
    'checkout_diagnostics', jsonb_build_object(
      'stripe_checkout_sessions_created', (select count(*) from orders where stripe_checkout_session_id is not null),
      'payment_ui_visible_fp', coalesce((select sum(unique_sessions) from raw_counts where event_name = 'v2_payment_ui_visible'), 0),
      'payment_attempted_fp', coalesce((select sum(unique_sessions) from raw_counts where event_name = 'v2_payment_attempt_started'), 0),
      'begin_checkout_fp', coalesce((select sum(unique_sessions) from raw_counts where event_name = 'v2_begin_checkout'), 0),
      'session_created_fp', coalesce((select sum(unique_sessions) from raw_counts where event_name = 'v2_checkout_session_created'), 0),
      'purchased', (select count(*) from orders where paid_at is not null),
      'abandoned_no_attempt_heuristic', (
        select count(*) from orders
        where stripe_checkout_session_id is not null
          and paid_at is null
          and stripe_payment_intent_id is null
          and coalesce(last_error, '') = ''
      ),
      'failed_fp', coalesce((select sum(unique_sessions) from raw_counts where event_name in ('v2_payment_failed', 'v2_checkout_failed')), 0),
      'requires_action_fp', coalesce((select sum(unique_sessions) from raw_counts where event_name = 'v2_payment_requires_action'), 0),
      'ingest_failures', coalesce((select jsonb_object_agg(error_category, n) from failures), '{}'::jsonb)
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_pet_v2_checkout_diagnostics(timestamptz, timestamptz) from public;
grant execute on function public.admin_pet_v2_checkout_diagnostics(timestamptz, timestamptz) to authenticated;

commit;
