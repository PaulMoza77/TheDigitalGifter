-- Allow first-party diagnostic event: photo_step_viewed
-- Distinguishes "name submitted but create screen never rendered"
-- from "create screen rendered but upload abandoned".
-- Does not delete or rewrite historical pet_funnel_events rows.

begin;

alter table public.pet_funnel_events
  drop constraint if exists pet_funnel_events_name_chk;

alter table public.pet_funnel_events
  add constraint pet_funnel_events_name_chk check (
    event_name in (
      'landing_view',
      'pet_name_submitted',
      'photo_step_viewed',
      'photo_upload_started',
      'photo_upload_completed',
      'pet_details_completed',
      'order_review_viewed',
      'initiate_checkout',
      'purchase',
      'checkout_error'
    )
  );

create or replace function public.record_pet_funnel_event(
  p_event_name text,
  p_funnel_session_id uuid,
  p_idempotency_key text,
  p_order_id uuid default null,
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
  p_is_test boolean default false,
  p_environment text default null,
  p_has_meta_click boolean default false,
  p_referrer_host text default null,
  p_client_event_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed constant text[] := array[
    'landing_view',
    'pet_name_submitted',
    'photo_step_viewed',
    'photo_upload_completed',
    'order_review_viewed',
    'initiate_checkout',
    'purchase',
    'photo_upload_started',
    'pet_details_completed',
    'checkout_error'
  ];
  clean_path text;
  new_id uuid;
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

  clean_path := public.pet_funnel_safe_text(split_part(coalesce(p_pathname, ''), '?', 1), 64);
  if clean_path is not null and clean_path <> '/pet' and left(clean_path, 5) <> '/pet/' then
    clean_path := null;
  end if;

  insert into public.pet_funnel_events (
    event_name,
    funnel_session_id,
    order_id,
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
    is_test,
    environment,
    has_meta_click,
    referrer_host,
    client_event_id
  )
  values (
    p_event_name,
    p_funnel_session_id,
    p_order_id,
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
    coalesce(p_is_test, false),
    public.pet_funnel_safe_text(p_environment, 32),
    coalesce(p_has_meta_click, false),
    public.pet_funnel_safe_text(p_referrer_host, 120),
    p_client_event_id
  )
  on conflict (idempotency_key) do nothing
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.record_pet_funnel_event(
  text, uuid, text, uuid, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, boolean, text, uuid
) from public, anon, authenticated;
grant execute on function public.record_pet_funnel_event(
  text, uuid, text, uuid, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, boolean, text, uuid
) to service_role;

commit;
