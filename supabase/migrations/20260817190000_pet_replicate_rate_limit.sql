-- Durable Replicate create lock + rate_limited scene/clip status.
-- Additive: does not rewrite historical ledger rows or successful predictions.

begin;

alter table public.pet_order_scenes
  drop constraint if exists pet_order_scenes_status_chk;

alter table public.pet_order_scenes
  add constraint pet_order_scenes_status_chk check (
    status in ('queued', 'generating', 'succeeded', 'failed', 'ready', 'rate_limited')
  );

alter table public.pet_order_video_clips
  drop constraint if exists pet_order_video_clips_status_chk;

alter table public.pet_order_video_clips
  add constraint pet_order_video_clips_status_chk check (
    status in ('queued', 'generating', 'succeeded', 'failed', 'ready', 'rate_limited')
  );

create table if not exists public.pet_provider_create_locks (
  order_id uuid not null references public.pet_orders (id) on delete cascade,
  kind text not null,
  holder text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (order_id, kind),
  constraint pet_provider_create_locks_kind_chk check (kind in ('image', 'video'))
);

create or replace function public.claim_pet_provider_create_lock(
  p_order_id uuid,
  p_kind text,
  p_holder text,
  p_lease_seconds integer default 150
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lease integer := greatest(30, least(coalesce(p_lease_seconds, 150), 300));
  updated integer := 0;
begin
  if p_order_id is null or p_kind not in ('image', 'video') or length(trim(coalesce(p_holder, ''))) = 0 then
    return jsonb_build_object('claimed', false, 'reason', 'invalid');
  end if;

  insert into public.pet_provider_create_locks (order_id, kind, holder, expires_at, updated_at)
  values (p_order_id, p_kind, trim(p_holder), now() + make_interval(secs => lease), now())
  on conflict (order_id, kind) do update
    set holder = excluded.holder,
        expires_at = excluded.expires_at,
        updated_at = now()
    where pet_provider_create_locks.expires_at <= now()
       or pet_provider_create_locks.holder = excluded.holder;

  get diagnostics updated = row_count;
  if updated = 0 then
    return jsonb_build_object('claimed', false, 'reason', 'held');
  end if;

  return jsonb_build_object('claimed', true, 'holder', trim(p_holder), 'lease_seconds', lease);
end;
$$;

create or replace function public.release_pet_provider_create_lock(
  p_order_id uuid,
  p_kind text,
  p_holder text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.pet_provider_create_locks
  where order_id = p_order_id
    and kind = p_kind
    and holder = trim(coalesce(p_holder, ''));
  return jsonb_build_object('released', true);
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
    and (
      status in ('queued', 'held', 'failed')
      or (status = 'running' and claimed_at < now() - interval '150 seconds')
    )
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

revoke all on function public.claim_pet_provider_create_lock(uuid, text, text, integer) from anon, authenticated, public;
revoke all on function public.release_pet_provider_create_lock(uuid, text, text) from anon, authenticated, public;
grant execute on function public.claim_pet_provider_create_lock(uuid, text, text, integer) to service_role;
grant execute on function public.release_pet_provider_create_lock(uuid, text, text) to service_role;

commit;
