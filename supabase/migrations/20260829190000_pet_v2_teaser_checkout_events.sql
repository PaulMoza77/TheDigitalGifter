-- Expand V2 funnel event allow-list for teaser → on-domain checkout → paid generation.
-- Preserves prior function signature and safe-text helpers.

begin;
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
  p_environment text default null
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
    environment
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
    coalesce(p_is_test, false),
    public.pet_funnel_safe_text(p_environment, 32)
  )
  on conflict (idempotency_key) do nothing
  returning id into new_id;

  return new_id;
end;
$$;
revoke all on function public.record_pet_v2_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text
) from public;
grant execute on function public.record_pet_v2_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text
) to anon, authenticated, service_role;
commit;
