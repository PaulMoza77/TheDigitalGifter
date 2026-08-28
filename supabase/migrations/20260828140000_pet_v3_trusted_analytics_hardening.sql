-- Hardening pass for V3 trusted analytics: paid_meta classification, server-authorized
-- internal test sessions, uncertified price cohort until admin certification.

set lock_timeout = '5s';
set statement_timeout = '180s';

begin;

alter table public.pet_v3_measurement_settings
  add column if not exists price_cohort_certified_at timestamptz,
  add column if not exists price_deploy_reference_sha text,
  add column if not exists price_deploy_reference_at timestamptz;

update public.pet_v3_measurement_settings
set
  price_cohort_from = null,
  price_cohort_certified_at = null,
  price_deploy_reference_sha = coalesce(price_deploy_reference_sha, '01fde3223ace0c17a183db0b93ee11296795653f'),
  price_deploy_reference_at = coalesce(price_deploy_reference_at, timestamptz '2026-08-27 21:28:28+00')
where id = 1;

-- Server-authorized internal test sessions (admin registered only)
create table if not exists public.pet_v3_internal_test_sessions (
  funnel_session_id uuid primary key,
  reason text not null,
  registered_at timestamptz not null default now(),
  expires_at timestamptz,
  registered_by text not null default 'admin'
);

alter table public.pet_v3_internal_test_sessions enable row level security;
drop policy if exists pet_v3_internal_test_sessions_admin_read on public.pet_v3_internal_test_sessions;
create policy pet_v3_internal_test_sessions_admin_read
  on public.pet_v3_internal_test_sessions for select
  using (public.is_admin());
revoke all on table public.pet_v3_internal_test_sessions from anon, public;
grant select on table public.pet_v3_internal_test_sessions to authenticated;
grant all on table public.pet_v3_internal_test_sessions to service_role;

create or replace function public.pet_v3_session_is_internal_test(p_funnel_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.pet_v3_analytics_session_exclusions x
      where x.funnel_session_id = p_funnel_session_id
    )
    or exists (
      select 1 from public.pet_v3_internal_test_sessions s
      where s.funnel_session_id = p_funnel_session_id
        and (s.expires_at is null or s.expires_at > now())
    );
$$;

revoke all on function public.pet_v3_session_is_internal_test(uuid) from public, anon;
grant execute on function public.pet_v3_session_is_internal_test(uuid) to service_role;

create or replace function public.pet_v3_internal_test_session_status(p_funnel_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  exp timestamptz;
begin
  select s.expires_at into exp
  from public.pet_v3_internal_test_sessions s
  where s.funnel_session_id = p_funnel_session_id
    and (s.expires_at is null or s.expires_at > now());

  if found then
    return jsonb_build_object('authorized', true, 'expires_at', exp);
  end if;

  if exists (
    select 1 from public.pet_v3_analytics_session_exclusions x
    where x.funnel_session_id = p_funnel_session_id
  ) then
    return jsonb_build_object('authorized', true, 'expires_at', null);
  end if;

  return jsonb_build_object('authorized', false, 'expires_at', null);
end;
$$;

revoke all on function public.pet_v3_internal_test_session_status(uuid) from public, anon;
grant execute on function public.pet_v3_internal_test_session_status(uuid) to service_role;

create or replace function public.admin_pet_v3_register_internal_test_session(
  p_funnel_session_id uuid,
  p_reason text default 'admin manual test',
  p_expires_hours integer default 24
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  exp timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  exp := case
    when coalesce(p_expires_hours, 0) <= 0 then null
    else now() + make_interval(hours => greatest(p_expires_hours, 1))
  end;
  insert into public.pet_v3_internal_test_sessions (funnel_session_id, reason, expires_at, registered_by)
  values (p_funnel_session_id, left(coalesce(nullif(btrim(p_reason), ''), 'admin manual test'), 200), exp, 'admin')
  on conflict (funnel_session_id) do update set
    reason = excluded.reason,
    expires_at = excluded.expires_at,
    registered_at = now(),
    registered_by = 'admin';
  insert into public.pet_v3_analytics_session_exclusions (funnel_session_id, reason, excluded_by, notes)
  values (p_funnel_session_id, left(coalesce(nullif(btrim(p_reason), ''), 'admin manual test'), 200), 'admin', 'registered via admin_pet_v3_register_internal_test_session')
  on conflict (funnel_session_id) do nothing;
  update public.pet_v3_funnel_events
  set is_test = true, traffic_class = 'internal_test'
  where funnel_session_id = p_funnel_session_id
    and coalesce(is_test, false) = false;
  return public.pet_v3_internal_test_session_status(p_funnel_session_id);
end;
$$;

create or replace function public.admin_pet_v3_unregister_internal_test_session(p_funnel_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  delete from public.pet_v3_internal_test_sessions where funnel_session_id = p_funnel_session_id;
  delete from public.pet_v3_analytics_session_exclusions where funnel_session_id = p_funnel_session_id;
  return jsonb_build_object('authorized', false, 'expires_at', null);
end;
$$;

revoke all on function public.admin_pet_v3_register_internal_test_session(uuid, text, integer) from public, anon;
grant execute on function public.admin_pet_v3_register_internal_test_session(uuid, text, integer) to authenticated, service_role;
revoke all on function public.admin_pet_v3_unregister_internal_test_session(uuid) from public, anon;
grant execute on function public.admin_pet_v3_unregister_internal_test_session(uuid) to authenticated, service_role;

-- Paid Meta: fbp alone is NOT sufficient; requires paid-click/campaign evidence.
drop function if exists public.classify_pet_v3_traffic(boolean, text, text, text, text, boolean, text, text, text);

create or replace function public.classify_pet_v3_traffic(
  p_is_test boolean,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text,
  p_campaign_id text,
  p_adset_id text,
  p_ad_id text,
  p_creative_id text,
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
    when coalesce(p_has_meta_click, false)
      or (coalesce(btrim(p_fbc), '') like 'fb.%' and coalesce(btrim(p_fbc), '') like '%.%')
      or coalesce(btrim(p_campaign_id), '') <> ''
      or coalesce(btrim(p_adset_id), '') <> ''
      or coalesce(btrim(p_ad_id), '') <> ''
      or coalesce(btrim(p_creative_id), '') <> ''
      or (
        lower(coalesce(p_utm_source, '')) in ('facebook','fb','instagram','ig','an','msg','meta','paid_social')
        and (
          lower(coalesce(p_utm_medium, '')) in ('cpc','paid','paid_social','paidsocial','ppc')
          or coalesce(btrim(p_utm_campaign), '') <> ''
        )
      )
      or (
        lower(coalesce(p_utm_medium, '')) in ('cpc','paid','paid_social','paidsocial','ppc')
        and coalesce(btrim(p_utm_campaign), '') <> ''
      )
      then 'paid_meta'
    when coalesce(btrim(p_utm_source), '') <> ''
      or coalesce(btrim(p_referrer_host), '') <> ''
      or lower(coalesce(p_utm_source, '')) in ('facebook','fb','instagram','ig','an','msg','meta','paid_social')
      then 'external_other'
    else 'unattributed'
  end;
$$;

-- Recompute traffic_class with hardened rules (raw rows preserved)
update public.pet_v3_funnel_events e
set traffic_class = public.classify_pet_v3_traffic(
  public.pet_v3_session_is_internal_test(e.funnel_session_id),
  e.utm_source, e.utm_medium, e.utm_campaign, e.campaign_id, e.adset_id, e.ad_id, e.creative_id,
  e.has_meta_click, e.fbc, e.fbp, e.referrer_host
);

-- Patch ingest RPC: authoritative internal test from server registry only
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
  is_test boolean;
  traffic text;
  price_cohort_certified timestamptz;
  price_cohort_cents integer;
begin
  if length(key) < 8 then
    raise exception 'invalid_idempotency_key';
  end if;
  if version not in ('v3', 'unknown') then
    version := 'v3';
  end if;

  is_test := public.pet_v3_session_is_internal_test(p_funnel_session_id)
    or (coalesce(p_environment, '') <> 'production' and coalesce(p_is_test, false));

  traffic := public.classify_pet_v3_traffic(
    is_test, p_utm_source, p_utm_medium, p_utm_campaign,
    p_campaign_id, p_adset_id, p_ad_id, p_creative_id,
    coalesce(p_has_meta_click, false), p_fbc, p_fbp, p_referrer_host
  );

  select s.price_cohort_certified_at, s.price_cohort_cents
    into price_cohort_certified, price_cohort_cents
  from public.pet_v3_measurement_settings s where s.id = 1;

  insert into public.pet_v3_funnel_events (
    event_name, funnel_session_id, idempotency_key, species,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    campaign_id, adset_id, ad_id, device_type, pathname, amount_cents,
    has_meta_click, referrer_host, client_event_id, is_test, environment,
    funnel_version, creative_id, fbc, fbp, client_ip, client_ip_hostname,
    traffic_class, displayed_price_cents, stripe_checkout_session_id
  )
  values (
    p_event_name, p_funnel_session_id, key, coalesce(nullif(btrim(p_species), ''), 'cat'),
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
    p_amount_cents, coalesce(p_has_meta_click, false),
    public.pet_funnel_safe_text(p_referrer_host, 120),
    p_client_event_id, is_test, public.pet_funnel_safe_text(p_environment, 32),
    version,
    public.pet_funnel_safe_text(p_creative_id, 120),
    public.pet_funnel_safe_text(p_fbc, 200),
    public.pet_funnel_safe_text(p_fbp, 200),
    public.pet_funnel_safe_text(p_client_ip, 64),
    public.pet_funnel_safe_text(p_client_ip_hostname, 200),
    traffic,
    coalesce(
      p_displayed_price_cents,
      p_amount_cents,
      case when price_cohort_certified is not null then price_cohort_cents else null end
    ),
    public.pet_funnel_safe_text(p_stripe_checkout_session_id, 200)
  )
  on conflict (idempotency_key) do nothing
  returning id into new_id;

  return new_id;
end;
$$;

-- Parameter rename requires DROP; CREATE OR REPLACE cannot change input names.
drop function if exists public.admin_pet_v3_certify_measurement(timestamptz, timestamptz);

create or replace function public.admin_pet_v3_certify_measurement(
  p_measurement_reliable_from timestamptz,
  p_price_cohort_certified_at timestamptz default null
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
    price_cohort_certified_at = coalesce(p_price_cohort_certified_at, p_measurement_reliable_from),
    price_cohort_from = coalesce(p_price_cohort_certified_at, p_measurement_reliable_from),
    updated_at = now()
  where id = 1;
  return (select to_jsonb(s) from public.pet_v3_measurement_settings s where s.id = 1);
end;
$$;

revoke all on function public.admin_pet_v3_certify_measurement(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_pet_v3_certify_measurement(timestamptz, timestamptz) to authenticated, service_role;

-- Price cohort filter uses certified timestamp only (not git/deploy reference)
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

commit;
