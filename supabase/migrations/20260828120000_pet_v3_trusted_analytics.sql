-- V3 trusted analytics: traffic classification, measurement settings, checkout session KPI,
-- sequential landing cohort, session drill-down. Preserves all raw events.

set lock_timeout = '5s';
set statement_timeout = '180s';

begin;

-- ---------------------------------------------------------------------------
-- Measurement + price cohort settings (V3-specific; V1/V2 unchanged)
-- ---------------------------------------------------------------------------
create table if not exists public.pet_v3_measurement_settings (
  id integer primary key default 1 check (id = 1),
  measurement_reliable_from timestamptz,
  price_cohort_cents integer not null default 299,
  price_cohort_from timestamptz,
  price_cohort_certified_at timestamptz,
  price_deploy_reference_sha text,
  price_deploy_reference_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.pet_v3_measurement_settings (
  id, measurement_reliable_from, price_cohort_cents, price_cohort_from,
  price_cohort_certified_at, price_deploy_reference_sha, price_deploy_reference_at
)
values (
  1, null, 299, null, null,
  '01fde3223ace0c17a183db0b93ee11296795653f',
  timestamptz '2026-08-27 21:28:28+00'
)
on conflict (id) do nothing;

alter table public.pet_v3_measurement_settings enable row level security;
drop policy if exists pet_v3_measurement_settings_admin_read on public.pet_v3_measurement_settings;
create policy pet_v3_measurement_settings_admin_read
  on public.pet_v3_measurement_settings for select
  using (public.is_admin());
revoke all on table public.pet_v3_measurement_settings from anon, public;
grant select on table public.pet_v3_measurement_settings to authenticated;
grant all on table public.pet_v3_measurement_settings to service_role;

-- Auditable historical session exclusions (does not delete raw events)
create table if not exists public.pet_v3_analytics_session_exclusions (
  funnel_session_id uuid primary key,
  reason text not null,
  excluded_at timestamptz not null default now(),
  excluded_by text not null default 'system',
  notes text
);

alter table public.pet_v3_analytics_session_exclusions enable row level security;
drop policy if exists pet_v3_analytics_session_exclusions_admin_read on public.pet_v3_analytics_session_exclusions;
create policy pet_v3_analytics_session_exclusions_admin_read
  on public.pet_v3_analytics_session_exclusions for select
  using (public.is_admin());
revoke all on table public.pet_v3_analytics_session_exclusions from anon, public;
grant select on table public.pet_v3_analytics_session_exclusions to authenticated;
grant all on table public.pet_v3_analytics_session_exclusions to service_role;

-- ---------------------------------------------------------------------------
-- Event columns
-- ---------------------------------------------------------------------------
alter table public.pet_v3_funnel_events
  add column if not exists traffic_class text,
  add column if not exists displayed_price_cents integer,
  add column if not exists stripe_checkout_session_id text;

alter table public.pet_v3_funnel_events drop constraint if exists pet_v3_funnel_events_traffic_class_chk;
alter table public.pet_v3_funnel_events
  add constraint pet_v3_funnel_events_traffic_class_chk
  check (traffic_class is null or traffic_class in ('internal_test', 'paid_meta', 'external_other', 'unattributed'));

create index if not exists pet_v3_funnel_events_traffic_created_idx
  on public.pet_v3_funnel_events (traffic_class, created_at desc)
  where traffic_class is not null;

alter table public.pet_v3_funnel_events drop constraint if exists pet_v3_funnel_events_name_chk;
alter table public.pet_v3_funnel_events
  add constraint pet_v3_funnel_events_name_chk check (
    event_name in (
      'v3_landing_view',
      'v3_upload_started',
      'v3_upload_completed',
      'v3_upload_failed',
      'v3_preview_generation_started',
      'v3_preview_generation_completed',
      'v3_preview_generation_failed',
      'v3_preview_viewed',
      'v3_preview_regenerated',
      'v3_offer_viewed',
      'v3_unlock_clicked',
      'v3_checkout_viewed',
      'v3_checkout_session_created',
      'v3_begin_checkout',
      'v3_purchase'
    )
  );

-- ---------------------------------------------------------------------------
-- Traffic classification
-- ---------------------------------------------------------------------------
create or replace function public.classify_pet_v3_traffic(
  p_is_test boolean,
  p_utm_source text,
  p_utm_medium text,
  p_campaign_id text,
  p_ad_id text,
  p_has_meta_click boolean,
  p_fbc text,
  p_fbp text,
  p_referrer_host text
)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_is_test, false) then 'internal_test'
    when coalesce(btrim(p_campaign_id), '') <> ''
      or coalesce(btrim(p_ad_id), '') <> ''
      or coalesce(p_has_meta_click, false)
      or coalesce(btrim(p_fbc), '') <> ''
      or coalesce(btrim(p_fbp), '') <> ''
      or lower(coalesce(p_utm_source, '')) in ('facebook','fb','instagram','ig','an','msg','meta','paid_social')
      or lower(coalesce(p_utm_medium, '')) in ('cpc','paid','paid_social','paidsocial')
      then 'paid_meta'
    when coalesce(btrim(p_utm_source), '') <> '' or coalesce(btrim(p_referrer_host), '') <> ''
      then 'external_other'
    else 'unattributed'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Ingest RPC (adds traffic_class, displayed_price_cents, stripe session id)
-- ---------------------------------------------------------------------------
drop function if exists public.record_pet_v3_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text, text, text, text, text, text, text
);

create or replace function public.record_pet_v3_funnel_event(
  p_event_name text,
  p_funnel_session_id uuid,
  p_idempotency_key text,
  p_species text default 'cat',
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
  p_funnel_version text default 'v3',
  p_creative_id text default null,
  p_fbc text default null,
  p_fbp text default null,
  p_client_ip text default null,
  p_client_ip_hostname text default null,
  p_displayed_price_cents integer default null,
  p_stripe_checkout_session_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  key text := left(btrim(coalesce(p_idempotency_key, '')), 180);
  version text := lower(btrim(coalesce(p_funnel_version, 'v3')));
  is_test boolean := coalesce(p_is_test, false);
  traffic text;
  price_cohort_from timestamptz;
  displayed_price integer;
begin
  if length(key) < 8 then
    raise exception 'invalid_idempotency_key';
  end if;
  if version not in ('v3', 'unknown') then
    version := 'v3';
  end if;

  if exists (
    select 1 from public.pet_v3_analytics_session_exclusions x
    where x.funnel_session_id = p_funnel_session_id
  ) then
    is_test := true;
  end if;

  traffic := public.classify_pet_v3_traffic(
    is_test, p_utm_source, p_utm_medium, p_campaign_id, p_ad_id,
    coalesce(p_has_meta_click, false), p_fbc, p_fbp, p_referrer_host
  );

  select s.price_cohort_from, s.price_cohort_cents
    into price_cohort_from, displayed_price
  from public.pet_v3_measurement_settings s
  where s.id = 1;

  displayed_price := coalesce(
    p_displayed_price_cents,
    p_amount_cents,
    case when price_cohort_from is not null and now() >= price_cohort_from then displayed_price else null end
  );

  insert into public.pet_v3_funnel_events (
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
    funnel_version,
    creative_id,
    fbc,
    fbp,
    client_ip,
    client_ip_hostname,
    traffic_class,
    displayed_price_cents,
    stripe_checkout_session_id
  )
  values (
    p_event_name,
    p_funnel_session_id,
    key,
    coalesce(nullif(btrim(p_species), ''), 'cat'),
    public.pet_funnel_safe_text(p_utm_source, 120),
    public.pet_funnel_safe_text(p_utm_medium, 120),
    public.pet_funnel_safe_text(p_utm_campaign, 120),
    public.pet_funnel_safe_text(p_utm_content, 120),
    public.pet_funnel_safe_text(p_utm_term, 120),
    public.pet_funnel_safe_text(p_campaign_id, 64),
    public.pet_funnel_safe_text(p_adset_id, 64),
    public.pet_funnel_safe_text(p_ad_id, 64),
    public.pet_funnel_safe_text(p_device_type, 16),
    case when p_pathname = '/pet/cat-v3' then p_pathname else null end,
    p_amount_cents,
    coalesce(p_has_meta_click, false),
    public.pet_funnel_safe_text(p_referrer_host, 120),
    p_client_event_id,
    is_test,
    public.pet_funnel_safe_text(p_environment, 32),
    version,
    public.pet_funnel_safe_text(p_creative_id, 120),
    public.pet_funnel_safe_text(p_fbc, 200),
    public.pet_funnel_safe_text(p_fbp, 200),
    public.pet_funnel_safe_text(p_client_ip, 64),
    public.pet_funnel_safe_text(p_client_ip_hostname, 200),
    traffic,
    displayed_price,
    public.pet_funnel_safe_text(p_stripe_checkout_session_id, 200)
  )
  on conflict (idempotency_key) do nothing
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.record_pet_v3_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text, text, text, text, text, text, text, integer, text
) from public, anon, authenticated;
grant execute on function public.record_pet_v3_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text, text, text, text, text, text, text, integer, text
) to service_role;

-- Backfill traffic_class for historical rows (no deletes)
update public.pet_v3_funnel_events e
set traffic_class = public.classify_pet_v3_traffic(
  coalesce(e.is_test, false) or exists (
    select 1 from public.pet_v3_analytics_session_exclusions x where x.funnel_session_id = e.funnel_session_id
  ),
  e.utm_source, e.utm_medium, e.campaign_id, e.ad_id,
  e.has_meta_click, e.fbc, e.fbp, e.referrer_host
)
where e.traffic_class is null;

update public.pet_v3_funnel_events e
set displayed_price_cents = coalesce(
  e.displayed_price_cents,
  e.amount_cents,
  case
    when e.created_at >= coalesce((select price_cohort_from from public.pet_v3_measurement_settings where id = 1), e.created_at)
      then (select price_cohort_cents from public.pet_v3_measurement_settings where id = 1)
    else null
  end
)
where e.displayed_price_cents is null;

-- ---------------------------------------------------------------------------
-- Admin: certify measurement timestamp (run once after production deploy)
-- ---------------------------------------------------------------------------
create or replace function public.admin_pet_v3_certify_measurement(
  p_measurement_reliable_from timestamptz,
  p_price_cohort_from timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.pet_v3_measurement_settings
  set
    measurement_reliable_from = p_measurement_reliable_from,
    price_cohort_from = coalesce(p_price_cohort_from, price_cohort_from),
    updated_at = now()
  where id = 1;
  return (select to_jsonb(s) from public.pet_v3_measurement_settings s where s.id = 1);
end;
$$;

revoke all on function public.admin_pet_v3_certify_measurement(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_pet_v3_certify_measurement(timestamptz, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Shared filter helper for trusted V3 analytics RPCs
-- ---------------------------------------------------------------------------
create or replace function public.pet_v3_analytics_event_passes(
  e public.pet_v3_funnel_events,
  p_from timestamptz,
  p_to timestamptz,
  p_include_internal_tests boolean,
  p_traffic_class text,
  p_measurement_from timestamptz,
  p_price_cohort_only boolean,
  p_price_cohort_cents integer,
  p_price_cohort_from timestamptz,
  p_funnel_version text,
  p_campaign_id text,
  p_adset_id text,
  p_ad_id text,
  p_creative_id text,
  p_utm_source text,
  p_utm_medium text
)
returns boolean
language sql
stable
as $$
  select
    e.created_at >= p_from
    and e.created_at < p_to
    and (p_include_internal_tests or coalesce(e.is_test, false) = false)
    and (p_traffic_class is null or e.traffic_class = p_traffic_class)
    and (p_measurement_from is null or e.created_at >= p_measurement_from)
    and (
      not coalesce(p_price_cohort_only, false)
      or (
        p_price_cohort_from is not null
        and e.created_at >= p_price_cohort_from
        and coalesce(e.displayed_price_cents, e.amount_cents, p_price_cohort_cents) = p_price_cohort_cents
      )
    )
    and (p_funnel_version is null or coalesce(e.funnel_version, 'v3') = p_funnel_version)
    and (p_campaign_id is null or e.campaign_id = p_campaign_id)
    and (p_adset_id is null or e.adset_id = p_adset_id)
    and (p_ad_id is null or e.ad_id = p_ad_id)
    and (p_creative_id is null or e.creative_id = p_creative_id or e.utm_content = p_creative_id)
    and (p_utm_source is null or e.utm_source = p_utm_source)
    and (p_utm_medium is null or e.utm_medium = p_utm_medium);
$$;

-- ---------------------------------------------------------------------------
-- Trusted summary: traffic breakdown + raw vs production + reconciliation
-- ---------------------------------------------------------------------------
create or replace function public.admin_pet_v3_trusted_summary(
  p_from timestamptz,
  p_to timestamptz,
  p_include_internal_tests boolean default false,
  p_traffic_class text default null,
  p_price_cohort_only boolean default true,
  p_funnel_version text default 'v3',
  p_campaign_id text default null,
  p_adset_id text default null,
  p_ad_id text default null,
  p_creative_id text default null,
  p_utm_source text default null,
  p_utm_medium text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  version_filter text := lower(btrim(coalesce(p_funnel_version, 'v3')));
  traffic_filter text := nullif(lower(btrim(coalesce(p_traffic_class, ''))), '');
  measurement_from timestamptz;
  price_cohort_from timestamptz;
  price_cohort_cents integer;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if version_filter = 'all' then version_filter := null;
  elsif version_filter not in ('v3', 'unknown') then version_filter := 'v3';
  end if;
  if traffic_filter = 'all' then traffic_filter := null;
  elsif traffic_filter is not null and traffic_filter not in ('internal_test','paid_meta','external_other','unattributed') then
    traffic_filter := null;
  end if;

  select s.measurement_reliable_from, s.price_cohort_certified_at, s.price_cohort_cents
    into measurement_from, price_cohort_from, price_cohort_cents
  from public.pet_v3_measurement_settings s where s.id = 1;

  with filtered as (
    select e.*
    from public.pet_v3_funnel_events e
    where public.pet_v3_analytics_event_passes(
      e, p_from, p_to, p_include_internal_tests, traffic_filter,
      case when p_include_internal_tests then null else measurement_from end,
      p_price_cohort_only, price_cohort_cents, price_cohort_from,
      version_filter,
      nullif(btrim(coalesce(p_campaign_id, '')), ''),
      nullif(btrim(coalesce(p_adset_id, '')), ''),
      nullif(btrim(coalesce(p_ad_id, '')), ''),
      nullif(btrim(coalesce(p_creative_id, '')), ''),
      nullif(btrim(coalesce(p_utm_source, '')), ''),
      nullif(btrim(coalesce(p_utm_medium, '')), '')
    )
  ),
  landing_sessions as (
    select distinct funnel_session_id from filtered where event_name = 'v3_landing_view'
  ),
  sequential as (
    select
      count(distinct l.funnel_session_id)::int as landing,
      count(distinct l.funnel_session_id) filter (
        where exists (
          select 1 from filtered u
          where u.funnel_session_id = l.funnel_session_id
            and u.event_name = 'v3_upload_completed'
            and u.created_at >= (select min(f2.created_at) from filtered f2 where f2.funnel_session_id = l.funnel_session_id and f2.event_name = 'v3_landing_view')
        )
      )::int as uploads,
      count(distinct l.funnel_session_id) filter (
        where exists (
          select 1 from filtered p
          where p.funnel_session_id = l.funnel_session_id and p.event_name = 'v3_preview_viewed'
            and p.created_at >= (select min(f2.created_at) from filtered f2 where f2.funnel_session_id = l.funnel_session_id and f2.event_name = 'v3_landing_view')
        )
      )::int as previews,
      count(distinct l.funnel_session_id) filter (
        where exists (
          select 1 from filtered o
          where o.funnel_session_id = l.funnel_session_id and o.event_name = 'v3_offer_viewed'
            and o.created_at >= (select min(f2.created_at) from filtered f2 where f2.funnel_session_id = l.funnel_session_id and f2.event_name = 'v3_landing_view')
        )
      )::int as offers,
      count(distinct l.funnel_session_id) filter (
        where exists (
          select 1 from filtered c
          where c.funnel_session_id = l.funnel_session_id and c.event_name = 'v3_checkout_session_created'
            and c.created_at >= (select min(f2.created_at) from filtered f2 where f2.funnel_session_id = l.funnel_session_id and f2.event_name = 'v3_landing_view')
        )
      )::int as checkout_sessions,
      count(distinct l.funnel_session_id) filter (
        where exists (
          select 1 from filtered b
          where b.funnel_session_id = l.funnel_session_id and b.event_name = 'v3_begin_checkout'
            and b.created_at >= (select min(f2.created_at) from filtered f2 where f2.funnel_session_id = l.funnel_session_id and f2.event_name = 'v3_landing_view')
        )
      )::int as checkout_clicks
    from landing_sessions l
  ),
  traffic_breakdown as (
    select coalesce(e.traffic_class, 'unattributed') as traffic_class,
           count(distinct e.funnel_session_id) filter (where e.event_name = 'v3_landing_view')::int as landing_sessions
    from public.pet_v3_funnel_events e
    where e.created_at >= p_from and e.created_at < p_to
      and (p_include_internal_tests or coalesce(e.is_test, false) = false)
      and (version_filter is null or coalesce(e.funnel_version, 'v3') = version_filter)
    group by 1
  ),
  raw_totals as (
    select
      count(distinct funnel_session_id) filter (where event_name = 'v3_landing_view')::int as landing,
      count(distinct funnel_session_id) filter (where event_name = 'v3_begin_checkout')::int as checkout_clicks,
      count(distinct funnel_session_id) filter (where event_name = 'v3_checkout_session_created')::int as checkout_sessions
    from public.pet_v3_funnel_events e
    where e.created_at >= p_from and e.created_at < p_to
      and (version_filter is null or coalesce(e.funnel_version, 'v3') = version_filter)
  ),
  paid_meta_landings as (
    select count(distinct funnel_session_id)::int as cnt
    from filtered
    where event_name = 'v3_landing_view' and traffic_class = 'paid_meta'
  ),
  confirmed_purchases as (
    select count(distinct o.id)::int as purchases,
           coalesce(sum(coalesce(o.charged_amount_cents, o.amount_cents, 0)), 0)::int as revenue_cents
    from public.pet_orders o
    inner join public.pet_v3_funnel_events e
      on e.event_name = 'v3_purchase' and e.idempotency_key = ('v3_purchase:' || o.id::text)
    where coalesce(o.funnel_variant, 'v1') = 'v3'
      and o.paid_at >= p_from and o.paid_at < p_to
      and coalesce(o.status, '') <> 'refunded'
      and public.pet_order_analytics_class(
        o.stripe_checkout_session_id, o.stripe_payment_intent_id,
        o.charged_amount_cents, o.amount_cents, o.discount_percent, o.stripe_payment_status
      ) = 'paid'
      and (p_include_internal_tests or coalesce(e.is_test, false) = false)
      and (traffic_filter is null or e.traffic_class = traffic_filter)
      and (not p_price_cohort_only or (
        price_cohort_from is not null and o.paid_at >= price_cohort_from
        and coalesce(o.charged_amount_cents, o.amount_cents) = price_cohort_cents
      ))
  )
  select jsonb_build_object(
    'measurement_reliable_from', measurement_from,
    'price_cohort_from', price_cohort_from,
    'price_cohort_certified_at', (select price_cohort_certified_at from public.pet_v3_measurement_settings where id = 1),
    'price_deploy_reference_at', (select price_deploy_reference_at from public.pet_v3_measurement_settings where id = 1),
    'price_deploy_reference_sha', (select price_deploy_reference_sha from public.pet_v3_measurement_settings where id = 1),
    'price_cohort_cents', price_cohort_cents,
    'traffic_breakdown', coalesce((select jsonb_agg(to_jsonb(t)) from traffic_breakdown t), '[]'::jsonb),
    'production_sequential', (select to_jsonb(sequential) from sequential),
    'paid_meta_landings', (select cnt from paid_meta_landings),
    'raw_totals', (select to_jsonb(raw_totals) from raw_totals),
    'purchases', (select purchases from confirmed_purchases),
    'revenue_cents', (select revenue_cents from confirmed_purchases)
  )
  into result;

  return result;
end;
$$;

revoke all on function public.admin_pet_v3_trusted_summary(
  timestamptz, timestamptz, boolean, text, boolean, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.admin_pet_v3_trusted_summary(
  timestamptz, timestamptz, boolean, text, boolean, text, text, text, text, text, text, text
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Session drill-down (anonymous session short ids only)
-- ---------------------------------------------------------------------------
create or replace function public.admin_pet_v3_session_drilldown(
  p_from timestamptz,
  p_to timestamptz,
  p_include_internal_tests boolean default false,
  p_traffic_class text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  traffic_filter text := nullif(lower(btrim(coalesce(p_traffic_class, ''))), '');
  measurement_from timestamptz;
  price_cohort_from timestamptz;
  price_cohort_cents integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select s.measurement_reliable_from, s.price_cohort_certified_at, s.price_cohort_cents
    into measurement_from, price_cohort_from, price_cohort_cents
  from public.pet_v3_measurement_settings s where s.id = 1;

  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.landing_at desc)
    from (
      select
        left(l.funnel_session_id::text, 8) as session_short,
        l.created_at as landing_at,
        l.traffic_class,
        l.is_test,
        l.utm_source,
        l.utm_medium,
        l.campaign_id,
        l.ad_id,
        l.displayed_price_cents,
        (select count(*)::int from public.pet_v3_funnel_events e where e.funnel_session_id = l.funnel_session_id) as event_count,
        (select jsonb_agg(jsonb_build_object('event_name', e.event_name, 'created_at', e.created_at) order by e.created_at)
         from public.pet_v3_funnel_events e where e.funnel_session_id = l.funnel_session_id) as events,
        exists(select 1 from public.pet_v3_funnel_events e where e.funnel_session_id = l.funnel_session_id and e.event_name = 'v3_checkout_session_created') as stripe_checkout_created,
        exists(select 1 from public.pet_v3_funnel_events e where e.funnel_session_id = l.funnel_session_id and e.event_name = 'v3_begin_checkout') as checkout_button_click,
        exists(
          select 1 from public.pet_orders o
          inner join public.pet_v3_funnel_events pe on pe.idempotency_key = ('v3_purchase:' || o.id::text)
          where pe.funnel_session_id = l.funnel_session_id
            and public.pet_order_analytics_class(o.stripe_checkout_session_id, o.stripe_payment_intent_id, o.charged_amount_cents, o.amount_cents, o.discount_percent, o.stripe_payment_status) = 'paid'
        ) as paid_purchase
      from public.pet_v3_funnel_events l
      where l.event_name = 'v3_landing_view'
        and public.pet_v3_analytics_event_passes(
          l, p_from, p_to, p_include_internal_tests, traffic_filter,
          case when p_include_internal_tests then null else measurement_from end,
          true, price_cohort_cents, price_cohort_from,
          'v3', null, null, null, null, null, null
        )
      order by l.created_at desc
      limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_pet_v3_session_drilldown(timestamptz, timestamptz, boolean, text, integer) from public, anon;
grant execute on function public.admin_pet_v3_session_drilldown(timestamptz, timestamptz, boolean, text, integer) to authenticated, service_role;

commit;
