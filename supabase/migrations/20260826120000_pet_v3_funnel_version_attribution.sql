-- Cat V3: explicit funnel_version + creative/fbc/fbp attribution columns.

begin;

alter table public.pet_v3_funnel_events
  add column if not exists funnel_version text,
  add column if not exists creative_id text,
  add column if not exists fbc text,
  add column if not exists fbp text;

alter table public.pet_v3_funnel_events drop constraint if exists pet_v3_funnel_events_version_chk;
alter table public.pet_v3_funnel_events
  add constraint pet_v3_funnel_events_version_chk
  check (funnel_version is null or funnel_version in ('v3', 'unknown'));

create index if not exists pet_v3_funnel_events_version_created_idx
  on public.pet_v3_funnel_events (funnel_version, created_at desc)
  where funnel_version is not null;

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
  p_fbp text default null
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
begin
  if length(key) < 8 then
    raise exception 'invalid_idempotency_key';
  end if;
  if version not in ('v3', 'unknown') then
    version := 'v3';
  end if;

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
    fbp
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
    coalesce(p_is_test, false),
    public.pet_funnel_safe_text(p_environment, 32),
    version,
    public.pet_funnel_safe_text(p_creative_id, 120),
    public.pet_funnel_safe_text(p_fbc, 200),
    public.pet_funnel_safe_text(p_fbp, 200)
  )
  on conflict (idempotency_key) do nothing
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.record_pet_v3_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_pet_v3_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text, text, text, text, text
) to service_role;

create or replace function public.admin_pet_v3_funnel_step_counts(
  p_from timestamptz,
  p_to timestamptz,
  p_funnel_version text default 'v3'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  version_filter text := lower(btrim(coalesce(p_funnel_version, 'v3')));
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if version_filter = 'all' then
    version_filter := null;
  elsif version_filter not in ('v3', 'unknown') then
    version_filter := 'v3';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'event_name', event_name,
          'unique_sessions', unique_sessions,
          'event_count', event_count
        )
        order by event_name
      ),
      '[]'::jsonb
    )
    from (
      select
        event_name,
        count(distinct funnel_session_id)::int as unique_sessions,
        count(*)::int as event_count
      from public.pet_v3_funnel_events
      where created_at >= p_from
        and created_at < p_to
        and coalesce(is_test, false) = false
        and (version_filter is null or coalesce(funnel_version, 'v3') = version_filter)
        and event_name in (
          'v3_landing_view', 'v3_upload_started', 'v3_upload_completed',
          'v3_preview_generation_started', 'v3_preview_generation_completed', 'v3_preview_generation_failed',
          'v3_preview_viewed', 'v3_offer_viewed', 'v3_unlock_clicked',
          'v3_begin_checkout', 'v3_purchase'
        )
      group by event_name
    ) s
  );
end;
$$;

revoke all on function public.admin_pet_v3_funnel_step_counts(timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.admin_pet_v3_funnel_step_counts(timestamptz, timestamptz, text)
  to authenticated, service_role;

commit;
