-- Allow download/finalizing statuses used by the origin worker.

alter table public.clip_factory_jobs drop constraint if exists clip_factory_jobs_status_check;
alter table public.clip_factory_jobs
  add constraint clip_factory_jobs_status_check
  check (status in (
    'queued',
    'uploading',
    'source_detected',
    'waiting_for_media',
    'importing',
    'downloading',
    'extracting_audio',
    'transcribing',
    'analyzing',
    'selecting_moments',
    'rendering',
    'captioning',
    'saving',
    'finalizing',
    'completed',
    'failed',
    'ingesting',
    'analyzing_audio',
    'understanding_scenes',
    'finding_hooks',
    'scoring',
    'ready',
    'partial'
  ));
