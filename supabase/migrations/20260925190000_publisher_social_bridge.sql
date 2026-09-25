-- Bridge Publisher publications to social-publisher.
-- One Publisher publication (IG + FB + YT) maps to ONE social_publications row
-- and per-platform social_publication_targets. No backfill when Autopilot is enabled.

begin;

alter table public.social_publications
  add column if not exists publisher_publication_id uuid unique
    references public.publisher_publications(id) on delete set null;

create index if not exists social_publications_publisher_publication_id_idx
  on public.social_publications (publisher_publication_id)
  where publisher_publication_id is not null;

alter table public.social_publisher_settings
  add column if not exists live_posts_enabled_at timestamptz;

alter table public.social_publication_targets
  add column if not exists skip_reason text;

comment on column public.social_publications.publisher_publication_id is
  'Idempotent link: one Publisher publication creates at most one social publication.';
comment on column public.social_publisher_settings.live_posts_enabled_at is
  'Set only when Autopilot real posting is explicitly enabled. Targets scheduled before this instant are never backfilled.';
comment on column public.social_publication_targets.skip_reason is
  'Non-null means the live worker must not dispatch (e.g. pre_activation). Historical rows are kept.';

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
declare
  v_enabled_at timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;

  select s.live_posts_enabled_at
    into v_enabled_at
  from public.social_publisher_settings s
  where s.id = 1;

  return query
  with due as (
    select t.id
    from public.social_publication_targets t
    join public.social_publications p on p.id = t.publication_id
    where t.status in ('scheduled', 'queued', 'uploading')
      and t.remote_post_id is null
      and coalesce(t.skip_reason, '') = ''
      and p.cancelled_at is null
      and p.status in ('scheduled', 'processing', 'partial', 'failed')
      and p.scheduled_at <= p_now
      and (v_enabled_at is null or p.scheduled_at >= v_enabled_at)
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
