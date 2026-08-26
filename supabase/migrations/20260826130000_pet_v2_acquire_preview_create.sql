-- Atomic create slot for V2 preview: at most one live Replicate create per idempotency key.
-- Failed validation / pre-provider rejects never insert prediction_id, so they never consume quota
-- (quota still counts only live_generation=true AND status=succeeded).

begin;

create or replace function public.acquire_pet_v2_preview_create(
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key text := left(btrim(coalesce(p_idempotency_key, '')), 180);
  row public.pet_v2_preview_attempts%rowtype;
begin
  if length(key) < 8 then
    raise exception 'invalid_idempotency_key';
  end if;

  select * into row
  from public.pet_v2_preview_attempts
  where idempotency_key = key
  for update;

  if not found then
    return jsonb_build_object('action', 'missing');
  end if;

  if coalesce(row.prediction_id, '') <> '' then
    return jsonb_build_object(
      'action', 'resume',
      'prediction_id', row.prediction_id,
      'status', row.status,
      'live_generation', coalesce(row.live_generation, false)
    );
  end if;

  -- Another request already marked processing without a prediction yet — wait/resume shortly.
  if row.status = 'processing' then
    return jsonb_build_object(
      'action', 'wait',
      'status', row.status,
      'started_at', row.started_at
    );
  end if;

  if row.status not in ('pending', 'failed') then
    return jsonb_build_object(
      'action', 'resume',
      'prediction_id', row.prediction_id,
      'status', row.status,
      'live_generation', coalesce(row.live_generation, false)
    );
  end if;

  update public.pet_v2_preview_attempts
  set
    status = 'processing',
    started_at = coalesce(started_at, now()),
    completed_at = null,
    last_error_category = null
  where idempotency_key = key
    and coalesce(prediction_id, '') = ''
    and status in ('pending', 'failed')
  returning * into row;

  if not found then
    select * into row
    from public.pet_v2_preview_attempts
    where idempotency_key = key;
    if coalesce(row.prediction_id, '') <> '' then
      return jsonb_build_object(
        'action', 'resume',
        'prediction_id', row.prediction_id,
        'status', row.status,
        'live_generation', coalesce(row.live_generation, false)
      );
    end if;
    return jsonb_build_object('action', 'wait', 'status', coalesce(row.status, 'processing'));
  end if;

  return jsonb_build_object('action', 'create', 'status', 'processing');
end;
$$;

revoke all on function public.acquire_pet_v2_preview_create(text) from public, anon, authenticated;
grant execute on function public.acquire_pet_v2_preview_create(text) to service_role;

comment on function public.acquire_pet_v2_preview_create(text) is
  'Row-locked create gate: only one concurrent caller may create a Replicate prediction for a V2 preview attempt key.';

commit;
