-- Santa Call: unlimited paid +5 min extensions (cumulative), no commercial purchase cap.
-- Keeps infrastructure safety (max total duration) and per-order webhook idempotency.
-- Does NOT grant free minutes. Does NOT change initial 59 RON / 180s pricing.

-- Raise V2 one-extension duration ceiling (600s = 180+300) so cumulative paid extensions work.
alter table public.christmas_santa_call_entitlements
  drop constraint if exists christmas_santa_call_entitlements_duration_chk;
alter table public.christmas_santa_call_entitlements
  add constraint christmas_santa_call_entitlements_duration_chk
  check (
    max_duration_seconds > 0
    and max_duration_seconds <= 7200
    and remaining_seconds >= 0
    and remaining_seconds <= max_duration_seconds
  );

-- Allow multiple extension rows per entitlement; idempotency remains on order_id UNIQUE.
alter table public.christmas_santa_call_extensions
  drop constraint if exists christmas_santa_call_extensions_entitlement_id_key;

create index if not exists christmas_santa_call_extensions_entitlement_idx
  on public.christmas_santa_call_extensions (entitlement_id);

-- Track cumulative paid extension seconds already exists (extension_seconds_granted).
-- Infra ceiling: 2h total purchased budget (180 initial + paid extensions). Not a commercial SKU cap.
-- ~20× +5min paid extensions + initial stays under this; refuses further paid grants past the ceiling.

create or replace function public.activate_christmas_santa_call_extension(
  p_entitlement_id uuid,
  p_order_id uuid,
  p_seconds integer default 300,
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ent public.christmas_santa_call_entitlements%rowtype;
  ord public.christmas_orders%rowtype;
  secs integer := least(300, greatest(1, coalesce(p_seconds, 300)));
  existing uuid;
  infra_cap integer := 7200;
  next_remaining integer;
  next_max integer;
  next_status text;
  purchase_count integer;
begin
  select * into ord from public.christmas_orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing_order');
  end if;
  if ord.payment_status <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'payment_required');
  end if;
  if ord.product_key <> 'christmas_santa_voice_call_extension' then
    return jsonb_build_object('ok', false, 'reason', 'wrong_product');
  end if;

  -- Webhook / confirm idempotency: same paid extension order never grants twice.
  select id into existing from public.christmas_santa_call_extensions where order_id = p_order_id;
  if found then
    select * into ent from public.christmas_santa_call_entitlements where id = p_entitlement_id;
    return jsonb_build_object(
      'ok', true,
      'reason', 'already_extended',
      'entitlement_id', ent.id,
      'remaining_seconds', ent.remaining_seconds,
      'max_duration_seconds', ent.max_duration_seconds,
      'status', ent.status,
      'extension_count', (
        select count(*)::int from public.christmas_santa_call_extensions x where x.entitlement_id = p_entitlement_id
      )
    );
  end if;

  select * into ent from public.christmas_santa_call_entitlements where id = p_entitlement_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing_entitlement');
  end if;
  if ent.status in ('revoked', 'refunded', 'expired') then
    return jsonb_build_object('ok', false, 'reason', ent.status);
  end if;

  -- Paid extensions allowed before or after time expiry (awaiting / ready / in_progress / completed).
  if ent.status not in ('awaiting_extension', 'ready', 'in_progress', 'completed') then
    return jsonb_build_object('ok', false, 'reason', 'not_eligible', 'status', ent.status);
  end if;

  if ent.max_duration_seconds + secs > infra_cap then
    return jsonb_build_object(
      'ok', false,
      'reason', 'infra_cap_reached',
      'max_duration_seconds', ent.max_duration_seconds,
      'infra_cap_seconds', infra_cap
    );
  end if;

  insert into public.christmas_santa_call_extensions (
    entitlement_id, order_id, seconds_granted, stripe_checkout_session_id, stripe_payment_intent_id
  ) values (
    p_entitlement_id, p_order_id, secs, p_stripe_checkout_session_id, p_stripe_payment_intent_id
  );

  next_remaining := greatest(0, coalesce(ent.remaining_seconds, 0)) + secs;
  next_max := least(infra_cap, ent.max_duration_seconds + secs);
  -- After payment, customer can resume immediately (new technical session if needed).
  next_status := case
    when ent.status = 'in_progress' then 'in_progress'
    else 'ready'
  end;

  update public.christmas_santa_call_entitlements
  set
    remaining_seconds = next_remaining,
    max_duration_seconds = next_max,
    extension_purchased_at = now(),
    extension_seconds_granted = coalesce(extension_seconds_granted, 0) + secs,
    status = next_status,
    updated_at = now()
  where id = p_entitlement_id
  returning * into ent;

  select count(*)::int into purchase_count
  from public.christmas_santa_call_extensions
  where entitlement_id = p_entitlement_id;

  update public.christmas_orders
  set fulfillment_status = 'completed',
      fulfillment_completed_at = coalesce(fulfillment_completed_at, now())
  where id = p_order_id;

  return jsonb_build_object(
    'ok', true,
    'entitlement_id', ent.id,
    'remaining_seconds', ent.remaining_seconds,
    'max_duration_seconds', ent.max_duration_seconds,
    'status', ent.status,
    'extension_count', purchase_count,
    'seconds_granted', secs
  );
end;
$$;

revoke all on function public.activate_christmas_santa_call_extension(uuid, uuid, integer, text, text) from anon, authenticated, public;
grant execute on function public.activate_christmas_santa_call_extension(uuid, uuid, integer, text, text) to service_role;

-- Resolve: always offer paid extension when time is exhausted; also flag mid-call availability.
create or replace function public.resolve_christmas_santa_call_access(p_access_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ent public.christmas_santa_call_entitlements%rowtype;
  profile public.christmas_santa_call_profiles%rowtype;
  active_count integer;
  purchase_count integer := 0;
begin
  select * into ent
  from public.christmas_santa_call_entitlements
  where access_token_hash = lower(trim(p_access_token_hash));

  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;

  if ent.revoked_at is not null or ent.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;
  if ent.status = 'refunded' then
    return jsonb_build_object('ok', false, 'code', 'refunded');
  end if;
  if ent.expires_at < now() or ent.status = 'expired' then
    update public.christmas_santa_call_entitlements
      set status = 'expired', updated_at = now()
      where id = ent.id and status <> 'expired';
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  select count(*)::int into purchase_count
  from public.christmas_santa_call_extensions x
  where x.entitlement_id = ent.id;

  select * into profile from public.christmas_santa_call_profiles where id = ent.profile_id;

  -- Time exhausted → commercial extension offer (repeatable; not gated on prior purchases).
  if ent.status = 'awaiting_extension'
     or (ent.remaining_seconds <= 0 and ent.status in ('completed', 'awaiting_extension', 'ready', 'in_progress')) then
    if ent.status <> 'awaiting_extension' then
      update public.christmas_santa_call_entitlements
        set status = 'awaiting_extension', remaining_seconds = 0, updated_at = now()
        where id = ent.id;
    end if;
    return jsonb_build_object(
      'ok', false,
      'code', 'awaiting_extension',
      'extension_available', true,
      'extension_price_minor', 4900,
      'extension_currency', 'ron',
      'extension_seconds', 300,
      'extension_count', purchase_count,
      'entitlement_id', ent.id,
      'order_id', ent.order_id,
      'child_first_name', profile.child_first_name,
      'language', profile.language,
      'remaining_seconds', 0,
      'max_duration_seconds', ent.max_duration_seconds
    );
  end if;

  if ent.status not in ('ready', 'in_progress') then
    return jsonb_build_object('ok', false, 'code', 'not_ready', 'status', ent.status);
  end if;

  select count(*) into active_count
  from public.christmas_santa_call_sessions
  where entitlement_id = ent.id
    and status in ('connecting', 'connected', 'listening', 'speaking', 'reconnecting');

  return jsonb_build_object(
    'ok', true,
    'entitlement_id', ent.id,
    'order_id', ent.order_id,
    'status', ent.status,
    'remaining_seconds', ent.remaining_seconds,
    'max_duration_seconds', ent.max_duration_seconds,
    'expires_at', ent.expires_at,
    'grace_period_seconds', ent.grace_period_seconds,
    'active_session', active_count > 0,
    'language', profile.language,
    'child_first_name', profile.child_first_name,
    'provider_preference', ent.provider_preference,
    'extension_purchased', purchase_count > 0,
    'extension_count', purchase_count,
    'extension_available', true,
    'is_extension_segment', purchase_count > 0 and ent.remaining_seconds > 0
  );
end;
$$;

revoke all on function public.resolve_christmas_santa_call_access(text) from anon, authenticated, public;
grant execute on function public.resolve_christmas_santa_call_access(text) to service_role;

-- Heartbeat: when time hits 0, always offer another paid extension (unlimited commercial).
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
      'extension_available', (ent.status = 'awaiting_extension' or ent.remaining_seconds <= 0),
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
    update public.christmas_santa_call_sessions
    set status = 'completed', ended_at = now(), end_reason = 'duration_limit', updated_at = now()
    where id = sess.id;

    update public.christmas_santa_call_entitlements
    set status = 'awaiting_extension', remaining_seconds = 0, updated_at = now()
    where id = ent.id
    returning * into ent;

    insert into public.christmas_santa_call_events (entitlement_id, session_id, order_id, event_name, event_payload)
    values (
      ent.id,
      sess.id,
      ent.order_id,
      'session_force_end',
      jsonb_build_object('reason', 'duration_limit', 'extension_available', true)
    );

    return jsonb_build_object(
      'ok', true,
      'force_end', true,
      'remaining_seconds', 0,
      'wrap_up', true,
      'extension_available', true,
      'entitlement_status', 'awaiting_extension'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'remaining_seconds', remaining,
    'wrap_up', warn_wrap,
    'force_end', false,
    'extension_available', true
  );
end;
$$;

revoke all on function public.heartbeat_christmas_santa_call_session(uuid, text, integer, text) from anon, authenticated, public;
grant execute on function public.heartbeat_christmas_santa_call_session(uuid, text, integer, text) to service_role;

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

  if sess.status in ('completed', 'failed', 'orphaned_closed') then
    if ent.remaining_seconds <= 0 and ent.status = 'completed' then
      update public.christmas_santa_call_entitlements
      set status = 'awaiting_extension', updated_at = now()
      where id = ent.id
      returning * into ent;
    end if;

    return jsonb_build_object(
      'ok', true,
      'remaining_seconds', ent.remaining_seconds,
      'entitlement_status', ent.status,
      'extension_available', (ent.status = 'awaiting_extension' or ent.remaining_seconds <= 0),
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

  if new_remaining <= 0 then
    -- Always offer another paid extension after a segment ends (hangup or duration).
    next_status := 'awaiting_extension';
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

-- Begin: remaining<=0 → awaiting_extension even if prior extensions exist; resume after paid time.
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
  purchase_count integer := 0;
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

  if ent.remaining_seconds <= 0 then
    update public.christmas_santa_call_entitlements
    set status = 'awaiting_extension', remaining_seconds = 0, updated_at = now()
    where id = ent.id;
    return jsonb_build_object('ok', false, 'code', 'awaiting_extension', 'extension_available', true);
  end if;

  select count(*)::int into purchase_count
  from public.christmas_santa_call_extensions x
  where x.entitlement_id = ent.id;

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
  -- Resume without re-intro whenever prior paid time or resume notes exist (any extension #).
  if (purchase_count > 0 or coalesce(ent.extension_seconds_granted, 0) > 0)
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
    'language', profile.language,
    'extension_count', purchase_count
  );
end;
$$;

revoke all on function public.begin_christmas_santa_call_session(text, text, text, text) from anon, authenticated, public;
grant execute on function public.begin_christmas_santa_call_session(text, text, text, text) to service_role;
