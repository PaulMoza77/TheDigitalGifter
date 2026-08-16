-- Additive My Pet's Secret Life funnel schema.
-- Does not drop tables, columns, buckets, or production data.
-- Does not apply Apple IAP.

begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums as text + check constraints (additive, easy to extend)
-- ---------------------------------------------------------------------------

create table if not exists public.pet_orders (
  id uuid primary key default gen_random_uuid(),
  public_token_hash text not null,
  public_token_ciphertext text,
  email text not null,
  email_normalized text not null,
  pet_name text not null,
  species text not null,
  personality text not null,
  sku text not null default 'pet-secret-life-12',
  amount_cents integer not null default 5900,
  currency text not null default 'usd',
  status text not null default 'awaiting_upload',
  photo_bucket text,
  photo_path text,
  photo_content_type text,
  photo_file_name text,
  photo_byte_size integer,
  photo_width integer,
  photo_height integer,
  photo_confirmed_at timestamptz,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_payment_status text,
  paid_at timestamptz,
  generation_started_at timestamptz,
  generation_finished_at timestamptz,
  qc_status text,
  qc_notes text,
  qc_actor_email text,
  qc_at timestamptz,
  completed_at timestamptz,
  refunded_at timestamptz,
  delivery_email_sent_at timestamptz,
  meta_event_id text not null,
  meta_purchase_sent_at timestamptz,
  model_name text,
  model_version text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pet_orders_sku_chk check (sku = 'pet-secret-life-12'),
  constraint pet_orders_amount_chk check (amount_cents = 5900),
  constraint pet_orders_currency_chk check (currency = 'usd'),
  constraint pet_orders_species_chk check (species in ('dog', 'cat', 'other')),
  constraint pet_orders_personality_chk check (
    personality in ('funny', 'royal', 'cute', 'badass', 'luxury', 'adventure')
  ),
  constraint pet_orders_status_chk check (
    status in (
      'draft',
      'awaiting_upload',
      'awaiting_payment',
      'paid',
      'generating',
      'awaiting_qc',
      'complete',
      'partial_failure',
      'failed',
      'refunded'
    )
  ),
  constraint pet_orders_photo_type_chk check (
    photo_content_type is null
    or photo_content_type in ('image/jpeg', 'image/png', 'image/webp')
  )
);

create unique index if not exists pet_orders_public_token_hash_uidx
  on public.pet_orders (public_token_hash);

create unique index if not exists pet_orders_meta_event_id_uidx
  on public.pet_orders (meta_event_id);

create unique index if not exists pet_orders_stripe_session_uidx
  on public.pet_orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null
    and length(trim(stripe_checkout_session_id)) > 0;

create table if not exists public.pet_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pet_orders (id) on delete cascade,
  stripe_session_id text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists pet_checkout_sessions_session_uidx
  on public.pet_checkout_sessions (stripe_session_id);

create index if not exists pet_checkout_sessions_order_idx
  on public.pet_checkout_sessions (order_id);

create index if not exists pet_orders_email_normalized_idx
  on public.pet_orders (email_normalized);

create index if not exists pet_orders_pet_name_idx
  on public.pet_orders (lower(pet_name));

create index if not exists pet_orders_status_created_idx
  on public.pet_orders (status, created_at desc);

create index if not exists pet_orders_payment_intent_idx
  on public.pet_orders (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create table if not exists public.pet_order_scenes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pet_orders (id) on delete cascade,
  scene_key text not null,
  scene_number integer not null,
  title text not null,
  status text not null default 'queued',
  progress_percent integer not null default 0,
  replicate_prediction_id text,
  model_name text,
  model_version text,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  result_bucket text,
  result_path text,
  result_content_type text,
  result_byte_size integer,
  result_width integer,
  result_height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pet_order_scenes_key_chk check (
    scene_key in (
      'royal-portrait',
      'luxury-ceo',
      'astronaut',
      'formula-racer',
      'spa-bathtub',
      'newspaper',
      'cinema-boss',
      'renaissance',
      'beach-vacation',
      'head-chef',
      'original-superhero',
      'christmas-portrait'
    )
  ),
  constraint pet_order_scenes_status_chk check (
    status in ('queued', 'generating', 'succeeded', 'failed', 'ready')
  ),
  constraint pet_order_scenes_attempts_chk check (attempts >= 0 and attempts <= 10)
);

create unique index if not exists pet_order_scenes_order_key_uidx
  on public.pet_order_scenes (order_id, scene_key);

create unique index if not exists pet_order_scenes_prediction_uidx
  on public.pet_order_scenes (replicate_prediction_id)
  where replicate_prediction_id is not null
    and length(trim(replicate_prediction_id)) > 0;

create index if not exists pet_order_scenes_order_status_idx
  on public.pet_order_scenes (order_id, status);

create table if not exists public.pet_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pet_orders (id) on delete cascade,
  scene_key text,
  actor_type text not null default 'system',
  actor_email text,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint pet_order_events_actor_chk check (
    actor_type in ('system', 'admin', 'customer', 'stripe', 'replicate')
  )
);

create index if not exists pet_order_events_order_created_idx
  on public.pet_order_events (order_id, created_at desc);

create table if not exists public.pet_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pet_orders (id) on delete cascade,
  status text not null default 'queued',
  claimed_at timestamptz,
  finished_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pet_generation_jobs_status_chk check (
    status in ('queued', 'running', 'held', 'completed', 'failed')
  )
);

create unique index if not exists pet_generation_jobs_order_uidx
  on public.pet_generation_jobs (order_id);

create table if not exists public.pet_processed_replicate_events (
  id uuid primary key default gen_random_uuid(),
  prediction_id text not null,
  webhook_id text,
  event_status text not null,
  order_id uuid,
  scene_key text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists pet_processed_replicate_prediction_status_uidx
  on public.pet_processed_replicate_events (prediction_id, event_status);

create unique index if not exists pet_processed_replicate_webhook_uidx
  on public.pet_processed_replicate_events (webhook_id)
  where webhook_id is not null and length(trim(webhook_id)) > 0;

create table if not exists public.pet_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pet_orders (id) on delete cascade,
  kind text not null,
  provider_message_id text,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  constraint pet_email_deliveries_kind_chk check (kind in ('gallery_ready', 'partial_failure')),
  constraint pet_email_deliveries_status_chk check (status in ('queued', 'sent', 'skipped', 'failed'))
);

create unique index if not exists pet_email_deliveries_order_kind_uidx
  on public.pet_email_deliveries (order_id, kind);

-- ---------------------------------------------------------------------------
-- Private storage buckets (no public listing, signed URLs only)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-source-photos',
  'pet-source-photos',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-generated',
  'pet-generated',
  false,
  31457280,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- RLS: anonymous cannot enumerate. Admin read via is_admin(). Writes via service role.
-- ---------------------------------------------------------------------------

alter table public.pet_orders enable row level security;
alter table public.pet_order_scenes enable row level security;
alter table public.pet_order_events enable row level security;
alter table public.pet_generation_jobs enable row level security;
alter table public.pet_processed_replicate_events enable row level security;
alter table public.pet_email_deliveries enable row level security;
alter table public.pet_checkout_sessions enable row level security;

drop policy if exists pet_orders_admin_read on public.pet_orders;
create policy pet_orders_admin_read
  on public.pet_orders for select
  using (public.is_admin());

drop policy if exists pet_order_scenes_admin_read on public.pet_order_scenes;
create policy pet_order_scenes_admin_read
  on public.pet_order_scenes for select
  using (public.is_admin());

drop policy if exists pet_order_events_admin_read on public.pet_order_events;
create policy pet_order_events_admin_read
  on public.pet_order_events for select
  using (public.is_admin());

drop policy if exists pet_generation_jobs_admin_read on public.pet_generation_jobs;
create policy pet_generation_jobs_admin_read
  on public.pet_generation_jobs for select
  using (public.is_admin());

drop policy if exists pet_email_deliveries_admin_read on public.pet_email_deliveries;
create policy pet_email_deliveries_admin_read
  on public.pet_email_deliveries for select
  using (public.is_admin());

drop policy if exists pet_checkout_sessions_admin_read on public.pet_checkout_sessions;
create policy pet_checkout_sessions_admin_read
  on public.pet_checkout_sessions for select
  using (public.is_admin());

-- No storage object policies for these private buckets: service role + signed URLs only.
drop policy if exists pet_source_photos_admin_read on storage.objects;
drop policy if exists pet_generated_admin_read on storage.objects;

revoke all on table public.pet_orders from anon, public;
revoke all on table public.pet_order_scenes from anon, public;
revoke all on table public.pet_order_events from anon, public;
revoke all on table public.pet_generation_jobs from anon, public;
revoke all on table public.pet_processed_replicate_events from anon, authenticated, public;
revoke all on table public.pet_email_deliveries from anon, public;
revoke all on table public.pet_checkout_sessions from anon, authenticated, public;

grant select on table public.pet_orders to authenticated;
grant select on table public.pet_order_scenes to authenticated;
grant select on table public.pet_order_events to authenticated;
grant select on table public.pet_generation_jobs to authenticated;
grant select on table public.pet_email_deliveries to authenticated;

grant all on table public.pet_orders to service_role;
grant all on table public.pet_order_scenes to service_role;
grant all on table public.pet_order_events to service_role;
grant all on table public.pet_generation_jobs to service_role;
grant all on table public.pet_processed_replicate_events to service_role;
grant all on table public.pet_email_deliveries to service_role;
grant all on table public.pet_checkout_sessions to service_role;

-- ---------------------------------------------------------------------------
-- Helpers / RPCs (service_role only)
-- ---------------------------------------------------------------------------

create or replace function public.pet_sha256_hex(p_value text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(convert_to(p_value, 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function public.pet_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pet_orders_touch_updated_at on public.pet_orders;
create trigger pet_orders_touch_updated_at
before update on public.pet_orders
for each row execute function public.pet_touch_updated_at();

drop trigger if exists pet_order_scenes_touch_updated_at on public.pet_order_scenes;
create trigger pet_order_scenes_touch_updated_at
before update on public.pet_order_scenes
for each row execute function public.pet_touch_updated_at();

drop trigger if exists pet_generation_jobs_touch_updated_at on public.pet_generation_jobs;
create trigger pet_generation_jobs_touch_updated_at
before update on public.pet_generation_jobs
for each row execute function public.pet_touch_updated_at();

create or replace function public.pet_seed_scenes(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pet_order_scenes (order_id, scene_key, scene_number, title, status)
  values
    (p_order_id, 'royal-portrait', 1, 'Royal portrait', 'queued'),
    (p_order_id, 'luxury-ceo', 2, 'Luxury CEO', 'queued'),
    (p_order_id, 'astronaut', 3, 'Astronaut', 'queued'),
    (p_order_id, 'formula-racer', 4, 'Formula racing driver', 'queued'),
    (p_order_id, 'spa-bathtub', 5, 'Spa / bathtub', 'queued'),
    (p_order_id, 'newspaper', 6, 'Reading a newspaper', 'queued'),
    (p_order_id, 'cinema-boss', 7, 'Fictional cinema boss', 'queued'),
    (p_order_id, 'renaissance', 8, 'Renaissance painting', 'queued'),
    (p_order_id, 'beach-vacation', 9, 'Beach vacation', 'queued'),
    (p_order_id, 'head-chef', 10, 'Head chef', 'queued'),
    (p_order_id, 'original-superhero', 11, 'Original superhero', 'queued'),
    (p_order_id, 'christmas-portrait', 12, 'Christmas portrait', 'queued')
  on conflict (order_id, scene_key) do nothing;
end;
$$;

create or replace function public.pet_log_event(
  p_order_id uuid,
  p_action text,
  p_actor_type text default 'system',
  p_actor_email text default null,
  p_scene_key text default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pet_order_events (order_id, scene_key, actor_type, actor_email, action, payload)
  values (
    p_order_id,
    p_scene_key,
    coalesce(nullif(p_actor_type, ''), 'system'),
    p_actor_email,
    p_action,
    coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;

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

  if coalesce(p_amount_cents, 0) <> 5900 or lower(coalesce(p_currency, '')) <> 'usd' then
    update public.processed_stripe_events
    set result = jsonb_build_object(
      'status', 'amount_mismatch',
      'amount_cents', p_amount_cents,
      'currency', p_currency
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
    'paid', 'generating', 'awaiting_qc', 'complete', 'partial_failure', 'refunded'
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
        'amount_cents', 5900,
        'currency', 'usd'
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

drop function if exists public.attach_pet_checkout_session(uuid, text);
drop function if exists public.attach_pet_checkout_session(uuid, text, text);

create or replace function public.attach_pet_checkout_session(
  p_order_id uuid,
  p_session_id text,
  p_expected_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.pet_orders%rowtype;
  incoming text;
  expected text;
begin
  if p_order_id is null or p_session_id is null or length(trim(p_session_id)) = 0 then
    raise exception 'order and session required';
  end if;

  incoming := trim(p_session_id);
  expected := nullif(trim(coalesce(p_expected_session_id, '')), '');

  select * into order_row from public.pet_orders where id = p_order_id for update;
  if not found then
    raise exception 'pet order not found';
  end if;

  insert into public.pet_checkout_sessions (order_id, stripe_session_id)
  values (p_order_id, incoming)
  on conflict (stripe_session_id) do nothing;

  update public.pet_orders
  set stripe_checkout_session_id = incoming
  where id = p_order_id
    and (
      stripe_checkout_session_id is null
      or stripe_checkout_session_id = incoming
      or (
        expected is not null
        and stripe_checkout_session_id = expected
      )
    )
  returning * into order_row;

  if not found then
    select * into order_row from public.pet_orders where id = p_order_id;
  end if;

  return jsonb_build_object(
    'stripe_checkout_session_id', order_row.stripe_checkout_session_id,
    'attached', order_row.stripe_checkout_session_id = incoming
  );
end;
$$;

create or replace function public.pet_apply_scene_prediction_result(
  p_prediction_id text,
  p_webhook_id text,
  p_event_status text,
  p_scene_status text,
  p_result_bucket text,
  p_result_path text,
  p_result_content_type text,
  p_error text,
  p_duration_ms integer,
  p_model_name text,
  p_model_version text,
  p_result_width integer default null,
  p_result_height integer default null,
  p_result_byte_size integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  scene_row public.pet_order_scenes%rowtype;
  inserted boolean := false;
  skipped boolean := false;
begin
  if p_prediction_id is null or length(trim(p_prediction_id)) = 0 then
    raise exception 'prediction_id required';
  end if;

  insert into public.pet_processed_replicate_events (
    prediction_id, webhook_id, event_status, result
  )
  values (
    trim(p_prediction_id),
    nullif(trim(coalesce(p_webhook_id, '')), ''),
    coalesce(nullif(trim(p_event_status), ''), 'completed'),
    jsonb_build_object('status', p_scene_status)
  )
  on conflict (prediction_id, event_status) do nothing;

  get diagnostics inserted = row_count;
  if not inserted then
    return jsonb_build_object('applied', false, 'reason', 'duplicate_callback');
  end if;

  select * into scene_row
  from public.pet_order_scenes
  where replicate_prediction_id = trim(p_prediction_id)
  for update;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'scene_not_found');
  end if;

  if scene_row.status in ('succeeded', 'ready') then
    skipped := true;
    update public.pet_processed_replicate_events
    set order_id = scene_row.order_id, scene_key = scene_row.scene_key, result = jsonb_build_object('status', 'already_succeeded')
    where prediction_id = trim(p_prediction_id)
      and event_status = coalesce(nullif(trim(p_event_status), ''), 'completed');
    return jsonb_build_object(
      'applied', false,
      'reason', 'already_succeeded',
      'order_id', scene_row.order_id,
      'scene_key', scene_row.scene_key
    );
  end if;

  if p_scene_status = 'succeeded' then
    update public.pet_order_scenes
    set
      status = 'succeeded',
      progress_percent = 100,
      result_bucket = p_result_bucket,
      result_path = p_result_path,
      result_content_type = p_result_content_type,
      result_width = p_result_width,
      result_height = p_result_height,
      result_byte_size = p_result_byte_size,
      last_error = null,
      completed_at = now(),
      duration_ms = p_duration_ms,
      model_name = coalesce(p_model_name, model_name),
      model_version = coalesce(p_model_version, model_version)
    where id = scene_row.id
    returning * into scene_row;
  else
    update public.pet_order_scenes
    set
      status = 'failed',
      progress_percent = 100,
      last_error = left(coalesce(p_error, 'generation failed'), 2000),
      completed_at = now(),
      duration_ms = p_duration_ms
    where id = scene_row.id
    returning * into scene_row;
  end if;

  update public.pet_processed_replicate_events
  set order_id = scene_row.order_id, scene_key = scene_row.scene_key
  where prediction_id = trim(p_prediction_id)
    and event_status = coalesce(nullif(trim(p_event_status), ''), 'completed');

  perform public.pet_log_event(
    scene_row.order_id,
    case when p_scene_status = 'succeeded' then 'scene_succeeded' else 'scene_failed' end,
    'replicate',
    null,
    scene_row.scene_key,
    jsonb_build_object('prediction_id', p_prediction_id, 'skipped', skipped)
  );

  perform public.pet_finalize_generation_if_done(scene_row.order_id);

  return jsonb_build_object(
    'applied', true,
    'order_id', scene_row.order_id,
    'scene_key', scene_row.scene_key,
    'status', scene_row.status
  );
end;
$$;

create or replace function public.pet_finalize_generation_if_done(p_order_id uuid)
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
  from public.pet_order_scenes
  where order_id = p_order_id;

  if total_count < 12 or terminal_count < total_count then
    return jsonb_build_object('finalized', false, 'terminal', terminal_count, 'total', total_count);
  end if;

  if succeeded_count = 0 then
    next_status := 'failed';
  elsif failed_count > 0 then
    next_status := 'partial_failure';
  else
    next_status := 'awaiting_qc';
  end if;

  update public.pet_orders
  set
    status = next_status,
    generation_finished_at = now()
  where id = p_order_id
    and status in ('paid', 'generating', 'partial_failure', 'awaiting_qc');

  update public.pet_generation_jobs
  set
    status = case when next_status = 'awaiting_qc' then 'completed' else 'failed' end,
    last_error = case when next_status = 'awaiting_qc' then null else next_status end,
    finished_at = now()
  where order_id = p_order_id
    and status in ('running', 'queued', 'held', 'failed');

  perform public.pet_log_event(
    p_order_id,
    'generation_batch_finished',
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
  total_count integer;
  ready_or_succeeded integer;
  blocking_count integer;
begin
  select * into order_row from public.pet_orders where id = p_order_id for update;
  if not found then
    raise exception 'pet order not found';
  end if;

  if order_row.paid_at is null then
    raise exception 'unpaid order cannot be released';
  end if;

  if order_row.status <> 'awaiting_qc' then
    raise exception 'order is not awaiting QC';
  end if;

  select
    count(*),
    count(*) filter (where status in ('succeeded', 'ready')),
    count(*) filter (where status in ('queued', 'generating', 'failed'))
  into total_count, ready_or_succeeded, blocking_count
  from public.pet_order_scenes
  where order_id = p_order_id;

  if total_count <> 12 or ready_or_succeeded <> 12 or blocking_count <> 0 then
    raise exception 'all 12 scenes must be succeeded or ready before release';
  end if;

  update public.pet_order_scenes
  set status = 'ready'
  where order_id = p_order_id
    and status = 'succeeded';

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
    jsonb_build_object('ready_count', 12, 'notes_present', p_notes is not null)
  );

  return jsonb_build_object('status', order_row.status, 'ready_count', 12);
end;
$$;

insert into public.email_templates (name, type, subject, html)
select
  'pet_gallery_ready',
  'transactional',
  'Your pet portraits are ready',
  '<!doctype html><html><body style="background:#140e0a;color:#f6efe4;font-family:Georgia,serif;padding:32px"><h1 style="color:#d4a84b">My Pet’s Secret Life</h1><p>{{pet_name}}’s twelve portraits are ready after human quality control.</p><p><a href="{{order_url}}" style="color:#1a140e;background:#d4a84b;padding:12px 20px;border-radius:999px;text-decoration:none">Open the gallery</a></p><p style="color:#f6efe4;opacity:.7">This link is unique to your order. $59 one-time payment. No subscription.</p></body></html>'
where not exists (
  select 1 from public.email_templates where name = 'pet_gallery_ready'
);

revoke all on function public.pet_sha256_hex(text) from anon, authenticated, public;
revoke all on function public.pet_seed_scenes(uuid) from anon, authenticated, public;
revoke all on function public.pet_log_event(uuid, text, text, text, text, jsonb) from anon, authenticated, public;
revoke all on function public.fulfill_pet_order_payment(text, text, text, text, text, integer, text, uuid) from anon, authenticated, public;
revoke all on function public.claim_pet_generation_job(uuid) from anon, authenticated, public;
revoke all on function public.pet_apply_scene_prediction_result(text, text, text, text, text, text, text, text, integer, text, text, integer, integer, integer) from anon, authenticated, public;
revoke all on function public.pet_finalize_generation_if_done(uuid) from anon, authenticated, public;
revoke all on function public.pet_release_delivery(uuid, text, text) from anon, authenticated, public;
revoke all on function public.attach_pet_checkout_session(uuid, text, text) from anon, authenticated, public;

grant execute on function public.pet_sha256_hex(text) to service_role;
grant execute on function public.pet_seed_scenes(uuid) to service_role;
grant execute on function public.pet_log_event(uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.fulfill_pet_order_payment(text, text, text, text, text, integer, text, uuid) to service_role;
grant execute on function public.claim_pet_generation_job(uuid) to service_role;
grant execute on function public.pet_apply_scene_prediction_result(text, text, text, text, text, text, text, text, integer, text, text, integer, integer, integer) to service_role;
grant execute on function public.pet_finalize_generation_if_done(uuid) to service_role;
grant execute on function public.pet_release_delivery(uuid, text, text) to service_role;
grant execute on function public.attach_pet_checkout_session(uuid, text, text) to service_role;

commit;
