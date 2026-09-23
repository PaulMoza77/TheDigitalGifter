-- Extend the existing social publisher for YouTube OAuth + upload options.
-- Reuses social_accounts / social_publication_targets. No duplicate tables.

begin;

alter table public.social_publication_targets
  add column if not exists platform_options jsonb not null default '{}'::jsonb;

alter table public.social_publication_targets
  drop constraint if exists social_publication_targets_platform_check;

alter table public.social_publication_targets
  add constraint social_publication_targets_platform_check
  check (platform in (
    'instagram_reels',
    'instagram_photo',
    'instagram_video',
    'facebook_reels',
    'facebook_photo',
    'facebook_video',
    'tiktok',
    'youtube_shorts',
    'youtube_video'
  ));

alter table public.social_publication_targets
  drop constraint if exists social_publication_targets_status_check;

alter table public.social_publication_targets
  add constraint social_publication_targets_status_check
  check (status in (
    'draft',
    'scheduled',
    'queued',
    'uploading',
    'processing',
    'published',
    'failed',
    'cancelled'
  ));

-- Allow reclaim of interrupted YouTube uploads (status uploading with expired lease).
create or replace function public.claim_social_publication_targets(
  p_limit integer,
  p_worker_id text,
  p_now timestamptz default now()
)
returns setof public.social_publication_targets
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;

  return query
  with due as (
    select t.id
    from public.social_publication_targets t
    join public.social_publications p on p.id = t.publication_id
    where t.status in ('scheduled', 'queued', 'uploading')
      and t.remote_post_id is null
      and p.cancelled_at is null
      and p.status in ('scheduled', 'processing', 'partial', 'failed')
      and p.scheduled_at <= p_now
      and (t.next_retry_at is null or t.next_retry_at <= p_now)
      and (t.lease_expires_at is null or t.lease_expires_at <= p_now)
    order by p.scheduled_at asc, t.id asc
    limit greatest(1, least(coalesce(p_limit, 8), 25))
    for update of t skip locked
  )
  update public.social_publication_targets as t
  set
    status = 'processing',
    attempts = t.attempts + 1,
    claimed_by = p_worker_id,
    claimed_at = p_now,
    lease_expires_at = p_now + interval '15 minutes',
    updated_at = p_now
  from due
  where t.id = due.id
  returning t.*;
end;
$$;

revoke all on function public.claim_social_publication_targets(integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_social_publication_targets(integer, text, timestamptz) to service_role;

commit;
