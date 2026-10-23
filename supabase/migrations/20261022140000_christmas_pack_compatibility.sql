-- Christmas V2 portrait pack funnel (people). Parallel to pet funnel; does not alter pet_* tables.

begin;

alter table public.christmas_orders add column if not exists id uuid default gen_random_uuid();
alter table public.christmas_orders add column if not exists public_token_hash text;
alter table public.christmas_orders add column if not exists public_token_ciphertext text;
alter table public.christmas_orders add column if not exists email text;
alter table public.christmas_orders add column if not exists email_normalized text;
alter table public.christmas_orders add column if not exists customer_name text;
alter table public.christmas_orders add column if not exists sku text;
alter table public.christmas_orders add column if not exists pack_key text;
alter table public.christmas_orders add column if not exists product_type text default 'christmas_portrait_pack';
alter table public.christmas_orders add column if not exists amount_cents integer;
alter table public.christmas_orders add column if not exists charged_amount_cents integer;
alter table public.christmas_orders add column if not exists currency text default 'usd';
alter table public.christmas_orders add column if not exists status text default 'awaiting_upload';
alter table public.christmas_orders add column if not exists image_count integer;
alter table public.christmas_orders add column if not exists video_count integer default 0;
alter table public.christmas_orders add column if not exists parent_order_id uuid references public.christmas_orders (id) on delete set null;
alter table public.christmas_orders add column if not exists photo_bucket text;
alter table public.christmas_orders add column if not exists photo_path text;
alter table public.christmas_orders add column if not exists photo_content_type text;
alter table public.christmas_orders add column if not exists photo_file_name text;
alter table public.christmas_orders add column if not exists photo_byte_size integer;
alter table public.christmas_orders add column if not exists photo_confirmed_at timestamptz;
alter table public.christmas_orders add column if not exists stripe_checkout_session_id text;
alter table public.christmas_orders add column if not exists stripe_payment_intent_id text;
alter table public.christmas_orders add column if not exists stripe_payment_status text;
alter table public.christmas_orders add column if not exists paid_at timestamptz;
alter table public.christmas_orders add column if not exists generation_started_at timestamptz;
alter table public.christmas_orders add column if not exists generation_finished_at timestamptz;
alter table public.christmas_orders add column if not exists completed_at timestamptz;
alter table public.christmas_orders add column if not exists delivery_email_sent_at timestamptz;
alter table public.christmas_orders add column if not exists meta_event_id text;
alter table public.christmas_orders add column if not exists funnel_session_id uuid;
alter table public.christmas_orders add column if not exists scene_keys jsonb default '[]'::jsonb;
alter table public.christmas_orders add column if not exists video_source_scene_keys jsonb default '[]'::jsonb;
alter table public.christmas_orders add column if not exists surprise_me boolean default false;
alter table public.christmas_orders add column if not exists last_error text;
alter table public.christmas_orders add column if not exists created_at timestamptz default now();
alter table public.christmas_orders add column if not exists updated_at timestamptz default now();
create unique index if not exists christmas_orders_public_token_hash_uidx
  on public.christmas_orders (public_token_hash);

create unique index if not exists christmas_orders_meta_event_id_uidx
  on public.christmas_orders (meta_event_id);

create unique index if not exists christmas_orders_stripe_session_uidx
  on public.christmas_orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null
    and length(trim(stripe_checkout_session_id)) > 0;

create index if not exists christmas_orders_email_normalized_idx
  on public.christmas_orders (email_normalized);

create index if not exists christmas_orders_status_created_idx
  on public.christmas_orders (status, created_at desc);

create table if not exists public.christmas_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_orders (id) on delete cascade,
  stripe_session_id text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists christmas_checkout_sessions_session_uidx
  on public.christmas_checkout_sessions (stripe_session_id);

create table if not exists public.christmas_order_scenes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_orders (id) on delete cascade,
  scene_key text not null,
  scene_number integer not null,
  title text not null,
  status text not null default 'queued',
  progress_percent integer not null default 0,
  replicate_prediction_id text,
  model_name text,
  attempts integer not null default 0,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  result_bucket text,
  result_path text,
  result_content_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_order_scenes_status_chk check (
    status in ('queued', 'generating', 'succeeded', 'failed', 'ready')
  )
);

create unique index if not exists christmas_order_scenes_order_key_uidx
  on public.christmas_order_scenes (order_id, scene_key);

create table if not exists public.christmas_order_videos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_orders (id) on delete cascade,
  source_scene_key text not null,
  status text not null default 'queued',
  replicate_prediction_id text,
  model_name text,
  attempts integer not null default 0,
  last_error text,
  result_bucket text,
  result_path text,
  result_content_type text,
  duration_seconds numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint christmas_order_videos_status_chk check (
    status in ('queued', 'generating', 'succeeded', 'failed', 'ready')
  )
);

create table if not exists public.christmas_pack_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_orders (id) on delete cascade,
  status text not null default 'queued',
  claimed_at timestamptz,
  finished_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_pack_generation_jobs_status_chk check (
    status in ('queued', 'running', 'held', 'completed', 'failed')
  )
);

create unique index if not exists christmas_pack_generation_jobs_order_uidx
  on public.christmas_pack_generation_jobs (order_id);

create table if not exists public.christmas_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_orders (id) on delete cascade,
  kind text not null,
  provider_message_id text,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  constraint christmas_email_deliveries_kind_chk check (
    kind in ('starter_ready', 'magic_ready', 'ultimate_ready', 'partial_failure')
  ),
  constraint christmas_email_deliveries_status_chk check (
    status in ('queued', 'sent', 'skipped', 'failed')
  )
);

create unique index if not exists christmas_email_deliveries_order_kind_uidx
  on public.christmas_email_deliveries (order_id, kind);

create table if not exists public.christmas_v2_funnel_events (
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
  funnel_variant text default 'christmas_v2',
  funnel_version text default 'christmas_v2',
  failure_category text,
  created_at timestamptz not null default now()
);

create unique index if not exists christmas_v2_funnel_events_idem_uidx
  on public.christmas_v2_funnel_events (idempotency_key);

create index if not exists christmas_v2_funnel_events_session_idx
  on public.christmas_v2_funnel_events (funnel_session_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('christmas-source-photos', 'christmas-source-photos', false, 15728640, array['image/jpeg','image/png','image/webp']),
  ('christmas-generated', 'christmas-generated', false, 52428800, array['image/jpeg','image/png','image/webp','video/mp4'])
on conflict (id) do nothing;

create or replace function public.record_christmas_v2_funnel_event(
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
  p_failure_category text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.christmas_v2_funnel_events (
    event_name, funnel_session_id, event_id, idempotency_key, device_type, pathname,
    amount_cents, product, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    campaign_id, adset_id, ad_id, has_meta_click, referrer_host, failure_category
  ) values (
    p_event_name, p_funnel_session_id, p_event_id, p_idempotency_key, p_device_type, p_pathname,
    p_amount_cents, p_product, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term,
    p_campaign_id, p_adset_id, p_ad_id, p_has_meta_click, p_referrer_host, p_failure_category
  )
  on conflict (idempotency_key) do nothing;

  if found then
    return jsonb_build_object('ok', true, 'duplicate', false);
  end if;
  return jsonb_build_object('ok', true, 'duplicate', true);
end;
$$;

create or replace function public.fulfill_christmas_order_payment(
  p_event_id text,
  p_session_id text,
  p_event_type text,
  p_payment_status text,
  p_payment_intent_id text,
  p_amount_cents integer,
  p_currency text,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.christmas_orders%rowtype;
  already boolean := false;
begin
  select * into order_row from public.christmas_orders where id = p_order_id for update;
  if not found then
    raise exception 'christmas order not found';
  end if;

  if order_row.paid_at is not null then
    already := true;
  else
    update public.christmas_orders
    set
      status = 'paid',
      paid_at = now(),
      stripe_checkout_session_id = coalesce(nullif(p_session_id, ''), stripe_checkout_session_id),
      stripe_payment_intent_id = nullif(p_payment_intent_id, ''),
      stripe_payment_status = coalesce(nullif(p_payment_status, ''), 'paid'),
      charged_amount_cents = coalesce(p_amount_cents, amount_cents),
      updated_at = now()
    where id = p_order_id;

    insert into public.christmas_pack_generation_jobs (order_id, status)
    values (p_order_id, 'queued')
    on conflict (order_id) do nothing;
  end if;

  insert into public.processed_stripe_events (event_id, event_type, stripe_session_id, result)
  values (
    p_event_id,
    p_event_type,
    p_session_id,
    jsonb_build_object(
      'status', case when already then 'already_paid' else 'fulfilled' end,
      'christmas_order_id', p_order_id,
      'should_enqueue', true
    )
  )
  on conflict (event_id) do nothing;

  return jsonb_build_object(
    'status', case when already then 'already_paid' else 'fulfilled' end,
    'should_enqueue', true,
    'already_paid', already,
    'christmas_order_id', p_order_id,
    'meta_event_id', order_row.meta_event_id
  );
end;
$$;

create or replace function public.claim_christmas_pack_generation_job(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  job public.christmas_pack_generation_jobs%rowtype;
begin
  select * into job from public.christmas_pack_generation_jobs where order_id = p_order_id for update;
  if not found then
    return jsonb_build_object('claimed', false, 'status', 'missing');
  end if;
  if job.status = 'running' and job.claimed_at is not null and job.claimed_at > now() - interval '3 minutes' then
    return jsonb_build_object('claimed', false, 'status', 'running');
  end if;
  update public.christmas_pack_generation_jobs
  set status = 'running', claimed_at = now(), updated_at = now(), last_error = null
  where order_id = p_order_id;
  update public.christmas_orders
  set status = 'generating', generation_started_at = coalesce(generation_started_at, now()), updated_at = now()
  where id = p_order_id;
  return jsonb_build_object('claimed', true, 'status', 'running');
end;
$$;

create or replace function public.christmas_finalize_generation_if_done(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  total int;
  succeeded int;
  failed int;
begin
  select count(*) into total from public.christmas_order_scenes where order_id = p_order_id;
  select count(*) into succeeded from public.christmas_order_scenes
    where order_id = p_order_id and status in ('succeeded', 'ready');
  select count(*) into failed from public.christmas_order_scenes
    where order_id = p_order_id and status = 'failed';

  if total = 0 then
    return jsonb_build_object('done', false);
  end if;

  if succeeded + failed < total then
    return jsonb_build_object('done', false, 'succeeded', succeeded, 'failed', failed, 'total', total);
  end if;

  update public.christmas_orders
  set
    status = case when failed > 0 and succeeded = 0 then 'failed'
                  when failed > 0 then 'partial_failure'
                  else 'complete' end,
    generation_finished_at = now(),
    completed_at = case when failed = 0 then now() else completed_at end,
    updated_at = now()
  where id = p_order_id;

  update public.christmas_pack_generation_jobs
  set status = 'completed', finished_at = now(), updated_at = now()
  where order_id = p_order_id;

  return jsonb_build_object('done', true, 'succeeded', succeeded, 'failed', failed, 'total', total);
end;
$$;

grant execute on function public.record_christmas_v2_funnel_event to anon, authenticated, service_role;
grant execute on function public.fulfill_christmas_order_payment(text,text,text,text,text,integer,text,uuid) to service_role;
grant execute on function public.claim_christmas_pack_generation_job to service_role;
grant execute on function public.christmas_finalize_generation_if_done to service_role;

commit;
