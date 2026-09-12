-- Pet Funnel V4 · New Sales Campaign (Meta campaign_id 120253729468900170).
-- Additive only: isolated event table, ingest RPC, admin analytics, allowlist + CHECKs.

begin;

-- ---------------------------------------------------------------------------
-- pet_v4_funnel_events
-- ---------------------------------------------------------------------------
create table if not exists public.pet_v4_funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  funnel_session_id uuid not null,
  visitor_id uuid,
  idempotency_key text not null,
  species text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  campaign_id text,
  adset_id text,
  ad_id text,
  device_type text,
  browser_family text,
  in_app_browser text,
  pathname text,
  amount_cents integer,
  has_meta_click boolean not null default false,
  referrer_host text,
  client_event_id uuid,
  is_test boolean not null default false,
  environment text,
  funnel_variant text not null default 'v4_sales',
  funnel_version text not null default 'v4',
  fbc text,
  fbp text,
  failure_category text,
  cta_location text,
  scroll_bucket text,
  scroll_pct integer,
  engaged_ms integer,
  generation_duration_ms integer,
  meta_placement text,
  country_code text,
  stripe_checkout_session_id text,
  created_at timestamptz not null default now(),
  constraint pet_v4_funnel_events_name_chk check (
    event_name in (
      'v4_landing_view',
      'v4_scroll_depth',
      'v4_first_interaction',
      'v4_upload_opened',
      'v4_upload_started',
      'v4_upload_completed',
      'v4_upload_failed',
      'v4_upload_abandoned',
      'v4_generation_started',
      'v4_generation_completed',
      'v4_generation_failed',
      'v4_generation_left',
      'v4_teaser_viewed',
      'v4_offer_viewed',
      'v4_cta_clicked',
      'v4_cta_exposed',
      'v4_checkout_clicked',
      'v4_checkout_session_created',
      'v4_checkout_opened',
      'v4_checkout_abandoned',
      'v4_purchase'
    )
  ),
  constraint pet_v4_funnel_events_species_chk check (
    species is null or species in ('dog', 'cat', 'other')
  ),
  constraint pet_v4_funnel_events_path_chk check (
    pathname is null
    or pathname in (
      '/pet/dog-v4',
      '/pet/cat-v4',
      '/pet/other-v4',
      '/pet/dog-v2',
      '/pet/cat-v2',
      '/pet/other-v2'
    )
  ),
  constraint pet_v4_funnel_events_amount_chk check (
    amount_cents is null or amount_cents >= 0
  ),
  constraint pet_v4_funnel_events_scroll_pct_chk check (
    scroll_pct is null or (scroll_pct >= 0 and scroll_pct <= 100)
  )
);

create unique index if not exists pet_v4_funnel_events_idempotency_uidx
  on public.pet_v4_funnel_events (idempotency_key);

create index if not exists pet_v4_funnel_events_created_idx
  on public.pet_v4_funnel_events (created_at desc);

create index if not exists pet_v4_funnel_events_name_created_idx
  on public.pet_v4_funnel_events (event_name, created_at desc);

create index if not exists pet_v4_funnel_events_session_created_idx
  on public.pet_v4_funnel_events (funnel_session_id, created_at desc);

create index if not exists pet_v4_funnel_events_campaign_created_idx
  on public.pet_v4_funnel_events (campaign_id, created_at desc);

create index if not exists pet_v4_funnel_events_visitor_idx
  on public.pet_v4_funnel_events (visitor_id)
  where visitor_id is not null;

alter table public.pet_v4_funnel_events enable row level security;

drop policy if exists pet_v4_funnel_events_admin_read on public.pet_v4_funnel_events;
create policy pet_v4_funnel_events_admin_read
  on public.pet_v4_funnel_events for select
  using (public.is_admin());

revoke all on table public.pet_v4_funnel_events from anon, authenticated, public;
grant select on table public.pet_v4_funnel_events to authenticated;
grant all on table public.pet_v4_funnel_events to service_role;

comment on table public.pet_v4_funnel_events is
  'Isolated first-party events for Pet Funnel V4 New Sales Campaign (Meta 120253729468900170).';

-- ---------------------------------------------------------------------------
-- Order funnel variant: add v4
-- ---------------------------------------------------------------------------
alter table public.pet_orders drop constraint if exists pet_orders_funnel_variant_chk;
alter table public.pet_orders
  add constraint pet_orders_funnel_variant_chk
  check (funnel_variant in ('v1', 'v2', 'v3', 'v4'));

comment on column public.pet_orders.funnel_variant is
  'Checkout funnel origin: v1 sequential, v2 dog preview/teaser, v3 cat preview, v4 sales campaign.';

-- ---------------------------------------------------------------------------
-- Event failure dataset: add v4
-- ---------------------------------------------------------------------------
alter table public.pet_funnel_event_failures drop constraint if exists pet_funnel_event_failures_dataset_chk;
alter table public.pet_funnel_event_failures
  add constraint pet_funnel_event_failures_dataset_chk
  check (funnel_dataset is null or funnel_dataset in ('v1', 'v2', 'v3', 'v4'));

-- ---------------------------------------------------------------------------
-- Campaign allowlist funnel variant: add v4_sales + upsert New Sales Campaign
-- ---------------------------------------------------------------------------
alter table public.pet_meta_campaign_allowlist drop constraint if exists pet_meta_campaign_allowlist_variant_chk;
alter table public.pet_meta_campaign_allowlist
  add constraint pet_meta_campaign_allowlist_variant_chk
  check (
    funnel_variant is null
    or funnel_variant in ('v1', 'v2_preview', 'v3_cat_preview', 'v4_sales')
  );

insert into public.pet_meta_campaign_allowlist (
  campaign_id,
  label,
  funnel_variant,
  enabled
)
values (
  '120253729468900170',
  'New Sales Campaign',
  'v4_sales',
  true
)
on conflict (campaign_id) do update
set
  label = excluded.label,
  funnel_variant = excluded.funnel_variant,
  enabled = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- record_pet_v4_funnel_event (idempotent ingest)
-- ---------------------------------------------------------------------------
create or replace function public.record_pet_v4_funnel_event(
  p_event_name text,
  p_funnel_session_id uuid,
  p_idempotency_key text,
  p_visitor_id uuid default null,
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
  p_browser_family text default null,
  p_in_app_browser text default null,
  p_pathname text default null,
  p_amount_cents integer default null,
  p_has_meta_click boolean default false,
  p_referrer_host text default null,
  p_client_event_id uuid default null,
  p_is_test boolean default false,
  p_environment text default null,
  p_funnel_variant text default 'v4_sales',
  p_funnel_version text default 'v4',
  p_fbc text default null,
  p_fbp text default null,
  p_failure_category text default null,
  p_cta_location text default null,
  p_scroll_bucket text default null,
  p_scroll_pct integer default null,
  p_engaged_ms integer default null,
  p_generation_duration_ms integer default null,
  p_meta_placement text default null,
  p_country_code text default null,
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
  clean_path text;
  species text;
  browser_family text;
  in_app text;
  country text;
  scroll_bucket text;
  cta_location text;
  scroll_pct integer;
  variant text := lower(btrim(coalesce(p_funnel_variant, 'v4_sales')));
  version text := lower(btrim(coalesce(p_funnel_version, 'v4')));
begin
  if p_funnel_session_id is null then
    raise exception 'invalid_funnel_session_id';
  end if;
  if length(key) < 8 then
    raise exception 'invalid_idempotency_key';
  end if;

  clean_path := left(split_part(coalesce(p_pathname, ''), '?', 1), 64);
  if clean_path not in (
    '/pet/dog-v4', '/pet/cat-v4', '/pet/other-v4',
    '/pet/dog-v2', '/pet/cat-v2', '/pet/other-v2'
  ) then
    clean_path := null;
  end if;

  species := case
    when p_species in ('dog', 'cat', 'other') then p_species
    else null
  end;

  browser_family := lower(left(btrim(coalesce(p_browser_family, '')), 32));
  if browser_family = '' then
    browser_family := null;
  end if;

  in_app := lower(left(btrim(coalesce(p_in_app_browser, '')), 32));
  if in_app = '' then
    in_app := null;
  end if;

  country := upper(left(btrim(coalesce(p_country_code, '')), 2));
  if country !~ '^[A-Z]{2}$' then
    country := null;
  end if;

  scroll_bucket := lower(left(btrim(coalesce(p_scroll_bucket, '')), 32));
  if scroll_bucket not in ('lt25', 'p25', 'p50', 'p75', 'p90', 'main_cta', 'pricing') then
    scroll_bucket := null;
  end if;

  cta_location := lower(left(btrim(coalesce(p_cta_location, '')), 32));
  if cta_location not in ('hero', 'upload', 'try_generate', 'teaser', 'offer', 'buy', 'checkout', 'other') then
    cta_location := null;
  end if;

  scroll_pct := case
    when p_scroll_pct is null then null
    when p_scroll_pct < 0 then 0
    when p_scroll_pct > 100 then 100
    else p_scroll_pct
  end;

  if variant not in ('v4_sales', 'v4') then
    variant := 'v4_sales';
  end if;
  if version not in ('v4', 'unknown') then
    version := 'v4';
  end if;

  insert into public.pet_v4_funnel_events (
    event_name,
    funnel_session_id,
    visitor_id,
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
    browser_family,
    in_app_browser,
    pathname,
    amount_cents,
    has_meta_click,
    referrer_host,
    client_event_id,
    is_test,
    environment,
    funnel_variant,
    funnel_version,
    fbc,
    fbp,
    failure_category,
    cta_location,
    scroll_bucket,
    scroll_pct,
    engaged_ms,
    generation_duration_ms,
    meta_placement,
    country_code,
    stripe_checkout_session_id
  )
  values (
    p_event_name,
    p_funnel_session_id,
    p_visitor_id,
    key,
    species,
    public.pet_funnel_safe_text(p_utm_source, 120),
    public.pet_funnel_safe_text(p_utm_medium, 120),
    public.pet_funnel_safe_text(p_utm_campaign, 120),
    public.pet_funnel_safe_text(p_utm_content, 120),
    public.pet_funnel_safe_text(p_utm_term, 120),
    public.pet_funnel_safe_text(p_campaign_id, 64),
    public.pet_funnel_safe_text(p_adset_id, 64),
    public.pet_funnel_safe_text(p_ad_id, 64),
    case
      when p_device_type in ('mobile', 'tablet', 'desktop') then p_device_type
      else public.pet_funnel_safe_text(p_device_type, 16)
    end,
    browser_family,
    in_app,
    clean_path,
    case when p_amount_cents is not null and p_amount_cents >= 0 then p_amount_cents else null end,
    coalesce(p_has_meta_click, false),
    public.pet_funnel_safe_text(p_referrer_host, 120),
    p_client_event_id,
    coalesce(p_is_test, false),
    public.pet_funnel_safe_text(p_environment, 32),
    variant,
    version,
    public.pet_funnel_safe_text(p_fbc, 200),
    public.pet_funnel_safe_text(p_fbp, 200),
    public.pet_funnel_safe_text(p_failure_category, 40),
    cta_location,
    scroll_bucket,
    scroll_pct,
    case when p_engaged_ms is not null and p_engaged_ms >= 0 then p_engaged_ms else null end,
    case
      when p_generation_duration_ms is not null and p_generation_duration_ms >= 0
        then p_generation_duration_ms
      else null
    end,
    public.pet_funnel_safe_text(p_meta_placement, 80),
    country,
    public.pet_funnel_safe_text(p_stripe_checkout_session_id, 200)
  )
  on conflict (idempotency_key) do nothing
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.record_pet_v4_funnel_event(
  text, uuid, text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text, text, text, text, text, text, text, text, integer, integer, integer, text, text, text
) from public, anon;
grant execute on function public.record_pet_v4_funnel_event(
  text, uuid, text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text, text, text, text, text, text, text, text, integer, integer, integer, text, text, text
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- admin_pet_v4_analytics — rich dashboard JSON for New Sales Campaign
-- ---------------------------------------------------------------------------
create or replace function public.admin_pet_v4_analytics(
  p_from timestamptz,
  p_to timestamptz,
  p_campaign_id text default '120253729468900170'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  campaign_filter text := nullif(btrim(coalesce(p_campaign_id, '')), '');
  launch_at timestamptz := timestamptz '2026-09-09 00:00:00+00';
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  with
  ev as (
    select e.*
    from public.pet_v4_funnel_events e
    where e.created_at >= p_from
      and e.created_at < p_to
      and coalesce(e.is_test, false) = false
      and (
        campaign_filter is null
        or e.campaign_id is null
        or e.campaign_id = campaign_filter
      )
  ),
  landing as (
    select
      funnel_session_id,
      min(created_at) as landing_at
    from ev
    where event_name = 'v4_landing_view'
    group by funnel_session_id
  ),
  -- Cohort-chained sequential stages (each ⊆ prior)
  upload_started as (
    select distinct l.funnel_session_id
    from landing l
    inner join ev e
      on e.funnel_session_id = l.funnel_session_id
     and e.event_name = 'v4_upload_started'
     and e.created_at >= l.landing_at
  ),
  upload_completed as (
    select distinct u.funnel_session_id
    from upload_started u
    inner join landing l on l.funnel_session_id = u.funnel_session_id
    inner join ev e
      on e.funnel_session_id = u.funnel_session_id
     and e.event_name = 'v4_upload_completed'
     and e.created_at >= l.landing_at
  ),
  generation_completed as (
    select distinct u.funnel_session_id
    from upload_completed u
    inner join landing l on l.funnel_session_id = u.funnel_session_id
    inner join ev e
      on e.funnel_session_id = u.funnel_session_id
     and e.event_name = 'v4_generation_completed'
     and e.created_at >= l.landing_at
  ),
  teaser_viewed as (
    select distinct g.funnel_session_id
    from generation_completed g
    inner join landing l on l.funnel_session_id = g.funnel_session_id
    inner join ev e
      on e.funnel_session_id = g.funnel_session_id
     and e.event_name = 'v4_teaser_viewed'
     and e.created_at >= l.landing_at
  ),
  offer_viewed as (
    select distinct t.funnel_session_id
    from teaser_viewed t
    inner join landing l on l.funnel_session_id = t.funnel_session_id
    inner join ev e
      on e.funnel_session_id = t.funnel_session_id
     and e.event_name = 'v4_offer_viewed'
     and e.created_at >= l.landing_at
  ),
  checkout_clicked as (
    select distinct o.funnel_session_id
    from offer_viewed o
    inner join landing l on l.funnel_session_id = o.funnel_session_id
    inner join ev e
      on e.funnel_session_id = o.funnel_session_id
     and e.event_name = 'v4_checkout_clicked'
     and e.created_at >= l.landing_at
  ),
  checkout_session_created as (
    select distinct c.funnel_session_id
    from checkout_clicked c
    inner join landing l on l.funnel_session_id = c.funnel_session_id
    inner join ev e
      on e.funnel_session_id = c.funnel_session_id
     and e.event_name = 'v4_checkout_session_created'
     and e.created_at >= l.landing_at
  ),
  purchase_sessions as (
    select distinct c.funnel_session_id
    from checkout_session_created c
    inner join landing l on l.funnel_session_id = c.funnel_session_id
    where exists (
      select 1
      from ev e
      where e.funnel_session_id = c.funnel_session_id
        and e.event_name = 'v4_purchase'
        and e.created_at >= l.landing_at
    )
  ),
  sequential as (
    select
      (select count(*)::int from landing) as landing,
      (select count(*)::int from upload_started) as upload_started,
      (select count(*)::int from upload_completed) as upload_completed,
      (select count(*)::int from generation_completed) as generation_completed,
      (select count(*)::int from teaser_viewed) as teaser_viewed,
      (select count(*)::int from offer_viewed) as offer_viewed,
      (select count(*)::int from checkout_clicked) as checkout_clicked,
      (select count(*)::int from checkout_session_created) as checkout_session_created,
      (select count(*)::int from purchase_sessions) as purchase
  ),
  raw_event_counts as (
    select
      event_name,
      count(*)::int as event_count,
      count(distinct funnel_session_id)::int as unique_sessions
    from ev
    group by event_name
  ),
  paid_orders as (
    select
      o.id,
      o.paid_at,
      coalesce(o.charged_amount_cents, o.amount_cents, 0)::int as revenue_cents,
      o.stripe_checkout_session_id,
      coalesce(
        (
          select e.funnel_session_id
          from public.pet_v4_funnel_events e
          where e.event_name = 'v4_purchase'
            and e.idempotency_key = ('v4_purchase:' || o.id::text)
            and coalesce(e.is_test, false) = false
          order by e.created_at
          limit 1
        ),
        (
          select e.funnel_session_id
          from public.pet_v4_funnel_events e
          where e.stripe_checkout_session_id is not null
            and o.stripe_checkout_session_id is not null
            and e.stripe_checkout_session_id = o.stripe_checkout_session_id
            and coalesce(e.is_test, false) = false
          order by e.created_at
          limit 1
        )
      ) as funnel_session_id
    from public.pet_orders o
    where coalesce(o.funnel_variant, 'v1') = 'v4'
      and o.paid_at is not null
      and o.paid_at >= p_from
      and o.paid_at < p_to
      and coalesce(o.status, '') <> 'refunded'
      and public.pet_order_analytics_class(
        o.stripe_checkout_session_id,
        o.stripe_payment_intent_id,
        o.charged_amount_cents,
        o.amount_cents,
        o.discount_percent,
        o.stripe_payment_status
      ) = 'paid'
  ),
  first_party as (
    select
      (select count(*)::int from landing) as landing_sessions,
      (
        select count(distinct visitor_id)::int
        from ev
        where visitor_id is not null
          and event_name = 'v4_landing_view'
      ) as unique_visitors,
      (
        select count(distinct l.funnel_session_id)::int
        from landing l
        where exists (
          select 1 from ev e
          where e.funnel_session_id = l.funnel_session_id
            and (
              e.event_name = 'v4_first_interaction'
              or e.scroll_pct >= 25
              or e.scroll_bucket in ('p25', 'p50', 'p75', 'p90', 'main_cta', 'pricing')
              or e.event_name in ('v4_cta_clicked', 'v4_cta_exposed', 'v4_checkout_clicked')
            )
        )
      ) as engaged_sessions,
      (
        select count(distinct funnel_session_id)::int
        from ev where event_name = 'v4_upload_started'
      ) as upload_starts,
      (
        select count(distinct funnel_session_id)::int
        from ev where event_name = 'v4_upload_completed'
      ) as upload_completes,
      (
        select count(distinct funnel_session_id)::int
        from ev where event_name = 'v4_generation_completed'
      ) as generations,
      (
        select count(distinct funnel_session_id)::int
        from ev where event_name = 'v4_teaser_viewed'
      ) as teaser_views,
      (
        select count(distinct funnel_session_id)::int
        from ev where event_name = 'v4_offer_viewed'
      ) as offer_views,
      (
        select count(distinct funnel_session_id)::int
        from ev where event_name = 'v4_checkout_clicked'
      ) as checkout_cta_clicks,
      (
        select count(distinct funnel_session_id)::int
        from ev where event_name = 'v4_checkout_session_created'
      ) as stripe_checkout_sessions,
      (select count(*)::int from paid_orders) as purchases,
      (select coalesce(sum(revenue_cents), 0)::int from paid_orders) as revenue_cents
  ),
  scroll_depth as (
    select
      b.bucket,
      count(distinct e.funnel_session_id)::int as sessions,
      case
        when (select count(*) from landing) = 0 then 0::numeric
        else round(
          (
            count(distinct e.funnel_session_id)::numeric
            / (select count(*)::numeric from landing)
          ) * 1000
        ) / 10
      end as pct_of_landing
    from (values
      ('lt25'), ('p25'), ('p50'), ('p75'), ('p90'), ('main_cta'), ('pricing')
    ) as b(bucket)
    left join ev e
      on e.event_name = 'v4_scroll_depth'
     and e.scroll_bucket = b.bucket
     and e.funnel_session_id in (select funnel_session_id from landing)
    group by b.bucket
  ),
  session_engagement as (
    select
      l.funnel_session_id,
      count(*) filter (
        where e.event_name not in ('v4_landing_view', 'v4_scroll_depth')
          or (e.event_name = 'v4_scroll_depth' and e.scroll_bucket in ('p25', 'p50', 'p75', 'p90', 'main_cta', 'pricing'))
      )::int as meaningful_events
    from landing l
    left join ev e on e.funnel_session_id = l.funnel_session_id
    group by l.funnel_session_id
  ),
  engagement as (
    select
      count(*) filter (where meaningful_events = 0)::int as bounce,
      count(*) filter (where meaningful_events = 1)::int as single,
      count(*) filter (where meaningful_events >= 2)::int as multi
    from session_engagement
  ),
  cta_rows as (
    select
      coalesce(nullif(btrim(cta_location), ''), 'unknown') as location,
      count(distinct funnel_session_id) filter (where event_name = 'v4_cta_exposed')::int as exposures,
      count(distinct funnel_session_id) filter (where event_name = 'v4_cta_clicked')::int as clicks
    from ev
    where event_name in ('v4_cta_exposed', 'v4_cta_clicked')
    group by 1
    order by clicks desc, exposures desc
  ),
  upload_funnel as (
    select
      count(distinct funnel_session_id) filter (where event_name = 'v4_upload_opened')::int as opened,
      count(distinct funnel_session_id) filter (where event_name = 'v4_upload_started')::int as started,
      count(distinct funnel_session_id) filter (where event_name = 'v4_upload_completed')::int as completed,
      count(distinct funnel_session_id) filter (where event_name = 'v4_upload_failed')::int as failed,
      count(distinct funnel_session_id) filter (where event_name = 'v4_upload_abandoned')::int as abandoned
    from ev
  ),
  generation_stats as (
    select
      count(distinct funnel_session_id) filter (where event_name = 'v4_generation_started')::int as started,
      count(distinct funnel_session_id) filter (where event_name = 'v4_generation_completed')::int as completed,
      count(distinct funnel_session_id) filter (where event_name = 'v4_generation_failed')::int as failed,
      count(distinct funnel_session_id) filter (where event_name = 'v4_generation_left')::int as left_early,
      (
        select round(percentile_cont(0.5) within group (order by generation_duration_ms))::int
        from ev
        where event_name = 'v4_generation_completed'
          and generation_duration_ms is not null
          and generation_duration_ms >= 0
      ) as median_duration_ms
    from ev
  ),
  checkout_intent as (
    select
      count(distinct funnel_session_id) filter (where event_name = 'v4_checkout_clicked')::int as clicked,
      count(distinct funnel_session_id) filter (where event_name = 'v4_checkout_session_created')::int as session_created,
      count(distinct funnel_session_id) filter (where event_name = 'v4_checkout_opened')::int as opened,
      count(distinct funnel_session_id) filter (where event_name = 'v4_checkout_abandoned')::int as abandoned
    from ev
  ),
  session_times as (
    select
      l.funnel_session_id,
      l.landing_at,
      (select min(e.created_at) from ev e where e.funnel_session_id = l.funnel_session_id and e.event_name = 'v4_first_interaction') as first_interaction_at,
      (select min(e.created_at) from ev e where e.funnel_session_id = l.funnel_session_id and e.event_name = 'v4_upload_started') as upload_at,
      (select min(e.created_at) from ev e where e.funnel_session_id = l.funnel_session_id and e.event_name = 'v4_teaser_viewed') as teaser_at,
      (select min(e.created_at) from ev e where e.funnel_session_id = l.funnel_session_id and e.event_name = 'v4_offer_viewed') as offer_at,
      (select min(e.created_at) from ev e where e.funnel_session_id = l.funnel_session_id and e.event_name = 'v4_checkout_clicked') as checkout_click_at,
      (select min(e.created_at) from ev e where e.funnel_session_id = l.funnel_session_id and e.event_name = 'v4_purchase') as purchase_at
    from landing l
  ),
  time_to_action as (
    select
      (
        select round((percentile_cont(0.5) within group (
          order by extract(epoch from (s.first_interaction_at - s.landing_at))
        ))::numeric, 1)
        from session_times s where s.first_interaction_at is not null
      ) as landing_to_first_interaction_median_s,
      (
        select round((percentile_cont(0.75) within group (
          order by extract(epoch from (s.first_interaction_at - s.landing_at))
        ))::numeric, 1)
        from session_times s where s.first_interaction_at is not null
      ) as landing_to_first_interaction_p75_s,
      (
        select round((percentile_cont(0.5) within group (
          order by extract(epoch from (s.upload_at - s.landing_at))
        ))::numeric, 1)
        from session_times s where s.upload_at is not null
      ) as landing_to_upload_median_s,
      (
        select round((percentile_cont(0.75) within group (
          order by extract(epoch from (s.upload_at - s.landing_at))
        ))::numeric, 1)
        from session_times s where s.upload_at is not null
      ) as landing_to_upload_p75_s,
      (
        select round((percentile_cont(0.5) within group (
          order by extract(epoch from (s.teaser_at - s.upload_at))
        ))::numeric, 1)
        from session_times s where s.teaser_at is not null and s.upload_at is not null
      ) as upload_to_teaser_median_s,
      (
        select round((percentile_cont(0.5) within group (
          order by extract(epoch from (s.offer_at - s.teaser_at))
        ))::numeric, 1)
        from session_times s where s.offer_at is not null and s.teaser_at is not null
      ) as teaser_to_offer_median_s,
      (
        select round((percentile_cont(0.5) within group (
          order by extract(epoch from (s.checkout_click_at - s.offer_at))
        ))::numeric, 1)
        from session_times s where s.checkout_click_at is not null and s.offer_at is not null
      ) as offer_to_checkout_click_median_s,
      (
        select round((percentile_cont(0.5) within group (
          order by extract(epoch from (s.checkout_click_at - s.landing_at))
        ))::numeric, 1)
        from session_times s where s.checkout_click_at is not null
      ) as landing_to_checkout_median_s,
      (
        select round((percentile_cont(0.75) within group (
          order by extract(epoch from (s.checkout_click_at - s.landing_at))
        ))::numeric, 1)
        from session_times s where s.checkout_click_at is not null
      ) as landing_to_checkout_p75_s,
      (
        select round((percentile_cont(0.5) within group (
          order by extract(epoch from (s.purchase_at - s.landing_at))
        ))::numeric, 1)
        from session_times s where s.purchase_at is not null
      ) as landing_to_purchase_median_s,
      (
        select round((percentile_cont(0.75) within group (
          order by extract(epoch from (s.purchase_at - s.landing_at))
        ))::numeric, 1)
        from session_times s where s.purchase_at is not null
      ) as landing_to_purchase_p75_s
  ),
  drop_off_raw as (
    select * from (values
      (
        'landing'::text, 'upload_started'::text, 'Landing'::text, 'Photo upload started'::text,
        (select landing from sequential), (select upload_started from sequential)
      ),
      (
        'upload_started', 'upload_completed', 'Photo upload started', 'Photo upload completed',
        (select upload_started from sequential), (select upload_completed from sequential)
      ),
      (
        'upload_completed', 'generation_completed', 'Photo upload completed', 'Generation completed',
        (select upload_completed from sequential), (select generation_completed from sequential)
      ),
      (
        'generation_completed', 'teaser_viewed', 'Generation completed', 'Teaser viewed',
        (select generation_completed from sequential), (select teaser_viewed from sequential)
      ),
      (
        'teaser_viewed', 'offer_viewed', 'Teaser viewed', 'Offer viewed',
        (select teaser_viewed from sequential), (select offer_viewed from sequential)
      ),
      (
        'offer_viewed', 'checkout_clicked', 'Offer viewed', 'Checkout clicked',
        (select offer_viewed from sequential), (select checkout_clicked from sequential)
      ),
      (
        'checkout_clicked', 'checkout_session_created', 'Checkout clicked', 'Stripe checkout created',
        (select checkout_clicked from sequential), (select checkout_session_created from sequential)
      ),
      (
        'checkout_session_created', 'purchase', 'Stripe checkout created', 'Purchase',
        (select checkout_session_created from sequential), (select purchase from sequential)
      )
    ) as t(from_stage, to_stage, from_label, to_label, from_count, to_count)
  ),
  drop_offs as (
    select
      row_number() over (order by drop_off_pct desc, lost desc) as rank,
      from_stage as "from",
      to_stage as "to",
      from_label,
      to_label,
      lost,
      drop_off_pct
    from (
      select
        from_stage,
        to_stage,
        from_label,
        to_label,
        greatest(0, from_count - to_count)::int as lost,
        case
          when from_count <= 0 then 0::numeric
          else round(((from_count - to_count)::numeric / from_count::numeric) * 1000) / 10
        end as drop_off_pct
      from drop_off_raw
      where from_count > 0
    ) x
  ),
  journey_sessions as (
    select
      l.funnel_session_id,
      l.landing_at,
      upper(left(replace(l.funnel_session_id::text, '-', ''), 4)) as session_short,
      (
        select coalesce(
          nullif(btrim(e.meta_placement), ''),
          case
            when lower(coalesce(e.utm_content, '')) like '%reel%' then 'reels'
            when lower(coalesce(e.utm_content, '')) like '%story%' then 'stories'
            when lower(coalesce(e.utm_medium, '')) like '%cpc%'
              or e.has_meta_click
              or nullif(btrim(e.campaign_id), '') is not null
              then 'feed'
            else 'unknown'
          end
        )
        from ev e
        where e.funnel_session_id = l.funnel_session_id
        order by e.created_at
        limit 1
      ) as placement,
      (select max(e.created_at) from ev e where e.funnel_session_id = l.funnel_session_id) as last_at,
      exists (
        select 1 from purchase_sessions p where p.funnel_session_id = l.funnel_session_id
      ) or exists (
        select 1 from paid_orders po where po.funnel_session_id = l.funnel_session_id
      ) as purchased,
      exists (
        select 1 from ev e
        where e.funnel_session_id = l.funnel_session_id
          and e.event_name in ('v4_checkout_clicked', 'v4_checkout_session_created', 'v4_checkout_opened')
      ) as reached_checkout,
      exists (
        select 1 from ev e
        where e.funnel_session_id = l.funnel_session_id
          and e.event_name in ('v4_upload_started', 'v4_upload_completed')
      ) as uploaded,
      exists (
        select 1 from ev e
        where e.funnel_session_id = l.funnel_session_id
          and e.event_name = 'v4_offer_viewed'
      )
      and not exists (
        select 1 from ev e
        where e.funnel_session_id = l.funnel_session_id
          and e.event_name in ('v4_checkout_clicked', 'v4_purchase')
      ) as abandoned_offer,
      (
        select coalesce(sum(po.revenue_cents), 0)::int
        from paid_orders po
        where po.funnel_session_id = l.funnel_session_id
      ) as revenue_cents
    from landing l
    order by l.landing_at desc
    limit 40
  ),
  journeys as (
    select
      j.session_short,
      j.landing_at,
      j.placement,
      greatest(0, extract(epoch from (j.last_at - j.landing_at)))::int as duration_seconds,
      j.purchased,
      j.reached_checkout,
      j.uploaded,
      (
        select se.meaningful_events = 0
        from session_engagement se
        where se.funnel_session_id = j.funnel_session_id
      ) as bounced,
      j.abandoned_offer,
      nullif(j.revenue_cents, 0) as revenue_cents,
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'event_name', e.event_name,
              'created_at', e.created_at,
              'cta_location', e.cta_location,
              'scroll_bucket', e.scroll_bucket,
              'device_type', e.device_type
            )
            order by e.created_at
          ),
          '[]'::jsonb
        )
        from ev e
        where e.funnel_session_id = j.funnel_session_id
      ) as timeline
    from journey_sessions j
  ),
  device_breakdown as (
    select
      coalesce(nullif(btrim(device_type), ''), 'unknown') as key,
      count(distinct funnel_session_id) filter (where event_name = 'v4_landing_view')::int as landing_sessions,
      count(distinct funnel_session_id) filter (where event_name = 'v4_checkout_clicked')::int as checkout_clicks,
      count(distinct funnel_session_id) filter (where event_name = 'v4_purchase')::int as purchases
    from ev
    group by 1
    order by landing_sessions desc
  ),
  browser_breakdown as (
    select
      case
        when nullif(btrim(in_app_browser), '') is not null then 'in_app:' || in_app_browser
        else coalesce(nullif(btrim(browser_family), ''), 'unknown')
      end as key,
      count(distinct funnel_session_id) filter (where event_name = 'v4_landing_view')::int as landing_sessions,
      count(distinct funnel_session_id) filter (where event_name = 'v4_checkout_clicked')::int as checkout_clicks,
      count(distinct funnel_session_id) filter (where event_name = 'v4_purchase')::int as purchases
    from ev
    group by 1
    order by landing_sessions desc
  ),
  country_breakdown as (
    select
      coalesce(nullif(btrim(country_code), ''), 'unknown') as key,
      count(distinct funnel_session_id) filter (where event_name = 'v4_landing_view')::int as landing_sessions,
      count(distinct funnel_session_id) filter (where event_name = 'v4_purchase')::int as purchases
    from ev
    group by 1
    order by landing_sessions desc
    limit 30
  ),
  placement_breakdown as (
    select
      coalesce(
        nullif(btrim(meta_placement), ''),
        case
          when lower(coalesce(utm_content, '')) like '%reel%' then 'reels'
          when lower(coalesce(utm_content, '')) like '%story%' then 'stories'
          when has_meta_click or nullif(btrim(campaign_id), '') is not null then 'feed'
          else 'unknown'
        end
      ) as key,
      count(distinct funnel_session_id) filter (where event_name = 'v4_landing_view')::int as landing_sessions,
      count(distinct funnel_session_id) filter (where event_name = 'v4_checkout_clicked')::int as checkout_clicks,
      count(distinct funnel_session_id) filter (where event_name = 'v4_purchase')::int as purchases
    from ev
    group by 1
    order by landing_sessions desc
  ),
  recent_window as (
    select *
    from public.pet_v4_funnel_events e
    where e.created_at >= (now() - interval '60 minutes')
      and coalesce(e.is_test, false) = false
      and (
        campaign_filter is null
        or e.campaign_id is null
        or e.campaign_id = campaign_filter
      )
  ),
  recent_60m as (
    select
      count(distinct visitor_id) filter (where visitor_id is not null)::int as visitors,
      count(distinct funnel_session_id) filter (where event_name = 'v4_upload_started')::int as uploads,
      count(distinct funnel_session_id) filter (where event_name = 'v4_offer_viewed')::int as offers,
      count(distinct funnel_session_id) filter (where event_name = 'v4_checkout_clicked')::int as checkout_clicks,
      count(distinct funnel_session_id) filter (where event_name = 'v4_purchase')::int as purchases,
      max(created_at) as last_event_at
    from recent_window
  ),
  data_quality as (
    select
      (
        select count(distinct l.funnel_session_id)::int
        from landing l
        where not exists (
          select 1 from ev e
          where e.funnel_session_id = l.funnel_session_id
            and nullif(btrim(e.campaign_id), '') is not null
        )
      ) as unattributed_sessions,
      0::int as duplicate_event_keys,
      (
        select count(distinct e.funnel_session_id)::int
        from ev e
        where e.event_name = 'v4_checkout_session_created'
          and not exists (
            select 1 from ev c
            where c.funnel_session_id = e.funnel_session_id
              and c.event_name = 'v4_checkout_clicked'
          )
      ) as checkout_sessions_without_click,
      (
        select count(*)::int
        from paid_orders po
        where po.funnel_session_id is null
      ) as purchases_without_session,
      (
        select max(created_at)
        from public.pet_v4_funnel_events
        where coalesce(is_test, false) = false
      ) as first_party_freshness,
      (select count(*)::int from ev) as events_in_range
  ),
  meta_totals as (
    select
      coalesce(sum(m.spend_cents), 0)::bigint as spend_cents,
      coalesce(sum(m.impressions), 0)::bigint as impressions,
      coalesce(sum(m.reach), 0)::bigint as reach,
      coalesce(sum(m.link_clicks), 0)::bigint as link_clicks,
      coalesce(sum(m.landing_page_views), 0)::bigint as landing_page_views,
      coalesce(sum(m.purchases), 0)::bigint as purchases,
      coalesce(sum(m.purchase_value_cents), 0)::bigint as purchase_value_cents,
      count(*)::int as row_count
    from public.pet_meta_daily_metrics m
    where campaign_filter is not null
      and m.campaign_id = campaign_filter
      and m.metric_date >= (p_from at time zone 'UTC')::date
      and m.metric_date < (p_to at time zone 'UTC')::date
      and exists (
        select 1
        from public.pet_meta_campaign_allowlist a
        where a.enabled and a.campaign_id = m.campaign_id
      )
  )
  select jsonb_build_object(
    'campaign_id', campaign_filter,
    'from', p_from,
    'to', p_to,
    'launch_at', launch_at,
    'first_event_at', (
      select min(created_at)
      from public.pet_v4_funnel_events
      where coalesce(is_test, false) = false
    ),
    'sequential', (select to_jsonb(sequential) from sequential),
    'raw_event_counts', coalesce(
      (select jsonb_agg(to_jsonb(raw_event_counts) order by unique_sessions desc, event_name)
       from raw_event_counts),
      '[]'::jsonb
    ),
    'first_party', (select to_jsonb(first_party) from first_party),
    'behavior', jsonb_build_object(
      'scroll_depth', coalesce(
        (select jsonb_agg(to_jsonb(scroll_depth) order by bucket) from scroll_depth),
        '[]'::jsonb
      ),
      'engagement', (select to_jsonb(engagement) from engagement),
      'cta', coalesce(
        (select jsonb_agg(to_jsonb(cta_rows)) from cta_rows),
        '[]'::jsonb
      ),
      'upload', (select to_jsonb(upload_funnel) from upload_funnel),
      'generation', (select to_jsonb(generation_stats) from generation_stats),
      'checkout_intent', (select to_jsonb(checkout_intent) from checkout_intent)
    ),
    'time_to_action', (select to_jsonb(time_to_action) from time_to_action),
    'drop_offs', coalesce(
      (select jsonb_agg(to_jsonb(drop_offs) order by rank) from drop_offs),
      '[]'::jsonb
    ),
    'journeys', coalesce(
      (select jsonb_agg(to_jsonb(journeys) order by landing_at desc) from journeys),
      '[]'::jsonb
    ),
    'breakdowns', jsonb_build_object(
      'device', coalesce((select jsonb_agg(to_jsonb(device_breakdown)) from device_breakdown), '[]'::jsonb),
      'browser', coalesce((select jsonb_agg(to_jsonb(browser_breakdown)) from browser_breakdown), '[]'::jsonb),
      'country', coalesce((select jsonb_agg(to_jsonb(country_breakdown)) from country_breakdown), '[]'::jsonb),
      'placement', coalesce((select jsonb_agg(to_jsonb(placement_breakdown)) from placement_breakdown), '[]'::jsonb)
    ),
    'recent_60m', (select to_jsonb(recent_60m) from recent_60m),
    'data_quality', (select to_jsonb(data_quality) from data_quality),
    'meta', (select to_jsonb(meta_totals) from meta_totals)
  )
  into result;

  return result;
end;
$$;

revoke all on function public.admin_pet_v4_analytics(timestamptz, timestamptz, text)
  from public, anon;
grant execute on function public.admin_pet_v4_analytics(timestamptz, timestamptz, text)
  to authenticated, service_role;

commit;
