-- Content Autopilot production hardening: atomic usage, research lock, concept claims.

begin;

alter table public.content_concepts
  add column if not exists claimed_by text,
  add column if not exists claimed_at timestamptz,
  add column if not exists lease_expires_at timestamptz;

create index if not exists content_concepts_claim_idx
  on public.content_concepts (pipeline_status, lease_expires_at, updated_at);

create or replace function public.content_autopilot_bump_usage(
  p_usage_date date,
  p_research_candidates integer default 0,
  p_production_concepts integer default 0,
  p_images_generated integer default 0,
  p_image_retries integer default 0,
  p_videos_generated integer default 0,
  p_video_retries integer default 0,
  p_estimated_spend_usd numeric default 0,
  p_research_completed boolean default null
)
returns public.content_autopilot_daily_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.content_autopilot_daily_usage;
begin
  insert into public.content_autopilot_daily_usage (usage_date)
  values (p_usage_date)
  on conflict (usage_date) do nothing;

  update public.content_autopilot_daily_usage
  set
    research_candidates = research_candidates + coalesce(p_research_candidates, 0),
    production_concepts = production_concepts + coalesce(p_production_concepts, 0),
    images_generated = images_generated + coalesce(p_images_generated, 0),
    image_retries = image_retries + coalesce(p_image_retries, 0),
    videos_generated = videos_generated + coalesce(p_videos_generated, 0),
    video_retries = video_retries + coalesce(p_video_retries, 0),
    estimated_spend_usd = estimated_spend_usd + coalesce(p_estimated_spend_usd, 0),
    research_completed = coalesce(p_research_completed, research_completed),
    updated_at = now()
  where usage_date = p_usage_date
  returning * into row;

  return row;
end;
$$;

create or replace function public.content_autopilot_try_reserve_spend(
  p_usage_date date,
  p_additional_usd numeric,
  p_max_daily_usd numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  insert into public.content_autopilot_daily_usage (usage_date)
  values (p_usage_date)
  on conflict (usage_date) do nothing;

  update public.content_autopilot_daily_usage
  set updated_at = now()
  where usage_date = p_usage_date
    and (estimated_spend_usd + greatest(coalesce(p_additional_usd, 0), 0)) <= greatest(coalesce(p_max_daily_usd, 0), 0)
  returning true into ok;

  if ok is distinct from true then
    return false;
  end if;

  if coalesce(p_additional_usd, 0) > 0 then
    perform public.content_autopilot_bump_usage(
      p_usage_date,
      p_estimated_spend_usd => p_additional_usd
    );
  end if;

  return true;
end;
$$;

create or replace function public.content_autopilot_begin_research(p_usage_date date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  started boolean;
begin
  insert into public.content_autopilot_daily_usage (usage_date)
  values (p_usage_date)
  on conflict (usage_date) do nothing;

  update public.content_autopilot_daily_usage
  set research_completed = true, updated_at = now()
  where usage_date = p_usage_date
    and research_completed = false
  returning true into started;

  return coalesce(started, false);
end;
$$;

create or replace function public.claim_content_autopilot_concept(
  p_worker_id text,
  p_usage_date date,
  p_now timestamptz default now(),
  p_lease_seconds integer default 900
)
returns setof public.content_concepts
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select c.id
    from public.content_concepts c
    where c.usage_date = p_usage_date
      and c.pipeline_status in (
        'selected',
        'prompts_ready',
        'generating_assets',
        'qc_review',
        'assembling_reel',
        'library_pending_finish'
      )
      and (
        c.lease_expires_at is null
        or c.lease_expires_at < p_now
        or c.claimed_by = p_worker_id
      )
    order by c.updated_at asc
    limit 1
    for update skip locked
  )
  update public.content_concepts c
  set
    claimed_by = p_worker_id,
    claimed_at = p_now,
    lease_expires_at = p_now + make_interval(secs => greatest(p_lease_seconds, 60)),
    updated_at = p_now
  from candidate
  where c.id = candidate.id
  returning c.*;
end;
$$;

commit;
