-- Christmas Santa Video V1: personalization, jobs, packages, retention defaults.
-- purchasable remains false; no live price invented.

begin;

-- Expand generated bucket for MP4 outputs (additive; keep private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'christmas-generated',
  'christmas-generated',
  false,
  104857600,
  array['image/jpeg','image/png','image/webp','video/mp4','audio/mpeg','audio/mp3','audio/wav']
)
on conflict (id) do update set
  file_size_limit = greatest(storage.buckets.file_size_limit, excluded.file_size_limit),
  allowed_mime_types = (
    select array_agg(distinct x)
    from unnest(
      coalesce(storage.buckets.allowed_mime_types, '{}'::text[]) || excluded.allowed_mime_types
    ) as t(x)
  );

-- Product copy
update public.christmas_products
set
  name = 'Personalized Santa Video',
  description = 'Santa speaks your child’s name in a private Christmas video.',
  metadata = coalesce(metadata, '{}'::jsonb)
    || '{"foundation":true,"live_offer":false,"privacy_required":true,"santa_video_v1":true}'::jsonb
    - 'coming_soon',
  updated_at = now()
where product_key = 'christmas_santa_video';

insert into public.christmas_packages (
  product_id, package_key, package_name, description,
  currency, price_cents, compare_at_cents, active, purchasable, features, sort_order, metadata
)
select
  p.id,
  pkg.package_key,
  pkg.package_name,
  'Draft package — not a live public offer.',
  'usd',
  0,
  null,
  true,
  false,
  pkg.features::jsonb,
  pkg.sort_order,
  '{"live_offer":false,"note":"price unpublished; set purchasable + price in a later launch task"}'::jsonb
from public.christmas_products p
cross join (
  values
    ('basic', 'Santa Video — Basic', '["1 personalized Santa video","English or Romanian"]', 10),
    ('premium', 'Santa Video — Premium', '["1 personalized Santa video","Priority rendering (when enabled)"]', 20),
    ('deluxe', 'Santa Video — Deluxe', '["1 personalized Santa video","Future extras reserved"]', 30)
) as pkg(package_key, package_name, features, sort_order)
where p.product_key = 'christmas_santa_video'
  and not exists (
    select 1 from public.christmas_packages x
    where x.product_id = p.id and x.package_key = pkg.package_key
  );

update public.christmas_packages pkg
set purchasable = false, price_cents = 0, updated_at = now()
from public.christmas_products p
where pkg.product_id = p.id
  and p.product_key = 'christmas_santa_video';

-- Minimized personalization (no school/address/phone)
create table if not exists public.christmas_santa_personalization (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.christmas_orders (id) on delete cascade,
  child_first_name text not null,
  language text not null,
  age smallint,
  something_good text,
  hobby_or_interest text,
  christmas_wish text,
  custom_fact text,
  sender_name text,
  template_key text not null default 'classic_santa',
  guardian_consent boolean not null default false,
  consent_version text not null default 'santa_v1_2026_09',
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_santa_personalization_lang_chk check (language in ('en', 'ro')),
  constraint christmas_santa_personalization_name_chk check (
    char_length(trim(child_first_name)) between 1 and 40
  ),
  constraint christmas_santa_personalization_age_chk check (
    age is null or (age >= 1 and age <= 17)
  )
);

create index if not exists christmas_santa_personalization_lang_idx
  on public.christmas_santa_personalization (language, created_at desc);

drop trigger if exists christmas_santa_personalization_touch on public.christmas_santa_personalization;
create trigger christmas_santa_personalization_touch
before update on public.christmas_santa_personalization
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_santa_personalization enable row level security;

drop policy if exists christmas_santa_personalization_admin_read on public.christmas_santa_personalization;
create policy christmas_santa_personalization_admin_read
  on public.christmas_santa_personalization for select
  using (public.is_admin());

revoke all on table public.christmas_santa_personalization from anon, authenticated, public;
grant select on table public.christmas_santa_personalization to authenticated;
grant all on table public.christmas_santa_personalization to service_role;

-- Long-running Santa job (one per order)
create table if not exists public.christmas_santa_video_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.christmas_orders (id) on delete cascade,
  language text not null,
  template_key text not null default 'classic_santa',
  job_status text not null default 'draft',
  script_status text not null default 'pending',
  audio_status text not null default 'pending',
  video_status text not null default 'pending',
  script_text text,
  script_word_count integer,
  estimated_duration_seconds integer,
  source_audio_bucket text,
  source_audio_path text,
  santa_still_bucket text,
  santa_still_path text,
  result_video_bucket text,
  result_video_path text,
  result_asset_id uuid,
  provider_script text,
  provider_tts text,
  provider_video text,
  provider_job_id text,
  model_script text,
  model_tts text,
  model_video text,
  error_code text,
  error_message_safe text,
  attempt_count integer not null default 0,
  cost_script_usd numeric(10,6),
  cost_tts_usd numeric(10,6),
  cost_still_usd numeric(10,6),
  cost_video_usd numeric(10,6),
  cost_total_usd numeric(10,6),
  cost_state text not null default 'unknown',
  latency_script_ms integer,
  latency_tts_ms integer,
  latency_still_ms integer,
  latency_video_ms integer,
  latency_total_ms integer,
  retention_delete_after timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint christmas_santa_video_jobs_status_chk check (
    job_status in (
      'draft',
      'queued',
      'script_ready',
      'audio_queued',
      'audio_ready',
      'video_queued',
      'video_processing',
      'rendering',
      'completed',
      'failed'
    )
  ),
  constraint christmas_santa_video_jobs_stage_chk check (
    script_status in ('pending', 'running', 'ready', 'failed')
    and audio_status in ('pending', 'running', 'ready', 'failed')
    and video_status in ('pending', 'running', 'ready', 'failed')
  ),
  constraint christmas_santa_video_jobs_attempt_chk check (attempt_count >= 0)
);

create index if not exists christmas_santa_video_jobs_status_idx
  on public.christmas_santa_video_jobs (job_status, created_at desc);

drop trigger if exists christmas_santa_video_jobs_touch on public.christmas_santa_video_jobs;
create trigger christmas_santa_video_jobs_touch
before update on public.christmas_santa_video_jobs
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_santa_video_jobs enable row level security;

drop policy if exists christmas_santa_video_jobs_admin_read on public.christmas_santa_video_jobs;
create policy christmas_santa_video_jobs_admin_read
  on public.christmas_santa_video_jobs for select
  using (public.is_admin());

revoke all on table public.christmas_santa_video_jobs from anon, authenticated, public;
grant select on table public.christmas_santa_video_jobs to authenticated;
grant all on table public.christmas_santa_video_jobs to service_role;

-- Claim / resume Santa job (requires paid order)
create or replace function public.claim_christmas_santa_video_job(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.christmas_orders%rowtype;
  job public.christmas_santa_video_jobs%rowtype;
begin
  select * into ord from public.christmas_orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'missing_order');
  end if;
  if ord.payment_status <> 'paid' then
    return jsonb_build_object('claimed', false, 'reason', 'payment_required');
  end if;
  if ord.product_key <> 'christmas_santa_video' then
    return jsonb_build_object('claimed', false, 'reason', 'wrong_product');
  end if;

  insert into public.christmas_santa_video_jobs (order_id, language, template_key, job_status)
  values (p_order_id, 'en', 'classic_santa', 'queued')
  on conflict (order_id) do nothing;

  select * into job from public.christmas_santa_video_jobs where order_id = p_order_id for update;
  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'missing_job');
  end if;

  if job.job_status = 'completed' then
    return jsonb_build_object('claimed', false, 'status', 'already_completed');
  end if;

  if job.job_status in ('video_processing', 'rendering', 'audio_queued', 'video_queued')
     and job.started_at is not null
     and job.started_at > now() - interval '20 minutes' then
    return jsonb_build_object('claimed', false, 'status', 'already_running');
  end if;

  update public.christmas_santa_video_jobs
  set
    job_status = 'queued',
    attempt_count = attempt_count + 1,
    started_at = coalesce(started_at, now()),
    error_code = null,
    error_message_safe = null,
    updated_at = now()
  where order_id = p_order_id
  returning * into job;

  update public.christmas_orders
  set fulfillment_status = 'processing', generation_started_at = coalesce(generation_started_at, now())
  where id = p_order_id;

  return jsonb_build_object('claimed', true, 'job_id', job.id, 'attempt', job.attempt_count);
end;
$$;

revoke all on function public.claim_christmas_santa_video_job(uuid) from anon, authenticated, public;
grant execute on function public.claim_christmas_santa_video_job(uuid) to service_role;

-- Retention defaults: personalization 90d after completion; intermediates 14d; final video 365d
comment on table public.christmas_santa_video_jobs is
  'Santa long-running pipeline. retention_delete_after applies to personalization+intermediates policy; final video retention documented in TDG_CHRISTMAS_SANTA_VIDEO.md';

commit;
