-- Santa Call V2: duration expiry must offer the one-time extension, not jump to completed.
-- Root cause: heartbeat_christmas_santa_call_session forced status='completed' at remaining<=0,
-- so create_extension_checkout saw extension_unavailable after a full 180s call.

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

  used := greatest(0, least(coalesce(p_seconds_elapsed, 0), ent.max_duration_seconds));
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

revoke all on function public.heartbeat_christmas_santa_call_session(uuid, text, integer, text) from anon, authenticated, public;
grant execute on function public.heartbeat_christmas_santa_call_session(uuid, text, integer, text) to service_role;

-- Heal end() idempotent path: duration_limit sessions stuck on completed without an extension purchase.
create or replace function public.end_christmas_santa_call_session(
  p_session_id uuid,
  p_access_token_hash text,
  p_seconds_elapsed integer,
  p_reason text default 'user_hangup',
  p_keep_remaining boolean default false,
  p_error_code text default null,
  p_cost_usd numeric default null,
  p_cost_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ent public.christmas_santa_call_entitlements%rowtype;
  sess public.christmas_santa_call_sessions%rowtype;
  used integer := greatest(0, coalesce(p_seconds_elapsed, 0));
  new_remaining integer;
  has_extension boolean := false;
  next_status text;
  reason text := coalesce(nullif(trim(p_reason), ''), 'user_hangup');
begin
  select * into sess from public.christmas_santa_call_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_session');
  end if;

  select * into ent
  from public.christmas_santa_call_entitlements
  where id = sess.entitlement_id
    and access_token_hash = lower(trim(p_access_token_hash))
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;

  select exists(select 1 from public.christmas_santa_call_extensions x where x.entitlement_id = ent.id) into has_extension;

  if sess.status in ('completed', 'failed', 'orphaned_closed') then
    -- Heal: timer already closed the session as completed before extension offer was introduced/fixed.
    if sess.end_reason = 'duration_limit'
       and not has_extension
       and ent.status = 'completed'
       and ent.remaining_seconds <= 0 then
      update public.christmas_santa_call_entitlements
      set status = 'awaiting_extension', updated_at = now()
      where id = ent.id
      returning * into ent;
    end if;

    return jsonb_build_object(
      'ok', true,
      'remaining_seconds', ent.remaining_seconds,
      'entitlement_status', ent.status,
      'extension_available', (ent.status = 'awaiting_extension'),
      'idempotent', true
    );
  end if;

  if p_keep_remaining and reason in ('technical_interrupt', 'network_drop', 'provider_mint_failed', 'provider_unsupported_client') then
    new_remaining := greatest(
      0,
      coalesce(sess.remaining_seconds_at_start, ent.remaining_seconds) - least(used, coalesce(sess.remaining_seconds_at_start, ent.remaining_seconds))
    );
  else
    new_remaining := 0;
  end if;

  update public.christmas_santa_call_sessions
  set status = case
        when p_error_code is not null and reason like '%fail%' then 'failed'
        else 'completed'
      end,
      ended_at = now(),
      seconds_used = used,
      end_reason = reason,
      error_code = p_error_code,
      cost_usd = p_cost_usd,
      cost_metadata = coalesce(p_cost_metadata, '{}'::jsonb),
      updated_at = now()
  where id = sess.id;

  if new_remaining <= 0 and not has_extension and reason = 'duration_limit' then
    next_status := 'awaiting_extension';
  elsif new_remaining <= 0 then
    next_status := 'completed';
  else
    next_status := 'ready';
  end if;

  update public.christmas_santa_call_entitlements
  set remaining_seconds = new_remaining,
      status = next_status,
      updated_at = now()
  where id = ent.id
  returning * into ent;

  return jsonb_build_object(
    'ok', true,
    'remaining_seconds', ent.remaining_seconds,
    'entitlement_status', ent.status,
    'extension_available', (ent.status = 'awaiting_extension')
  );
end;
$$;

revoke all on function public.end_christmas_santa_call_session(uuid, text, integer, text, boolean, text, numeric, jsonb) from anon, authenticated, public;
grant execute on function public.end_christmas_santa_call_session(uuid, text, integer, text, boolean, text, numeric, jsonb) to service_role;

-- When remaining is already 0 without an extension, surface awaiting_extension (not completed).
create or replace function public.begin_christmas_santa_call_session(
  p_access_token_hash text,
  p_provider text,
  p_client_fingerprint_hash text default null,
  p_provider_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ent public.christmas_santa_call_entitlements%rowtype;
  sess public.christmas_santa_call_sessions%rowtype;
  profile public.christmas_santa_call_profiles%rowtype;
  resume jsonb;
  resume_mode boolean := false;
  has_extension boolean := false;
begin
  if p_provider not in ('openai_realtime', 'elevenlabs_agents') then
    return jsonb_build_object('ok', false, 'code', 'invalid_provider');
  end if;

  select * into ent
  from public.christmas_santa_call_entitlements
  where access_token_hash = lower(trim(p_access_token_hash))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;
  if ent.status = 'awaiting_extension' then
    return jsonb_build_object('ok', false, 'code', 'awaiting_extension', 'extension_available', true);
  end if;
  if ent.status in ('revoked', 'refunded', 'expired', 'completed', 'pending_payment', 'failed') then
    return jsonb_build_object('ok', false, 'code', ent.status);
  end if;
  if ent.expires_at < now() then
    update public.christmas_santa_call_entitlements set status = 'expired', updated_at = now() where id = ent.id;
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  select exists(select 1 from public.christmas_santa_call_extensions x where x.entitlement_id = ent.id) into has_extension;

  if ent.remaining_seconds <= 0 then
    if not has_extension then
      update public.christmas_santa_call_entitlements
      set status = 'awaiting_extension', remaining_seconds = 0, updated_at = now()
      where id = ent.id;
      return jsonb_build_object('ok', false, 'code', 'awaiting_extension', 'extension_available', true);
    end if;
    update public.christmas_santa_call_entitlements set status = 'completed', updated_at = now() where id = ent.id;
    return jsonb_build_object('ok', false, 'code', 'completed');
  end if;

  select * into sess
  from public.christmas_santa_call_sessions
  where entitlement_id = ent.id
    and status in ('connecting', 'connected', 'listening', 'speaking', 'reconnecting')
  for update;

  if found then
    if sess.last_heartbeat_at is not null
       and sess.last_heartbeat_at < now() - make_interval(secs => ent.grace_period_seconds) then
      update public.christmas_santa_call_sessions
      set status = 'orphaned_closed',
          ended_at = coalesce(ended_at, now()),
          end_reason = 'grace_timeout',
          updated_at = now()
      where id = sess.id;
    elsif p_client_fingerprint_hash is not null
          and sess.client_fingerprint_hash is not null
          and sess.client_fingerprint_hash <> p_client_fingerprint_hash then
      return jsonb_build_object('ok', false, 'code', 'concurrent_session');
    else
      update public.christmas_santa_call_sessions
      set status = 'reconnecting',
          last_heartbeat_at = now(),
          provider_session_id = coalesce(p_provider_session_id, provider_session_id),
          updated_at = now()
      where id = sess.id
      returning * into sess;

      return jsonb_build_object(
        'ok', true,
        'resumed', true,
        'session_id', sess.id,
        'remaining_seconds', ent.remaining_seconds,
        'entitlement_id', ent.id,
        'order_id', ent.order_id
      );
    end if;
  end if;

  select * into profile from public.christmas_santa_call_profiles where id = ent.profile_id;

  resume := coalesce(ent.resume_context, '{}'::jsonb);
  if ent.extension_seconds_granted > 0
     and ent.resume_context_expires_at is not null
     and ent.resume_context_expires_at > now()
     and coalesce(resume->>'summary', '') <> '' then
    resume_mode := true;
  end if;

  insert into public.christmas_santa_call_sessions (
    entitlement_id, order_id, status, provider, provider_session_id,
    started_at, remaining_seconds_at_start, client_fingerprint_hash, last_heartbeat_at
  )
  values (
    ent.id, ent.order_id, 'connecting', p_provider, p_provider_session_id,
    now(), ent.remaining_seconds, p_client_fingerprint_hash, now()
  )
  returning * into sess;

  update public.christmas_santa_call_entitlements
  set status = 'in_progress', updated_at = now()
  where id = ent.id;

  return jsonb_build_object(
    'ok', true,
    'session_id', sess.id,
    'remaining_seconds', ent.remaining_seconds,
    'entitlement_id', ent.id,
    'order_id', ent.order_id,
    'resume_mode', resume_mode,
    'child_first_name', profile.child_first_name,
    'language', profile.language
  );
end;
$$;

revoke all on function public.begin_christmas_santa_call_session(text, text, text, text) from anon, authenticated, public;
grant execute on function public.begin_christmas_santa_call_session(text, text, text, text) to service_role;
