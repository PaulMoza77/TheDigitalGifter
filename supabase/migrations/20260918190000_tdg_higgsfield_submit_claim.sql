-- Atomic submit claim + spec fields. Higgsfield POST is not idempotent.

begin;

alter table public.tdg_higgsfield_jobs
  drop constraint if exists tdg_higgsfield_jobs_status_chk;

alter table public.tdg_higgsfield_jobs
  add constraint tdg_higgsfield_jobs_status_chk check (
    status in (
      'created','estimated','submitting','submit_unconfirmed','queued','in_progress','completed',
      'importing','imported','import_failed','failed','nsfw','canceled'
    )
  );

alter table public.tdg_higgsfield_jobs
  add column if not exists submit_claimed_at timestamptz,
  add column if not exists spec_ok boolean,
  add column if not exists spec_notes jsonb not null default '[]'::jsonb,
  add column if not exists source_width integer,
  add column if not exists source_height integer;

alter table public.tdg_library_items
  add column if not exists spec_ok boolean,
  add column if not exists spec_notes jsonb not null default '[]'::jsonb;

comment on column public.tdg_higgsfield_jobs.submit_claimed_at is
  'Set atomically when claiming paid submit. submitting without provider_request_id must not auto-retry POST.';
comment on column public.tdg_higgsfield_jobs.spec_ok is
  'True only when imported MP4 is readable and matches requested 5s / 9:16 / 1080x1920. Original still stored.';

commit;
