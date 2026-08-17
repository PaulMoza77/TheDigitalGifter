-- Skip human QC. Generated portraits and clips are customer-ready immediately.

create or replace function public.pet_finalize_generation_if_done(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  total_count integer;
  terminal_count integer;
  succeeded_count integer;
  failed_count integer;
  next_status text;
begin
  select
    count(*),
    count(*) filter (where status in ('succeeded', 'failed', 'ready')),
    count(*) filter (where status in ('succeeded', 'ready')),
    count(*) filter (where status = 'failed')
  into total_count, terminal_count, succeeded_count, failed_count
  from public.pet_order_scenes
  where order_id = p_order_id;

  if total_count < 12 or terminal_count < total_count then
    return jsonb_build_object('finalized', false, 'terminal', terminal_count, 'total', total_count);
  end if;

  if succeeded_count = 0 then
    next_status := 'failed';
  elsif failed_count > 0 then
    next_status := 'partial_failure';
  else
    next_status := 'complete';
  end if;

  update public.pet_order_scenes
  set
    status = 'ready',
    qc_status = 'approved',
    progress_percent = 100
  where order_id = p_order_id
    and status = 'succeeded';

  update public.pet_orders
  set
    status = next_status,
    generation_finished_at = now(),
    completed_at = case when next_status = 'complete' then coalesce(completed_at, now()) else completed_at end,
    qc_status = case when next_status = 'complete' then coalesce(qc_status, 'approved') else qc_status end,
    last_error = case when next_status in ('complete', 'partial_failure') and failed_count < 12 then null else last_error end
  where id = p_order_id
    and status in ('paid', 'generating', 'partial_failure', 'awaiting_qc', 'complete');

  update public.pet_generation_jobs
  set
    status = case when next_status = 'failed' then 'failed' else 'completed' end,
    last_error = case when next_status = 'failed' then next_status else null end,
    finished_at = now()
  where order_id = p_order_id
    and status in ('running', 'queued', 'held', 'failed');

  perform public.pet_log_event(
    p_order_id,
    'generation_batch_finished',
    'system',
    null,
    null,
    jsonb_build_object(
      'next_status', next_status,
      'succeeded', succeeded_count,
      'failed', failed_count,
      'qc_skipped', true
    )
  );

  return jsonb_build_object(
    'finalized', true,
    'status', next_status,
    'succeeded', succeeded_count,
    'failed', failed_count
  );
end;
$$;

create or replace function public.pet_finalize_video_if_done(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  total_count integer;
  terminal_count integer;
  succeeded_count integer;
  failed_count integer;
  next_status text;
begin
  select
    count(*),
    count(*) filter (where status in ('succeeded', 'failed', 'ready')),
    count(*) filter (where status in ('succeeded', 'ready')),
    count(*) filter (where status = 'failed')
  into total_count, terminal_count, succeeded_count, failed_count
  from public.pet_order_video_clips
  where pet_order_id = p_order_id;

  if total_count < 2 or terminal_count < total_count then
    return jsonb_build_object('finalized', false, 'terminal', terminal_count, 'total', total_count);
  end if;

  if succeeded_count = 0 then
    next_status := 'failed';
  elsif failed_count > 0 then
    next_status := 'partial_failure';
  else
    next_status := 'complete';
  end if;

  update public.pet_order_video_clips
  set
    status = 'ready',
    qc_status = 'approved'
  where pet_order_id = p_order_id
    and status = 'succeeded';

  update public.pet_orders
  set
    status = next_status,
    completed_at = case when next_status = 'complete' then coalesce(completed_at, now()) else completed_at end,
    last_error = case when next_status = 'partial_failure' then 'video_partial_failure' else null end
  where id = p_order_id
    and status in ('generating_videos', 'partial_failure', 'awaiting_video_qc', 'complete');

  perform public.pet_log_event(
    p_order_id,
    'video_batch_finished',
    'system',
    null,
    null,
    jsonb_build_object(
      'next_status', next_status,
      'succeeded', succeeded_count,
      'failed', failed_count,
      'qc_skipped', true
    )
  );

  return jsonb_build_object(
    'finalized', true,
    'status', next_status,
    'succeeded', succeeded_count,
    'failed', failed_count
  );
end;
$$;

update public.pet_order_scenes
set
  status = 'ready',
  qc_status = coalesce(qc_status, 'approved'),
  progress_percent = 100
where status = 'succeeded';

update public.pet_order_video_clips
set
  status = 'ready',
  qc_status = coalesce(qc_status, 'approved')
where status = 'succeeded';

update public.pet_orders
set
  status = 'complete',
  completed_at = coalesce(completed_at, now()),
  qc_status = coalesce(qc_status, 'approved'),
  last_error = null
where status in ('awaiting_qc', 'awaiting_video_qc')
  and paid_at is not null;
