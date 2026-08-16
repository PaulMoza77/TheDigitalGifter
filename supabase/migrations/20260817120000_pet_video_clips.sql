-- Additive My Pet's Secret Life video clips + admin-editable offer.
-- Does not modify 20260816160000_pet_funnel.sql or 20260816161000_ai_cost_ledger.sql.

begin;

-- ---------------------------------------------------------------------------
-- Orders: allow snapshotted amounts, extra statuses, offer versioning
-- ---------------------------------------------------------------------------

alter table public.pet_orders
  drop constraint if exists pet_orders_amount_chk;

alter table public.pet_orders
  add constraint pet_orders_amount_chk check (amount_cents > 0);

alter table public.pet_orders
  drop constraint if exists pet_orders_status_chk;

alter table public.pet_orders
  add constraint pet_orders_status_chk check (
    status in (
      'draft',
      'awaiting_upload',
      'awaiting_payment',
      'paid',
      'generating',
      'awaiting_qc',
      'selecting_video_scenes',
      'generating_videos',
      'awaiting_video_qc',
      'complete',
      'partial_failure',
      'failed',
      'refunded'
    )
  );

alter table public.pet_orders
  add column if not exists offer_id uuid,
  add column if not exists offer_version integer not null default 1,
  add column if not exists image_count integer not null default 12,
  add column if not exists video_count integer not null default 2;

alter table public.pet_order_scenes
  add column if not exists qc_status text,
  add column if not exists qc_actor_email text,
  add column if not exists qc_at timestamptz;

alter table public.pet_order_scenes
  drop constraint if exists pet_order_scenes_qc_chk;

alter table public.pet_order_scenes
  add constraint pet_order_scenes_qc_chk check (
    qc_status is null or qc_status in ('approved', 'rejected')
  );

alter table public.pet_orders
  drop constraint if exists pet_orders_counts_chk;

alter table public.pet_orders
  add constraint pet_orders_counts_chk check (image_count = 12 and video_count = 2);

-- ---------------------------------------------------------------------------
-- Server-owned pet offer (admin-editable price; orders snapshot a version)
-- ---------------------------------------------------------------------------

create table if not exists public.pet_offers (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  name text not null,
  amount_cents integer not null,
  currency text not null default 'usd',
  image_count integer not null default 12,
  video_count integer not null default 2,
  subscription boolean not null default false,
  active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_email text,
  constraint pet_offers_sku_chk check (sku = 'pet-secret-life-12'),
  constraint pet_offers_amount_chk check (amount_cents > 0),
  constraint pet_offers_currency_chk check (currency = 'usd'),
  constraint pet_offers_counts_chk check (image_count = 12 and video_count = 2),
  constraint pet_offers_subscription_chk check (subscription = false),
  constraint pet_offers_version_chk check (version >= 1)
);

create unique index if not exists pet_offers_active_sku_uidx
  on public.pet_offers (sku)
  where active = true;

create unique index if not exists pet_offers_sku_version_uidx
  on public.pet_offers (sku, version);

insert into public.pet_offers (
  sku, name, amount_cents, currency, image_count, video_count, subscription, active, version
)
select
  'pet-secret-life-12',
  'My Pet’s Secret Life',
  5900,
  'usd',
  12,
  2,
  false,
  true,
  1
where not exists (
  select 1 from public.pet_offers where sku = 'pet-secret-life-12' and version = 1
);

alter table public.pet_orders
  drop constraint if exists pet_orders_offer_fk;

alter table public.pet_orders
  add constraint pet_orders_offer_fk
  foreign key (offer_id) references public.pet_offers (id) on delete set null;

update public.pet_orders o
set
  offer_id = p.id,
  offer_version = p.version,
  image_count = 12,
  video_count = 2
from public.pet_offers p
where p.sku = 'pet-secret-life-12'
  and p.version = 1
  and o.offer_id is null;

-- ---------------------------------------------------------------------------
-- Video clips
-- ---------------------------------------------------------------------------

create table if not exists public.pet_order_video_clips (
  id uuid primary key default gen_random_uuid(),
  pet_order_id uuid not null references public.pet_orders (id) on delete cascade,
  source_scene_id uuid not null references public.pet_order_scenes (id) on delete restrict,
  slot integer not null,
  status text not null default 'queued',
  provider text not null default 'replicate',
  model_name text,
  model_version text,
  replicate_prediction_id text,
  attempt_number integer not null default 0,
  max_attempts integer not null default 1,
  prompt_snapshot text,
  requested_duration_seconds integer not null default 5,
  requested_resolution text not null default '720p',
  output_duration_seconds numeric(8,3),
  result_width integer,
  result_height integer,
  result_content_type text,
  result_bucket text,
  result_path text,
  result_byte_size integer,
  provider_error text,
  retried_from_id uuid references public.pet_order_video_clips (id) on delete set null,
  retried_from_prediction_id text,
  qc_status text,
  qc_notes text,
  qc_actor_email text,
  qc_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint pet_order_video_clips_slot_chk check (slot in (1, 2)),
  constraint pet_order_video_clips_status_chk check (
    status in ('queued', 'generating', 'succeeded', 'failed', 'ready')
  ),
  constraint pet_order_video_clips_provider_chk check (provider = 'replicate'),
  constraint pet_order_video_clips_duration_chk check (
    requested_duration_seconds >= 2 and requested_duration_seconds <= 12
  ),
  constraint pet_order_video_clips_resolution_chk check (requested_resolution = '720p'),
  constraint pet_order_video_clips_attempts_chk check (
    attempt_number >= 0 and attempt_number <= 10 and max_attempts >= 1
  ),
  constraint pet_order_video_clips_qc_chk check (
    qc_status is null or qc_status in ('approved', 'rejected')
  ),
  constraint pet_order_video_clips_mime_chk check (
    result_content_type is null or result_content_type = 'video/mp4'
  )
);

create unique index if not exists pet_order_video_clips_order_slot_uidx
  on public.pet_order_video_clips (pet_order_id, slot);

create unique index if not exists pet_order_video_clips_prediction_uidx
  on public.pet_order_video_clips (replicate_prediction_id)
  where replicate_prediction_id is not null
    and length(trim(replicate_prediction_id)) > 0;

create index if not exists pet_order_video_clips_order_status_idx
  on public.pet_order_video_clips (pet_order_id, status);

create index if not exists pet_order_video_clips_source_scene_idx
  on public.pet_order_video_clips (source_scene_id);

drop trigger if exists pet_order_video_clips_touch_updated_at on public.pet_order_video_clips;
create trigger pet_order_video_clips_touch_updated_at
before update on public.pet_order_video_clips
for each row execute function public.pet_touch_updated_at();

drop trigger if exists pet_offers_touch_updated_at on public.pet_offers;
create trigger pet_offers_touch_updated_at
before update on public.pet_offers
for each row execute function public.pet_touch_updated_at();

create or replace function public.pet_video_clip_validate()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  scene public.pet_order_scenes%rowtype;
begin
  select * into scene from public.pet_order_scenes where id = new.source_scene_id;
  if not found then
    raise exception 'source scene not found';
  end if;
  if scene.order_id <> new.pet_order_id then
    raise exception 'source scene must belong to the same order';
  end if;
  if scene.status not in ('succeeded', 'ready') then
    raise exception 'source scene must have succeeded';
  end if;
  return new;
end;
$$;

drop trigger if exists pet_order_video_clips_validate on public.pet_order_video_clips;
create trigger pet_order_video_clips_validate
before insert or update of source_scene_id, pet_order_id
on public.pet_order_video_clips
for each row execute function public.pet_video_clip_validate();

alter table public.pet_processed_replicate_events
  add column if not exists clip_id uuid references public.pet_order_video_clips (id) on delete set null,
  add column if not exists media_type text not null default 'image';

alter table public.pet_processed_replicate_events
  drop constraint if exists pet_processed_replicate_media_chk;

alter table public.pet_processed_replicate_events
  add constraint pet_processed_replicate_media_chk check (media_type in ('image', 'video'));

-- ---------------------------------------------------------------------------
-- Private generated bucket: allow MP4 copies, keep private
-- ---------------------------------------------------------------------------

update storage.buckets
set
  public = false,
  file_size_limit = greatest(coalesce(file_size_limit, 0), 52428800),
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
where id = 'pet-generated';

-- ---------------------------------------------------------------------------
-- AI cost ledger: additive video billing columns
-- ---------------------------------------------------------------------------

alter table public.ai_cost_ledger
  add column if not exists media_type text not null default 'image',
  add column if not exists clip_id uuid references public.pet_order_video_clips (id) on delete set null,
  add column if not exists source_scene_id uuid references public.pet_order_scenes (id) on delete set null,
  add column if not exists resolution text,
  add column if not exists requested_seconds numeric(12,6),
  add column if not exists billable_seconds numeric(12,6);

alter table public.ai_cost_ledger
  drop constraint if exists ai_cost_ledger_media_chk;

alter table public.ai_cost_ledger
  add constraint ai_cost_ledger_media_chk check (media_type in ('image', 'video'));

create index if not exists ai_cost_ledger_media_idx
  on public.ai_cost_ledger (media_type, provider_status);

create index if not exists ai_cost_ledger_clip_idx
  on public.ai_cost_ledger (clip_id);

insert into public.ai_model_pricing (
  provider,
  model_name,
  model_version,
  pricing_method,
  unit_cost_usd,
  currency,
  effective_from,
  is_active,
  source,
  notes
)
select
  'replicate',
  'bytedance/seedance-1-pro-fast',
  null,
  'per_second',
  0.025,
  'usd',
  timestamptz '2026-08-01 00:00:00+00',
  true,
  'server_owned',
  'Seedance 1 Pro Fast 720p tariff: $0.025 per output second. Snapshot this row onto each video prediction.'
where not exists (
  select 1
  from public.ai_model_pricing
  where provider = 'replicate'
    and model_name = 'bytedance/seedance-1-pro-fast'
    and model_version is null
    and is_active = true
);

-- Extend compute to support per_second video tariffs without changing image history.
create or replace function public.ai_cost_compute_from_snapshot(
  p_provider_status text,
  p_is_mock boolean,
  p_create_failed boolean,
  p_tariff jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  unit_cost numeric(12,6);
  method text;
  status text := coalesce(nullif(trim(p_provider_status), ''), 'starting');
  requested numeric(12,6);
  billable numeric(12,6);
begin
  unit_cost := coalesce((p_tariff->>'unitCostUsd')::numeric, 0);
  method := coalesce(p_tariff->>'pricingMethod', 'none');
  requested := coalesce(
    (p_tariff->>'requestedSeconds')::numeric,
    (p_tariff->>'billableSeconds')::numeric,
    0
  );
  billable := coalesce((p_tariff->>'billableSeconds')::numeric, requested);

  if coalesce(p_is_mock, false) then
    return jsonb_build_object(
      'cost_usd', 0,
      'billable_units', 0,
      'cost_state', 'exact',
      'provider_status', 'mock'
    );
  end if;

  if coalesce(p_create_failed, false) or status = 'create_failed' then
    return jsonb_build_object(
      'cost_usd', 0,
      'billable_units', 0,
      'cost_state', 'exact',
      'provider_status', 'create_failed'
    );
  end if;

  if status = 'succeeded' then
    if method = 'per_successful_output' then
      return jsonb_build_object(
        'cost_usd', unit_cost,
        'billable_units', 1,
        'cost_state', 'exact',
        'provider_status', 'succeeded'
      );
    elsif method = 'per_second' then
      return jsonb_build_object(
        'cost_usd', round(unit_cost * billable, 6),
        'billable_units', billable,
        'cost_state', 'exact',
        'provider_status', 'succeeded'
      );
    end if;
    return jsonb_build_object(
      'cost_usd', 0,
      'billable_units', 0,
      'cost_state', 'exact',
      'provider_status', 'succeeded'
    );
  end if;

  if status = 'failed' then
    return jsonb_build_object(
      'cost_usd', 0,
      'billable_units', 0,
      'cost_state', 'exact',
      'provider_status', 'failed'
    );
  end if;

  if status = 'canceled' then
    if method = 'per_successful_output' then
      return jsonb_build_object(
        'cost_usd', unit_cost,
        'billable_units', 1,
        'cost_state', 'estimated',
        'provider_status', 'canceled'
      );
    elsif method = 'per_second' then
      return jsonb_build_object(
        'cost_usd', round(unit_cost * requested, 6),
        'billable_units', requested,
        'cost_state', 'estimated',
        'provider_status', 'canceled'
      );
    end if;
    return jsonb_build_object(
      'cost_usd', unit_cost,
      'billable_units', 0,
      'cost_state', 'estimated',
      'provider_status', 'canceled'
    );
  end if;

  return jsonb_build_object(
    'cost_usd', 0,
    'billable_units', 0,
    'cost_state', 'pending',
    'provider_status', status
  );
end;
$$;

create or replace function public.ai_cost_ledger_record_video_attempt(
  p_provider text,
  p_prediction_id text,
  p_pet_order_id uuid,
  p_clip_id uuid,
  p_source_scene_id uuid,
  p_scene_key text,
  p_attempt_number integer,
  p_product_sku text,
  p_model_name text,
  p_model_version text,
  p_resolution text,
  p_requested_seconds numeric,
  p_is_mock boolean default false,
  p_create_failed boolean default false,
  p_cost_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prediction_id text := nullif(trim(coalesce(p_prediction_id, '')), '');
  tariff jsonb;
  computed jsonb;
  v_attempt_number integer := greatest(coalesce(p_attempt_number, 1), 1);
  v_model_name text := coalesce(nullif(trim(p_model_name), ''), 'bytedance/seedance-1-pro-fast');
  v_seconds numeric(12,6) := greatest(coalesce(p_requested_seconds, 5), 0);
  v_resolution text := coalesce(nullif(trim(p_resolution), ''), '720p');
  ledger_row public.ai_cost_ledger%rowtype;
  notes text := nullif(trim(coalesce(p_cost_notes, '')), '');
begin
  if coalesce(p_is_mock, false) and v_prediction_id is null then
    v_prediction_id := 'mock-video:' || coalesce(p_pet_order_id::text, 'unknown') || ':' || coalesce(p_clip_id::text, 'unknown') || ':' || v_attempt_number;
  end if;

  if coalesce(p_create_failed, false) and v_prediction_id is null then
    v_prediction_id := 'create-failed:' || gen_random_uuid()::text;
    notes := coalesce(notes, 'create_failed_no_prediction_id');
  end if;

  if v_prediction_id is null then
    raise exception 'prediction_id required';
  end if;

  if coalesce(p_is_mock, false) then
    notes := coalesce(notes, 'mock_generation');
  end if;

  tariff := public.ai_cost_lookup_tariff(p_provider, v_model_name, p_model_version);
  if tariff is null then
    tariff := jsonb_build_object(
      'provider', coalesce(nullif(trim(p_provider), ''), 'replicate'),
      'model', v_model_name,
      'modelVersion', nullif(trim(coalesce(p_model_version, '')), ''),
      'pricingMethod', 'per_second',
      'unitCostUsd', 0.025,
      'currency', 'usd',
      'source', 'server_owned_fallback',
      'pricingRowId', null,
      'capturedAt', now(),
      'notes', 'Seedance fallback tariff snapshot'
    );
  end if;

  tariff := tariff || jsonb_build_object(
    'mediaType', 'video',
    'resolution', v_resolution,
    'requestedSeconds', v_seconds,
    'billableSeconds', v_seconds,
    'clipId', p_clip_id,
    'sourceSceneId', p_source_scene_id
  );

  computed := public.ai_cost_compute_from_snapshot(
    case
      when coalesce(p_is_mock, false) then 'mock'
      when coalesce(p_create_failed, false) then 'create_failed'
      else 'starting'
    end,
    coalesce(p_is_mock, false),
    coalesce(p_create_failed, false),
    tariff
  );

  insert into public.ai_cost_ledger (
    provider,
    prediction_id,
    product_family,
    pet_order_id,
    scene_id,
    scene_key,
    clip_id,
    source_scene_id,
    media_type,
    attempt_number,
    is_retry,
    is_mock,
    product_sku,
    model_name,
    model_version,
    provider_status,
    pricing_method,
    unit_cost_usd,
    billable_units,
    cost_usd,
    cost_state,
    pricing_source,
    tariff_snapshot,
    currency,
    started_at,
    completed_at,
    cost_notes,
    resolution,
    requested_seconds,
    billable_seconds
  )
  values (
    coalesce(nullif(trim(p_provider), ''), 'replicate'),
    v_prediction_id,
    'pet_funnel',
    p_pet_order_id,
    p_source_scene_id,
    nullif(trim(coalesce(p_scene_key, '')), ''),
    p_clip_id,
    p_source_scene_id,
    'video',
    v_attempt_number,
    v_attempt_number > 1,
    coalesce(p_is_mock, false),
    coalesce(nullif(trim(p_product_sku), ''), 'pet-secret-life-12'),
    v_model_name,
    nullif(trim(coalesce(p_model_version, '')), ''),
    computed->>'provider_status',
    coalesce(tariff->>'pricingMethod', 'per_second'),
    coalesce((tariff->>'unitCostUsd')::numeric, 0.025),
    case
      when computed->>'cost_state' = 'pending' then 0
      else coalesce((computed->>'billable_units')::numeric, 0)
    end,
    case
      when computed->>'cost_state' = 'pending' then 0
      else coalesce((computed->>'cost_usd')::numeric, 0)
    end,
    computed->>'cost_state',
    coalesce(tariff->>'source', 'ai_model_pricing'),
    tariff,
    'usd',
    now(),
    case when computed->>'cost_state' = 'pending' then null else now() end,
    notes,
    v_resolution,
    v_seconds,
    case
      when computed->>'cost_state' = 'pending' then 0
      else coalesce((computed->>'billable_units')::numeric, v_seconds)
    end
  )
  on conflict on constraint ai_cost_ledger_provider_prediction_key do nothing
  returning * into ledger_row;

  if ledger_row.id is null then
    select * into ledger_row
    from public.ai_cost_ledger as ledger
    where ledger.provider = coalesce(nullif(trim(p_provider), ''), 'replicate')
      and ledger.prediction_id = v_prediction_id;
  end if;

  return to_jsonb(ledger_row);
end;
$$;

-- ---------------------------------------------------------------------------
-- Payment fulfillment: compare Stripe amount to the order snapshot, not 5900
-- ---------------------------------------------------------------------------

create or replace function public.fulfill_pet_order_payment(
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
  existing public.processed_stripe_events%rowtype;
  order_row public.pet_orders%rowtype;
  job_row public.pet_generation_jobs%rowtype;
  inserted_event boolean := false;
  already_paid boolean := false;
  should_enqueue boolean := false;
begin
  if p_event_id is null or length(trim(p_event_id)) = 0 then
    raise exception 'event_id required';
  end if;
  if p_order_id is null then
    raise exception 'pet order id required';
  end if;

  select * into existing
  from public.processed_stripe_events
  where event_id = trim(p_event_id);

  if found then
    return jsonb_build_object(
      'status', 'already_processed',
      'event_id', existing.event_id,
      'result', existing.result
    );
  end if;

  insert into public.processed_stripe_events (event_id, event_type, stripe_session_id, result)
  values (
    trim(p_event_id),
    nullif(trim(coalesce(p_event_type, '')), ''),
    nullif(trim(coalesce(p_session_id, '')), ''),
    jsonb_build_object('status', 'pet_pending')
  )
  on conflict (event_id) do nothing;

  get diagnostics inserted_event = row_count;
  if not inserted_event then
    select * into existing from public.processed_stripe_events where event_id = trim(p_event_id);
    return jsonb_build_object(
      'status', 'already_processed',
      'event_id', existing.event_id,
      'result', existing.result
    );
  end if;

  select * into order_row
  from public.pet_orders
  where id = p_order_id
  for update;

  if not found then
    update public.processed_stripe_events
    set result = jsonb_build_object('status', 'order_not_found')
    where event_id = trim(p_event_id);
    raise exception 'pet order not found';
  end if;

  if order_row.sku <> 'pet-secret-life-12' then
    raise exception 'invalid pet sku';
  end if;

  if coalesce(p_amount_cents, 0) <> order_row.amount_cents
    or lower(coalesce(p_currency, '')) <> lower(order_row.currency) then
    update public.processed_stripe_events
    set result = jsonb_build_object(
      'status', 'amount_mismatch',
      'amount_cents', p_amount_cents,
      'currency', p_currency,
      'expected_amount_cents', order_row.amount_cents
    )
    where event_id = trim(p_event_id);
    raise exception 'pet payment amount mismatch';
  end if;

  if p_session_id is not null and length(trim(p_session_id)) > 0 then
    insert into public.pet_checkout_sessions (order_id, stripe_session_id)
    values (order_row.id, trim(p_session_id))
    on conflict (stripe_session_id) do nothing;
  end if;

  already_paid := order_row.status in (
    'paid', 'generating', 'awaiting_qc', 'selecting_video_scenes',
    'generating_videos', 'awaiting_video_qc', 'complete', 'partial_failure', 'refunded'
  ) or order_row.paid_at is not null;

  if not already_paid then
    update public.pet_orders
    set
      status = 'paid',
      stripe_checkout_session_id = coalesce(stripe_checkout_session_id, nullif(trim(p_session_id), '')),
      stripe_payment_intent_id = coalesce(nullif(trim(p_payment_intent_id), ''), stripe_payment_intent_id),
      stripe_payment_status = coalesce(nullif(trim(p_payment_status), ''), stripe_payment_status),
      paid_at = now(),
      last_error = null
    where id = order_row.id
    returning * into order_row;

    perform public.pet_seed_scenes(order_row.id);

    insert into public.pet_generation_jobs (order_id, status)
    values (order_row.id, 'queued')
    on conflict (order_id) do nothing;

    perform public.pet_log_event(
      order_row.id,
      'payment_fulfilled',
      'stripe',
      null,
      null,
      jsonb_build_object(
        'event_type', p_event_type,
        'session_id', p_session_id,
        'amount_cents', order_row.amount_cents,
        'currency', order_row.currency,
        'mode', 'payment'
      )
    );
  end if;

  select * into job_row
  from public.pet_generation_jobs
  where order_id = order_row.id;

  should_enqueue := job_row.id is not null and job_row.status in ('queued', 'held');

  update public.processed_stripe_events
  set result = jsonb_build_object(
    'status', case when already_paid then 'already_paid' else 'fulfilled' end,
    'pet_order_id', order_row.id,
    'should_enqueue', should_enqueue,
    'meta_event_id', order_row.meta_event_id
  )
  where event_id = trim(p_event_id);

  return jsonb_build_object(
    'status', case when already_paid then 'already_paid' else 'fulfilled' end,
    'pet_order_id', order_row.id,
    'should_enqueue', should_enqueue,
    'already_paid', already_paid,
    'meta_event_id', order_row.meta_event_id,
    'public_token_hash', order_row.public_token_hash
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

create or replace function public.claim_pet_generation_job(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  job_row public.pet_generation_jobs%rowtype;
begin
  update public.pet_generation_jobs
  set status = 'running', claimed_at = now(), last_error = null
  where order_id = p_order_id
    and status in ('queued', 'held', 'failed')
  returning * into job_row;

  if not found then
    select * into job_row from public.pet_generation_jobs where order_id = p_order_id;
    return jsonb_build_object(
      'claimed', false,
      'status', coalesce(job_row.status, 'missing')
    );
  end if;

  update public.pet_orders
  set status = 'generating', generation_started_at = coalesce(generation_started_at, now())
  where id = p_order_id
    and status in ('paid', 'generating', 'partial_failure');

  return jsonb_build_object('claimed', true, 'job_id', job_row.id, 'status', job_row.status);
end;
$$;

create or replace function public.pet_apply_video_prediction_result(
  p_prediction_id text,
  p_webhook_id text,
  p_event_status text,
  p_clip_status text,
  p_result_bucket text,
  p_result_path text,
  p_result_content_type text,
  p_error text,
  p_output_duration_seconds numeric,
  p_result_width integer,
  p_result_height integer,
  p_result_byte_size integer,
  p_model_name text,
  p_model_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clip_row public.pet_order_video_clips%rowtype;
  inserted boolean := false;
begin
  if p_prediction_id is null or length(trim(p_prediction_id)) = 0 then
    raise exception 'prediction_id required';
  end if;

  insert into public.pet_processed_replicate_events (
    prediction_id, webhook_id, event_status, result, media_type, clip_id
  )
  values (
    trim(p_prediction_id),
    nullif(trim(coalesce(p_webhook_id, '')), ''),
    coalesce(nullif(trim(p_event_status), ''), 'completed'),
    jsonb_build_object('status', p_clip_status),
    'video',
    null
  )
  on conflict (prediction_id, event_status) do nothing;

  get diagnostics inserted = row_count;
  if not inserted then
    return jsonb_build_object('applied', false, 'reason', 'duplicate_callback');
  end if;

  select * into clip_row
  from public.pet_order_video_clips
  where replicate_prediction_id = trim(p_prediction_id)
  for update;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'clip_not_found');
  end if;

  if clip_row.status in ('succeeded', 'ready') then
    update public.pet_processed_replicate_events
    set
      order_id = clip_row.pet_order_id,
      clip_id = clip_row.id,
      result = jsonb_build_object('status', 'already_succeeded')
    where prediction_id = trim(p_prediction_id)
      and event_status = coalesce(nullif(trim(p_event_status), ''), 'completed');
    return jsonb_build_object(
      'applied', false,
      'reason', 'already_succeeded',
      'order_id', clip_row.pet_order_id,
      'clip_id', clip_row.id
    );
  end if;

  if p_clip_status = 'succeeded' then
    update public.pet_order_video_clips
    set
      status = 'succeeded',
      result_bucket = p_result_bucket,
      result_path = p_result_path,
      result_content_type = coalesce(p_result_content_type, 'video/mp4'),
      result_width = p_result_width,
      result_height = p_result_height,
      result_byte_size = p_result_byte_size,
      output_duration_seconds = p_output_duration_seconds,
      provider_error = null,
      completed_at = now(),
      model_name = coalesce(p_model_name, model_name),
      model_version = coalesce(p_model_version, model_version)
    where id = clip_row.id
    returning * into clip_row;
  else
    update public.pet_order_video_clips
    set
      status = 'failed',
      provider_error = left(coalesce(p_error, 'generation failed'), 2000),
      completed_at = now(),
      output_duration_seconds = p_output_duration_seconds
    where id = clip_row.id
    returning * into clip_row;
  end if;

  update public.pet_processed_replicate_events
  set order_id = clip_row.pet_order_id, clip_id = clip_row.id, media_type = 'video'
  where prediction_id = trim(p_prediction_id)
    and event_status = coalesce(nullif(trim(p_event_status), ''), 'completed');

  perform public.pet_log_event(
    clip_row.pet_order_id,
    case when p_clip_status = 'succeeded' then 'video_clip_succeeded' else 'video_clip_failed' end,
    'replicate',
    null,
    null,
    jsonb_build_object('prediction_id', p_prediction_id, 'clip_id', clip_row.id, 'slot', clip_row.slot)
  );

  perform public.pet_finalize_video_if_done(clip_row.pet_order_id);

  return jsonb_build_object(
    'applied', true,
    'order_id', clip_row.pet_order_id,
    'clip_id', clip_row.id,
    'status', clip_row.status
  );
end;
$$;

create or replace function public.pet_finalize_video_if_done(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  total_count integer;
  terminal_count integer;
  succeeded_count integer;
  failed_count integer;
  next_status text;
begin
  select
    count(*),
    count(*) filter (where status in ('succeeded', 'failed', 'ready')),
    count(*) filter (where status in ('succeeded', 'ready')),
    count(*) filter (where status = 'failed')
  into total_count, terminal_count, succeeded_count, failed_count
  from public.pet_order_video_clips
  where pet_order_id = p_order_id;

  if total_count < 2 or terminal_count < total_count then
    return jsonb_build_object('finalized', false, 'terminal', terminal_count, 'total', total_count);
  end if;

  if succeeded_count = 0 then
    next_status := 'failed';
  elsif failed_count > 0 then
    next_status := 'partial_failure';
  else
    next_status := 'awaiting_video_qc';
  end if;

  update public.pet_orders
  set
    status = next_status,
    last_error = case when next_status = 'partial_failure' then 'video_partial_failure' else null end
  where id = p_order_id
    and status in ('generating_videos', 'partial_failure', 'awaiting_video_qc');

  perform public.pet_log_event(
    p_order_id,
    'video_batch_finished',
    'system',
    null,
    null,
    jsonb_build_object(
      'next_status', next_status,
      'succeeded', succeeded_count,
      'failed', failed_count
    )
  );

  return jsonb_build_object(
    'finalized', true,
    'status', next_status,
    'succeeded', succeeded_count,
    'failed', failed_count
  );
end;
$$;

create or replace function public.pet_release_delivery(
  p_order_id uuid,
  p_actor_email text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.pet_orders%rowtype;
  image_total integer;
  image_ready integer;
  image_blocking integer;
  video_total integer;
  video_ready integer;
  video_blocking integer;
begin
  select * into order_row from public.pet_orders where id = p_order_id for update;
  if not found then
    raise exception 'pet order not found';
  end if;

  if order_row.paid_at is null then
    raise exception 'unpaid order cannot be released';
  end if;

  if order_row.status not in ('awaiting_qc', 'selecting_video_scenes', 'awaiting_video_qc') then
    raise exception 'order is not awaiting QC';
  end if;

  select
    count(*),
    count(*) filter (where status = 'ready' and coalesce(qc_status, 'approved') = 'approved'),
    count(*) filter (where status in ('queued', 'generating', 'failed', 'succeeded') or coalesce(qc_status, '') = 'rejected')
  into image_total, image_ready, image_blocking
  from public.pet_order_scenes
  where order_id = p_order_id;

  if image_total <> 12 or image_ready <> 12 or image_blocking <> 0 then
    raise exception 'all 12 images must be QC-approved before release';
  end if;

  select
    count(*),
    count(*) filter (where status = 'ready' and coalesce(qc_status, 'approved') = 'approved'),
    count(*) filter (where status in ('queued', 'generating', 'failed', 'succeeded') or coalesce(qc_status, '') = 'rejected')
  into video_total, video_ready, video_blocking
  from public.pet_order_video_clips
  where pet_order_id = p_order_id;

  if video_total <> 2 or video_ready <> 2 or video_blocking <> 0 then
    raise exception 'both video clips must be QC-approved before release';
  end if;

  update public.pet_orders
  set
    status = 'complete',
    qc_status = 'approved',
    qc_notes = p_notes,
    qc_actor_email = p_actor_email,
    qc_at = now(),
    completed_at = now()
  where id = p_order_id
  returning * into order_row;

  perform public.pet_log_event(
    p_order_id,
    'qc_approved_release',
    'admin',
    p_actor_email,
    null,
    jsonb_build_object('ready_images', 12, 'ready_videos', 2, 'notes_present', p_notes is not null)
  );

  return jsonb_build_object('status', order_row.status, 'ready_images', 12, 'ready_videos', 2);
end;
$$;

create or replace function public.get_public_pet_offer()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  offer_row public.pet_offers%rowtype;
begin
  select * into offer_row
  from public.pet_offers
  where active = true
    and sku = 'pet-secret-life-12'
    and subscription = false
  order by version desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'sku', offer_row.sku,
    'name', offer_row.name,
    'amountCents', offer_row.amount_cents,
    'currency', offer_row.currency,
    'imageCount', offer_row.image_count,
    'videoCount', offer_row.video_count,
    'subscription', false,
    'active', true,
    'version', offer_row.version
  );
end;
$$;

update public.email_templates
set
  subject = 'Your pet portraits and clips are ready',
  html = '<!doctype html><html><body style="background:#140e0a;color:#f6efe4;font-family:Georgia,serif;padding:32px"><h1 style="color:#d4a84b">My Pet’s Secret Life</h1><p>{{pet_name}}’s twelve portraits and two cinematic clips are ready after human quality control.</p><p><a href="{{order_url}}" style="color:#1a140e;background:#d4a84b;padding:12px 20px;border-radius:999px;text-decoration:none">Open the gallery</a></p><p style="color:#f6efe4;opacity:.7">This link is unique to your order. One-time payment. No subscription.</p></body></html>'
where name = 'pet_gallery_ready';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.pet_offers enable row level security;
alter table public.pet_order_video_clips enable row level security;

drop policy if exists pet_offers_admin_read on public.pet_offers;
create policy pet_offers_admin_read
  on public.pet_offers for select
  using (public.is_admin());

drop policy if exists pet_offers_public_active_read on public.pet_offers;

drop policy if exists pet_order_video_clips_admin_read on public.pet_order_video_clips;
create policy pet_order_video_clips_admin_read
  on public.pet_order_video_clips for select
  using (public.is_admin());

revoke all on table public.pet_offers from anon, authenticated, public;
revoke all on table public.pet_order_video_clips from anon, authenticated, public;

grant select on table public.pet_offers to authenticated;
grant select on table public.pet_order_video_clips to authenticated;

grant all on table public.pet_offers to service_role;
grant all on table public.pet_order_video_clips to service_role;

revoke all on function public.pet_apply_video_prediction_result(text, text, text, text, text, text, text, text, numeric, integer, integer, integer, text, text) from anon, authenticated, public;
revoke all on function public.pet_finalize_video_if_done(uuid) from anon, authenticated, public;
revoke all on function public.ai_cost_ledger_record_video_attempt(text, text, uuid, uuid, uuid, text, integer, text, text, text, text, numeric, boolean, boolean, text) from anon, authenticated, public;
revoke all on function public.get_public_pet_offer() from public;

grant execute on function public.pet_apply_video_prediction_result(text, text, text, text, text, text, text, text, numeric, integer, integer, integer, text, text) to service_role;
grant execute on function public.pet_finalize_video_if_done(uuid) to service_role;
grant execute on function public.ai_cost_ledger_record_video_attempt(text, text, uuid, uuid, uuid, text, integer, text, text, text, text, numeric, boolean, boolean, text) to service_role;
grant execute on function public.get_public_pet_offer() to anon, authenticated, service_role;

commit;
