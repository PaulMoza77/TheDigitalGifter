-- Clear stale order.last_error when portrait generation completes successfully.
-- Keeps last_error when the batch is failed or partial_failure.

begin;

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
    next_status := 'awaiting_qc';
  end if;

  update public.pet_orders
  set
    status = next_status,
    generation_finished_at = now(),
    last_error = case
      when next_status = 'awaiting_qc' then null
      else last_error
    end
  where id = p_order_id
    and status in ('paid', 'generating', 'partial_failure', 'awaiting_qc');

  update public.pet_generation_jobs
  set
    status = case when next_status = 'awaiting_qc' then 'completed' else 'failed' end,
    last_error = case when next_status = 'awaiting_qc' then null else next_status end,
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
      'failed', failed_count
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

commit;
