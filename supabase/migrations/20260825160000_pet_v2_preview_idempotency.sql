-- V2 free-preview idempotency: one logical attempt -> one Replicate prediction.
-- Smallest safe additive change to pet_v2_preview_attempts.

alter table public.pet_v2_preview_attempts
  add column if not exists idempotency_key text,
  add column if not exists prediction_id text,
  add column if not exists status text,
  add column if not exists provider text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists last_error_category text;

-- Existing rows are completed live successes recorded after Replicate returned.
update public.pet_v2_preview_attempts
set
  status = coalesce(status, 'succeeded'),
  provider = coalesce(provider, 'replicate'),
  started_at = coalesce(started_at, created_at),
  completed_at = coalesce(completed_at, created_at)
where live_generation = true;

alter table public.pet_v2_preview_attempts
  alter column status set default 'pending';

update public.pet_v2_preview_attempts
set status = 'pending'
where status is null;

alter table public.pet_v2_preview_attempts
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pet_v2_preview_attempts_status_check'
  ) then
    alter table public.pet_v2_preview_attempts
      add constraint pet_v2_preview_attempts_status_check
      check (status in ('pending', 'processing', 'succeeded', 'failed'));
  end if;
end $$;

create unique index if not exists pet_v2_preview_attempts_idempotency_uidx
  on public.pet_v2_preview_attempts (idempotency_key)
  where idempotency_key is not null;

create index if not exists pet_v2_preview_attempts_prediction_idx
  on public.pet_v2_preview_attempts (prediction_id)
  where prediction_id is not null;

create index if not exists pet_v2_preview_attempts_session_status_idx
  on public.pet_v2_preview_attempts (session_id, status, created_at desc);

-- Atomic claim: insert pending row or return the existing attempt for this key.
create or replace function public.claim_pet_v2_preview_attempt(
  p_idempotency_key text,
  p_session_id text,
  p_ip_hash text,
  p_image_hash text,
  p_species text,
  p_scene_key text default 'royal-portrait'
)
returns public.pet_v2_preview_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.pet_v2_preview_attempts%rowtype;
  inserted public.pet_v2_preview_attempts%rowtype;
  key text := left(btrim(coalesce(p_idempotency_key, '')), 180);
begin
  if length(key) < 8 then
    raise exception 'invalid_idempotency_key';
  end if;

  select * into existing
  from public.pet_v2_preview_attempts
  where idempotency_key = key
  limit 1;

  if found then
    return existing;
  end if;

  begin
    insert into public.pet_v2_preview_attempts (
      idempotency_key,
      session_id,
      ip_hash,
      image_hash,
      species,
      scene_key,
      live_generation,
      status,
      provider,
      started_at
    )
    values (
      key,
      left(btrim(coalesce(p_session_id, '')), 64),
      left(btrim(coalesce(p_ip_hash, '')), 64),
      left(btrim(coalesce(p_image_hash, '')), 64),
      left(btrim(coalesce(p_species, 'dog')), 16),
      left(btrim(coalesce(p_scene_key, 'royal-portrait')), 64),
      false,
      'pending',
      'replicate',
      now()
    )
    returning * into inserted;
    return inserted;
  exception
    when unique_violation then
      select * into existing
      from public.pet_v2_preview_attempts
      where idempotency_key = key
      limit 1;
      return existing;
  end;
end;
$$;

revoke all on function public.claim_pet_v2_preview_attempt(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_pet_v2_preview_attempt(text, text, text, text, text, text) to service_role;

create or replace function public.update_pet_v2_preview_attempt(
  p_idempotency_key text,
  p_status text,
  p_prediction_id text default null,
  p_live_generation boolean default null,
  p_last_error_category text default null,
  p_clear_prediction boolean default false
)
returns public.pet_v2_preview_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.pet_v2_preview_attempts%rowtype;
  key text := left(btrim(coalesce(p_idempotency_key, '')), 180);
  next_status text := left(btrim(coalesce(p_status, '')), 32);
begin
  if length(key) < 8 then
    raise exception 'invalid_idempotency_key';
  end if;
  if next_status not in ('pending', 'processing', 'succeeded', 'failed') then
    raise exception 'invalid_status';
  end if;

  update public.pet_v2_preview_attempts
  set
    status = next_status,
    prediction_id = case
      when coalesce(p_clear_prediction, false) then null
      when p_prediction_id is not null and length(btrim(p_prediction_id)) > 0
        then left(btrim(p_prediction_id), 80)
      else prediction_id
    end,
    live_generation = coalesce(p_live_generation, live_generation),
    last_error_category = case
      when next_status = 'failed' then left(btrim(coalesce(p_last_error_category, '')), 40)
      when next_status = 'succeeded' then null
      else last_error_category
    end,
    completed_at = case
      when next_status in ('succeeded', 'failed') then now()
      when next_status in ('pending', 'processing') then null
      else completed_at
    end,
    provider = coalesce(provider, 'replicate')
  where idempotency_key = key
  returning * into updated;

  if not found then
    raise exception 'attempt_not_found';
  end if;

  return updated;
end;
$$;

revoke all on function public.update_pet_v2_preview_attempt(text, text, text, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.update_pet_v2_preview_attempt(text, text, text, boolean, text, boolean) to service_role;
