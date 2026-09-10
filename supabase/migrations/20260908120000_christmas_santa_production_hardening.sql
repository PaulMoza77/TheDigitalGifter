-- Santa V1 production hardening: retention timestamps + indexes.
-- purchasable remains false; price_cents remains 0. No live price invented.
-- Mux-as-prod is the production video path until CHRISTMAS_SANTA_VIDEO_MODEL is set.

begin;

alter table public.christmas_santa_video_jobs
  add column if not exists intermediates_purge_after timestamptz,
  add column if not exists personalization_purge_after timestamptz,
  add column if not exists intermediates_purged_at timestamptz,
  add column if not exists personalization_purged_at timestamptz,
  add column if not exists final_purged_at timestamptz;

update public.christmas_santa_video_jobs
set
  intermediates_purge_after = coalesce(
    intermediates_purge_after,
    coalesce(completed_at, created_at) + interval '14 days'
  ),
  personalization_purge_after = coalesce(
    personalization_purge_after,
    coalesce(completed_at, created_at) + interval '90 days'
  ),
  retention_delete_after = coalesce(
    retention_delete_after,
    coalesce(completed_at, created_at) + interval '365 days'
  )
where intermediates_purge_after is null
   or personalization_purge_after is null
   or retention_delete_after is null;

create index if not exists christmas_santa_jobs_intermediates_purge_idx
  on public.christmas_santa_video_jobs (intermediates_purge_after)
  where intermediates_purged_at is null;

create index if not exists christmas_santa_jobs_personalization_purge_idx
  on public.christmas_santa_video_jobs (personalization_purge_after)
  where personalization_purged_at is null;

create index if not exists christmas_santa_jobs_final_retention_idx
  on public.christmas_santa_video_jobs (retention_delete_after)
  where final_purged_at is null;

comment on column public.christmas_santa_video_jobs.intermediates_purge_after is
  'When speech audio + order-scoped still may be deleted (default completed_at+14d). Shared template stills are never deleted.';
comment on column public.christmas_santa_video_jobs.personalization_purge_after is
  'When child free-text is redacted in place (default completed_at+90d). Consent flags remain.';
comment on column public.christmas_santa_video_jobs.retention_delete_after is
  'When the final MP4 is deleted (default completed_at+365d / CHRISTMAS_SANTA_RETENTION_DAYS).';

-- Founder gate: do not activate live Santa purchase in this hardening task.
update public.christmas_packages pkg
set purchasable = false, price_cents = 0, updated_at = now()
from public.christmas_products p
where pkg.product_id = p.id
  and p.product_key = 'christmas_santa_video';

comment on table public.christmas_santa_video_jobs is
  'Santa long-running pipeline. Production video path is mux-as-prod (ffmpeg still+TTS) unless CHRISTMAS_SANTA_VIDEO_MODEL is set. Retention cron: christmas-santa-retention.';

commit;
