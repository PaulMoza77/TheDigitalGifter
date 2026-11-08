-- Enforce monotonic Santa Call usage from server timestamps.
-- No pricing or production changes. Apply only after review.
create or replace function public.heartbeat_christmas_santa_call_session(
  p_session_id uuid,
  p_access_token_hash text,
  p_seconds_elapsed integer,
  p_ui_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ent public.christmas_santa_call_entitlements%rowtype;
  sess public.christmas_santa_call_sessions%rowtype;
  used integer;
  remaining integer;
  warn_wrap boolean := false;
  has_extension boolean := false;
  next_ent_status text;
begin
  select * into sess from public.christmas_santa_call_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'missing_session');
  end if;

  select * into ent from public.christmas_santa_call_entitlements where id = sess.entitlement_id for update;
  if ent.access_token_hash <> lower(trim(p_access_token_hash)) then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;

  if sess.status in ('completed', 'failed', 'orphaned_closed') then
    return jsonb_build_object(
      'ok', false,
      'code', 'session_closed',
      'status', sess.status,
      'remaining_seconds', ent.remaining_seconds,
      'extension_available', (ent.status = 'awaiting_extension'),
      'entitlement_status', ent.status
    );
  end if;

  -- Server time is authoritative and usage can never decrease on replay.
  used := least(ent.max_duration_seconds, greatest(
    0,
    coalesce(sess.seconds_used, 0),
    coalesce(p_seconds_elapsed, 0),
    floor(extract(epoch from (clock_timestamp() -
      coalesce(sess.connected_at, sess.started_at, sess.created_at))))::integer
  ));
  remaining := greatest(0, coalesce(sess.remaining_seconds_at_start, ent.remaining_seconds) - used);

  update public.christmas_santa_call_sessions
  set
    seconds_used = used,
    status = case
      when p_ui_status in ('connected', 'listening', 'speaking', 'reconnecting') then p_ui_status
      when sess.connected_at is null then 'connected'
      else sess.status
    end,
    connected_at = coalesce(connected_at, now()),
    last_heartbeat_at = now(),
    updated_at = now()
  where id = sess.id;

  update public.christmas_santa_call_entitlements
  set remaining_seconds = remaining, updated_at = now()
  where id = ent.id;

  if remaining <= 20 and remaining > 0 then
    warn_wrap := true;
  end if;

  if remaining <= 0 then
    select exists(
      select 1 from public.christmas_santa_call_extensions x where x.entitlement_id = ent.id
    ) into has_extension;

    next_ent_status := case
      when not has_extension then 'awaiting_extension'
      else 'completed'
    end;

    update public.christmas_santa_call_sessions
    set status = 'completed', ended_at = now(), end_reason = 'duration_limit', updated_at = now()
    where id = sess.id;

    update public.christmas_santa_call_entitlements
    set status = next_ent_status, remaining_seconds = 0, updated_at = now()
    where id = ent.id
    returning * into ent;

    insert into public.christmas_santa_call_events (entitlement_id, session_id, order_id, event_name, event_payload)
    values (
      ent.id,
      sess.id,
      ent.order_id,
      'session_force_end',
      jsonb_build_object(
        'reason', 'duration_limit',
        'extension_available', (next_ent_status = 'awaiting_extension')
      )
    );

    return jsonb_build_object(
      'ok', true,
      'force_end', true,
      'remaining_seconds', 0,
      'wrap_up', true,
      'extension_available', (next_ent_status = 'awaiting_extension'),
      'entitlement_status', next_ent_status
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'remaining_seconds', remaining,
    'wrap_up', warn_wrap,
    'force_end', false,
    'extension_available', false
  );
end;
$$;
