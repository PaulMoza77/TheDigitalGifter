-- Invalidate the synthetic 12.6s YouTube cache and jobs that treated it as a real source.
-- Do not delete unrelated Library assets.

alter table public.clip_factory_media
  add column if not exists invalidated_at timestamptz,
  add column if not exists invalid_reason text;

update public.clip_factory_media
set
  invalidated_at = now(),
  invalid_reason = 'Poisoned YouTube cache: 12.6s ~174KB uniform/dark encode reused as https://youtu.be/pV9UPP7n0Po instead of the original video.'
where media_hash = '1035c4690f0871aab131142f8b39fb055b82eaea8fe38706519dcc377d0b2c33'
   or (
     source_url in ('https://www.youtube.com/watch?v=pV9UPP7n0Po', 'https://youtu.be/pV9UPP7n0Po')
     and coalesce(file_size_bytes, 0) < 500000
     and coalesce(duration_seconds, 0) between 12 and 13
   );

update public.clip_factory_jobs
set
  status = 'failed',
  stage = 'failed',
  failed_stage = 'importing',
  error_code = 'synthetic_or_empty',
  error_message = 'Imported file was a 12.6s placeholder, not the YouTube original. Upload the original MP4 or retry after a real import.',
  progress_label = 'Invalid source · not the YouTube video',
  clips_generated = 0,
  lease_expires_at = null,
  updated_at = now()
where media_hash = '1035c4690f0871aab131142f8b39fb055b82eaea8fe38706519dcc377d0b2c33'
   or id in (
     'c24a3ecd-e903-4fb2-afca-ac0778a4d9c3',
     '4e64a7f8-266f-4fc9-8b3b-ef5d307ace4d',
     'd4d0bed3-5760-47c7-bd09-349229ea7b91'
   );

update public.clip_factory_renders
set
  status = 'failed',
  error_message = 'Invalid: rendered from placeholder source, not the YouTube original.',
  updated_at = now()
where job_id in (
  select id from public.clip_factory_jobs
  where media_hash = '1035c4690f0871aab131142f8b39fb055b82eaea8fe38706519dcc377d0b2c33'
     or id in (
       'c24a3ecd-e903-4fb2-afca-ac0778a4d9c3',
       '4e64a7f8-266f-4fc9-8b3b-ef5d307ace4d',
       'd4d0bed3-5760-47c7-bd09-349229ea7b91'
     )
);

update public.library_assets
set
  title = case
    when title like '[INVALID]%' then title
    else '[INVALID] ' || title
  end,
  provenance = coalesce(provenance, '{}'::jsonb) || jsonb_build_object(
    'invalid', true,
    'invalid_reason', 'Clip Factory placeholder/synthetic source (12.6s dark encode), not the YouTube original.'
  ),
  updated_at = now()
where provenance->>'clip_factory_job' in (
  'c24a3ecd-e903-4fb2-afca-ac0778a4d9c3',
  '4e64a7f8-266f-4fc9-8b3b-ef5d307ace4d',
  'd4d0bed3-5760-47c7-bd09-349229ea7b91'
)
or (provenance->>'source_url' = 'https://www.youtube.com/watch?v=pV9UPP7n0Po' and coalesce(duration_seconds, 0) between 5 and 6);
