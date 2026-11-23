-- Our Christmas Story durable orders · Mission 02B
-- Additive only. Does not enable LIVE payments or rewrite Santa Call migrations.
-- Do NOT apply to production during Mission 02B without explicit authorization.

begin;

-- ---------------------------------------------------------------------------
-- Status + product constants (enforced in app; DB keeps text + checks)
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_story_drafts (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid references auth.users (id) on delete set null,
  buyer_email text,
  buyer_access_token_hash text not null,
  occasion text not null default 'christmas',
  copy_variant text not null default 'emotion_story',
  payload jsonb not null default '{}'::jsonb,
  photo_count integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_story_drafts_token_chk check (length(buyer_access_token_hash) = 64),
  constraint christmas_story_drafts_photo_count_chk check (photo_count >= 0 and photo_count <= 20)
);

create unique index if not exists christmas_story_drafts_buyer_token_uidx
  on public.christmas_story_drafts (buyer_access_token_hash)
  where deleted_at is null;
create index if not exists christmas_story_drafts_email_idx
  on public.christmas_story_drafts (lower(buyer_email))
  where buyer_email is not null and deleted_at is null;

create table if not exists public.christmas_story_orders (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references public.christmas_story_drafts (id) on delete set null,
  product_key text not null default 'our_christmas_story',
  status text not null default 'DRAFT',
  payment_status text not null default 'draft',
  amount_cents integer not null default 5700,
  currency text not null default 'usd',
  buyer_user_id uuid references auth.users (id) on delete set null,
  buyer_email text,
  buyer_access_token_hash text not null,
  stripe_mode text not null default 'disabled',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_event_id text,
  idempotency_key text,
  recipient_name text,
  from_name text,
  content jsonb,
  content_version integer not null default 0,
  schedule_at timestamptz,
  schedule_tz text,
  approved_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  failed_reason text,
  digital_consent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_story_orders_token_chk check (length(buyer_access_token_hash) = 64),
  constraint christmas_story_orders_amount_chk check (amount_cents > 0),
  constraint christmas_story_orders_status_chk check (
    status in (
      'DRAFT','CHECKOUT_PENDING','PAID','CONTENT_PENDING','GENERATING',
      'REVIEW_REQUIRED','APPROVED','READY_TO_SEND','SENT','OPENED',
      'FAILED','CANCELLED','RETRY'
    )
  ),
  constraint christmas_story_orders_payment_chk check (
    payment_status in ('draft','pending','paid','failed','expired','refunded')
  ),
  constraint christmas_story_orders_stripe_mode_chk check (
    stripe_mode in ('disabled','test','live')
  )
);

create unique index if not exists christmas_story_orders_idempotency_uidx
  on public.christmas_story_orders (idempotency_key)
  where idempotency_key is not null;
create unique index if not exists christmas_story_orders_stripe_session_uidx
  on public.christmas_story_orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create index if not exists christmas_story_orders_buyer_token_idx
  on public.christmas_story_orders (buyer_access_token_hash)
  where deleted_at is null;
create index if not exists christmas_story_orders_status_idx
  on public.christmas_story_orders (status)
  where deleted_at is null;
create index if not exists christmas_story_orders_email_idx
  on public.christmas_story_orders (lower(buyer_email))
  where buyer_email is not null and deleted_at is null;

create table if not exists public.christmas_story_content_versions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_story_orders (id) on delete cascade,
  version integer not null,
  content jsonb not null,
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  constraint christmas_story_content_versions_uniq unique (order_id, version)
);

create table if not exists public.christmas_story_assets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_story_orders (id) on delete cascade,
  draft_id uuid references public.christmas_story_drafts (id) on delete set null,
  asset_kind text not null,
  storage_bucket text not null,
  storage_path text not null,
  content_type text,
  byte_size integer,
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint christmas_story_assets_kind_chk check (
    asset_kind in ('photo','song','film','print_card','other')
  ),
  constraint christmas_story_assets_bucket_chk check (
    storage_bucket in ('christmas-story-source','christmas-story-generated')
  )
);

create index if not exists christmas_story_assets_order_idx
  on public.christmas_story_assets (order_id)
  where deleted_at is null;

create table if not exists public.christmas_story_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_story_orders (id) on delete cascade,
  job_type text not null,
  provider text not null default 'mock',
  status text not null default 'queued',
  attempts integer not null default 0,
  source_job_id text,
  cost_cents integer,
  commercial_rights text,
  result_asset_id uuid references public.christmas_story_assets (id) on delete set null,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_story_jobs_type_chk check (
    job_type in ('story','lyrics','song','film','print')
  ),
  constraint christmas_story_jobs_status_chk check (
    status in ('queued','generating','awaiting_manual','ready','failed','cancelled')
  ),
  constraint christmas_story_jobs_provider_chk check (
    provider in ('mock','manual','authorized_api','ffmpeg')
  )
);

create index if not exists christmas_story_jobs_order_idx
  on public.christmas_story_jobs (order_id, job_type);

create table if not exists public.christmas_story_access_grants (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_story_orders (id) on delete cascade,
  grant_kind text not null default 'recipient',
  token_hash text not null,
  pin_hash text,
  enabled boolean not null default false,
  expires_at timestamptz,
  revoked_at timestamptz,
  first_opened_at timestamptz,
  open_count integer not null default 0,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_story_access_token_chk check (length(token_hash) = 64),
  constraint christmas_story_access_kind_chk check (
    grant_kind in ('recipient','buyer_preview','email_recovery')
  )
);

create unique index if not exists christmas_story_access_token_uidx
  on public.christmas_story_access_grants (token_hash);
create unique index if not exists christmas_story_access_recipient_uidx
  on public.christmas_story_access_grants (order_id)
  where grant_kind = 'recipient';
create index if not exists christmas_story_access_order_idx
  on public.christmas_story_access_grants (order_id);

create table if not exists public.christmas_story_audit_events (
  id bigserial primary key,
  order_id uuid references public.christmas_story_orders (id) on delete set null,
  draft_id uuid references public.christmas_story_drafts (id) on delete set null,
  event_name text not null,
  actor_kind text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint christmas_story_audit_no_secrets_chk check (
    not (metadata ? 'token')
    and not (metadata ? 'recipient_token')
    and not (metadata ? 'buyer_access_token')
    and not (metadata ? 'email')
  )
);

create index if not exists christmas_story_audit_order_idx
  on public.christmas_story_audit_events (order_id, created_at desc);

create table if not exists public.christmas_story_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.christmas_story_orders (id) on delete set null,
  draft_id uuid references public.christmas_story_drafts (id) on delete set null,
  buyer_access_token_hash text,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint christmas_story_deletion_status_chk check (
    status in ('pending','completed','rejected')
  )
);

-- Touch triggers (reuse christmas_touch_updated_at when present)
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'christmas_touch_updated_at'
  ) then
    drop trigger if exists christmas_story_drafts_touch on public.christmas_story_drafts;
    create trigger christmas_story_drafts_touch
      before update on public.christmas_story_drafts
      for each row execute function public.christmas_touch_updated_at();

    drop trigger if exists christmas_story_orders_touch on public.christmas_story_orders;
    create trigger christmas_story_orders_touch
      before update on public.christmas_story_orders
      for each row execute function public.christmas_touch_updated_at();

    drop trigger if exists christmas_story_jobs_touch on public.christmas_story_jobs;
    create trigger christmas_story_jobs_touch
      before update on public.christmas_story_jobs
      for each row execute function public.christmas_touch_updated_at();

    drop trigger if exists christmas_story_access_touch on public.christmas_story_access_grants;
    create trigger christmas_story_access_touch
      before update on public.christmas_story_access_grants
      for each row execute function public.christmas_touch_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Server-enforced status transition helper
-- ---------------------------------------------------------------------------

create or replace function public.christmas_story_assert_transition(
  p_from text,
  p_to text
) returns boolean
language plpgsql
immutable
as $$
begin
  if p_from = p_to then
    return true;
  end if;
  if p_from = 'DRAFT' and p_to in ('CHECKOUT_PENDING','CANCELLED') then return true; end if;
  if p_from = 'CHECKOUT_PENDING' and p_to in ('PAID','FAILED','CANCELLED','DRAFT') then return true; end if;
  if p_from = 'PAID' and p_to in ('CONTENT_PENDING','GENERATING','FAILED') then return true; end if;
  if p_from = 'CONTENT_PENDING' and p_to in ('GENERATING','FAILED','CANCELLED') then return true; end if;
  if p_from = 'GENERATING' and p_to in ('REVIEW_REQUIRED','FAILED','RETRY') then return true; end if;
  if p_from = 'RETRY' and p_to in ('GENERATING','FAILED','CANCELLED') then return true; end if;
  if p_from = 'REVIEW_REQUIRED' and p_to in ('APPROVED','GENERATING','FAILED','CANCELLED') then return true; end if;
  if p_from = 'APPROVED' and p_to in ('READY_TO_SEND','CANCELLED') then return true; end if;
  if p_from = 'READY_TO_SEND' and p_to in ('SENT','CANCELLED') then return true; end if;
  if p_from = 'SENT' and p_to in ('OPENED') then return true; end if;
  if p_from = 'FAILED' and p_to in ('RETRY','CANCELLED','CHECKOUT_PENDING') then return true; end if;
  return false;
end;
$$;

create or replace function public.christmas_story_transition_order(
  p_order_id uuid,
  p_to text,
  p_actor text default 'system',
  p_metadata jsonb default '{}'::jsonb
) returns public.christmas_story_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.christmas_story_orders;
  v_from text;
  v_meta jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required';
  end if;

  select * into v_order
  from public.christmas_story_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  v_from := v_order.status;
  if not public.christmas_story_assert_transition(v_from, p_to) then
    raise exception 'invalid_transition from % to %', v_from, p_to;
  end if;

  -- Strip sensitive keys from audit metadata
  v_meta := coalesce(p_metadata, '{}'::jsonb)
    - 'token' - 'recipient_token' - 'buyer_access_token' - 'email' - 'pin';

  update public.christmas_story_orders
  set
    status = p_to,
    approved_at = case when p_to = 'APPROVED' then coalesce(approved_at, now()) else approved_at end,
    sent_at = case when p_to = 'SENT' then coalesce(sent_at, now()) else sent_at end,
    opened_at = case when p_to = 'OPENED' then coalesce(opened_at, now()) else opened_at end,
    updated_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into public.christmas_story_audit_events (order_id, event_name, actor_kind, metadata)
  values (
    p_order_id,
    'status_transition',
    coalesce(nullif(p_actor, ''), 'system'),
    jsonb_build_object('from', v_from, 'to', p_to) || v_meta
  );

  return v_order;
end;
$$;

revoke all on function public.christmas_story_transition_order(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.christmas_story_transition_order(uuid, text, text, jsonb) to service_role;

create or replace function public.christmas_story_fulfill_payment(
  p_order_id uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text,
  p_amount_cents integer,
  p_currency text,
  p_stripe_event_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.christmas_story_orders;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required';
  end if;

  select * into v_order
  from public.christmas_story_orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'order_not_found');
  end if;

  if v_order.payment_status = 'paid' then
    return jsonb_build_object('ok', true, 'code', 'already_paid', 'order_id', v_order.id);
  end if;

  if v_order.amount_cents is distinct from p_amount_cents
     or lower(v_order.currency) is distinct from lower(p_currency) then
    return jsonb_build_object('ok', false, 'code', 'amount_mismatch');
  end if;

  if v_order.stripe_mode is distinct from 'test' then
    return jsonb_build_object('ok', false, 'code', 'stripe_mode_rejected');
  end if;

  update public.christmas_story_orders
  set
    payment_status = 'paid',
    status = case
      when public.christmas_story_assert_transition(status, 'PAID') then 'PAID'
      else status
    end,
    stripe_checkout_session_id = coalesce(stripe_checkout_session_id, p_stripe_session_id),
    stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_stripe_payment_intent_id),
    stripe_event_id = coalesce(stripe_event_id, p_stripe_event_id),
    updated_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into public.christmas_story_audit_events (order_id, event_name, actor_kind, metadata)
  values (
    p_order_id,
    'payment_fulfilled',
    'stripe_test_webhook',
    jsonb_build_object(
      'stripe_event_id', p_stripe_event_id,
      'amount_cents', p_amount_cents,
      'currency', lower(p_currency)
    )
  );

  return jsonb_build_object('ok', true, 'code', 'paid', 'order_id', v_order.id, 'status', v_order.status);
end;
$$;

revoke all on function public.christmas_story_fulfill_payment(uuid, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.christmas_story_fulfill_payment(uuid, text, text, integer, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- RLS — no direct browser access to secrets/hashes; Edge uses service_role
-- ---------------------------------------------------------------------------

alter table public.christmas_story_drafts enable row level security;
alter table public.christmas_story_orders enable row level security;
alter table public.christmas_story_content_versions enable row level security;
alter table public.christmas_story_assets enable row level security;
alter table public.christmas_story_jobs enable row level security;
alter table public.christmas_story_access_grants enable row level security;
alter table public.christmas_story_audit_events enable row level security;
alter table public.christmas_story_deletion_requests enable row level security;

revoke all on table public.christmas_story_drafts from anon, authenticated, public;
revoke all on table public.christmas_story_orders from anon, authenticated, public;
revoke all on table public.christmas_story_content_versions from anon, authenticated, public;
revoke all on table public.christmas_story_assets from anon, authenticated, public;
revoke all on table public.christmas_story_jobs from anon, authenticated, public;
revoke all on table public.christmas_story_access_grants from anon, authenticated, public;
revoke all on table public.christmas_story_audit_events from anon, authenticated, public;
revoke all on table public.christmas_story_deletion_requests from anon, authenticated, public;

grant all on table public.christmas_story_drafts to service_role;
grant all on table public.christmas_story_orders to service_role;
grant all on table public.christmas_story_content_versions to service_role;
grant all on table public.christmas_story_assets to service_role;
grant all on table public.christmas_story_jobs to service_role;
grant all on table public.christmas_story_access_grants to service_role;
grant all on table public.christmas_story_audit_events to service_role;
grant all on table public.christmas_story_deletion_requests to service_role;
grant usage, select on sequence public.christmas_story_audit_events_id_seq to service_role;

-- Authenticated owners may read their own non-deleted orders (no token hashes exposed via view later).
drop policy if exists christmas_story_orders_owner_select on public.christmas_story_orders;
create policy christmas_story_orders_owner_select
  on public.christmas_story_orders
  for select
  to authenticated
  using (auth.uid() = buyer_user_id and deleted_at is null);

-- ---------------------------------------------------------------------------
-- Private storage buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'christmas-story-source',
    'christmas-story-source',
    false,
    8388608,
    array['image/jpeg','image/png','image/webp']::text[]
  ),
  (
    'christmas-story-generated',
    'christmas-story-generated',
    false,
    52428800,
    array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','video/mp4','application/pdf']::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No public storage policies — service role / signed URLs only.
drop policy if exists christmas_story_source_public on storage.objects;
drop policy if exists christmas_story_generated_public on storage.objects;

commit;
