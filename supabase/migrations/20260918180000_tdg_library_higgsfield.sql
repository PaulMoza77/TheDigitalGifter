-- Admin TDG Library persistence for Higgsfield image-to-video clips.
-- Private bucket; service role writes; admins read via /api/admin-library.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tdg-library',
  'tdg-library',
  false,
  209715200,
  array['image/jpeg','image/png','image/webp','video/mp4']
)
on conflict (id) do update set
  file_size_limit = greatest(storage.buckets.file_size_limit, excluded.file_size_limit),
  allowed_mime_types = (
    select array_agg(distinct x)
    from unnest(
      coalesce(storage.buckets.allowed_mime_types, '{}'::text[]) || excluded.allowed_mime_types
    ) as t(x)
  );

create table if not exists public.tdg_higgsfield_jobs (
  id uuid primary key default gen_random_uuid(),
  command_key text not null,
  status text not null default 'created',
  photo_id text not null,
  source_photo_src text,
  prompt text not null default '',
  model_key text not null,
  model_id text not null,
  requested_params jsonb not null default '{}'::jsonb,
  submitted_params jsonb not null default '{}'::jsonb,
  omitted_params jsonb not null default '[]'::jsonb,
  param_notes jsonb not null default '[]'::jsonb,
  provider_request_id text,
  provider_status_url text,
  provider_video_url text,
  estimated_cost_usd numeric,
  confirmed_cost_usd numeric,
  estimated_credits text,
  budget_usd numeric,
  library_item_id uuid,
  storage_bucket text,
  storage_path text,
  effective_duration_seconds numeric,
  effective_width integer,
  effective_height integer,
  last_error text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tdg_higgsfield_jobs_status_chk check (
    status in (
      'created','estimated','submitting','queued','in_progress','completed',
      'importing','imported','import_failed','failed','nsfw','canceled'
    )
  ),
  constraint tdg_higgsfield_jobs_model_chk check (model_key in ('kling-3.0-pro','seedance-2.0'))
);

create unique index if not exists tdg_higgsfield_jobs_command_key_uidx
  on public.tdg_higgsfield_jobs (command_key);

create unique index if not exists tdg_higgsfield_jobs_provider_request_uidx
  on public.tdg_higgsfield_jobs (provider_request_id)
  where provider_request_id is not null and length(trim(provider_request_id)) > 0;

create index if not exists tdg_higgsfield_jobs_status_idx
  on public.tdg_higgsfield_jobs (status, updated_at desc);

create table if not exists public.tdg_library_items (
  id uuid primary key default gen_random_uuid(),
  catalog_id text not null,
  title text not null,
  description text not null default '',
  filename text not null,
  category text not null default 'christmas_reels',
  kind text not null,
  duration_seconds numeric,
  poster_path text,
  storage_bucket text not null,
  storage_path text not null,
  source_photo_id text,
  prompt text,
  model_key text,
  model_id text,
  requested_params jsonb not null default '{}'::jsonb,
  submitted_params jsonb not null default '{}'::jsonb,
  provider_request_id text,
  effective_duration_seconds numeric,
  effective_width integer,
  effective_height integer,
  estimated_cost_usd numeric,
  confirmed_cost_usd numeric,
  job_id uuid references public.tdg_higgsfield_jobs (id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  constraint tdg_library_items_kind_chk check (kind in ('reel','short','photo'))
);

create unique index if not exists tdg_library_items_catalog_id_uidx
  on public.tdg_library_items (catalog_id);

create unique index if not exists tdg_library_items_provider_request_uidx
  on public.tdg_library_items (provider_request_id)
  where provider_request_id is not null and length(trim(provider_request_id)) > 0;

alter table public.tdg_higgsfield_jobs enable row level security;
alter table public.tdg_library_items enable row level security;

drop policy if exists tdg_higgsfield_jobs_admin_all on public.tdg_higgsfield_jobs;
create policy tdg_higgsfield_jobs_admin_all on public.tdg_higgsfield_jobs
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists tdg_library_items_admin_all on public.tdg_library_items;
create policy tdg_library_items_admin_all on public.tdg_library_items
  for all using (public.is_admin()) with check (public.is_admin());

revoke all on table public.tdg_higgsfield_jobs from anon, authenticated, public;
revoke all on table public.tdg_library_items from anon, authenticated, public;
grant select, insert, update, delete on table public.tdg_higgsfield_jobs to authenticated, service_role;
grant select, insert, update, delete on table public.tdg_library_items to authenticated, service_role;

comment on table public.tdg_higgsfield_jobs is
  'Admin Higgsfield I2V jobs. estimated_cost_usd vs confirmed_cost_usd stay separate; never invent confirmed cost.';
comment on column public.tdg_higgsfield_jobs.provider_request_id is
  'Higgsfield request_id. If set, resume polling this id — do not submit a duplicate paid generation.';
comment on column public.tdg_higgsfield_jobs.confirmed_cost_usd is
  'Filled only from a provider-confirmed amount. Leave null when unknown.';

commit;
