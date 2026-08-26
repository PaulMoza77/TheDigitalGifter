-- Atomic V2 preview begin: claim + quota reservation + create gate under one transaction.
-- Deploy order: apply this migration BEFORE deploying pet-v2-preview edge function.
-- Fail-closed: edge must not create Replicate predictions without a successful create action from this RPC.
-- Orphaned processing (no prediction_id past TTL) returns orphan_timeout — never auto-creates a second prediction.

begin;

create or replace function public.begin_pet_v2_preview_create(
  p_idempotency_key text,
  p_session_id text,
  p_ip_hash text,
  p_image_hash text,
  p_species text default 'dog',
  p_scene_key text default 'formula-racer',
  p_session_limit integer default 2,
  p_ip_limit integer default 5,
  p_image_limit integer default 2,
  p_orphan_seconds integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  key text := left(btrim(coalesce(p_idempotency_key, '')), 180);
  sess text := left(btrim(coalesce(p_session_id, '')), 64);
  iph text := left(btrim(coalesce(p_ip_hash, '')), 64);
  img text := left(btrim(coalesce(p_image_hash, '')), 64);
  row public.pet_v2_preview_attempts%rowtype;
  since timestamptz := now() - interval '24 hours';
  session_used integer := 0;
  ip_used integer := 0;
  image_used integer := 0;
  oldest timestamptz;
  retry_after integer;
  orphan_secs integer := greatest(30, least(coalesce(p_orphan_seconds, 90), 600));
begin
  if length(key) < 8 then
    return jsonb_build_object('action', 'invalid', 'error_code', 'invalid_idempotency_key');
  end if;

  -- Serialize admission across session / IP / image scopes for this transaction.
  perform pg_advisory_xact_lock(hashtext('v2pv:s'), hashtext(coalesce(nullif(sess, ''), 'anon')));
  perform pg_advisory_xact_lock(hashtext('v2pv:i'), hashtext(coalesce(nullif(iph, ''), 'unknown')));
  perform pg_advisory_xact_lock(hashtext('v2pv:h'), hashtext(coalesce(nullif(img, ''), 'none')));

  select * into row
  from public.pet_v2_preview_attempts
  where idempotency_key = key
  for update;

  if not found then
    begin
      insert into public.pet_v2_preview_attempts (
        idempotency_key,
        session_id,
        ip_hash,
        image_hash,
        species,
        scene_key,
        live_generation,
        status,
        provider,
        started_at
      )
      values (
        key,
        sess,
        iph,
        img,
        left(btrim(coalesce(p_species, 'dog')), 16),
        left(btrim(coalesce(p_scene_key, 'formula-racer')), 64),
        false,
        'pending',
        'replicate',
        now()
      )
      returning * into row;
    exception
      when unique_violation then
        select * into row
        from public.pet_v2_preview_attempts
        where idempotency_key = key
        for update;
    end;
  end if;

  if coalesce(row.prediction_id, '') <> '' then
    return jsonb_build_object(
      'action', 'resume',
      'prediction_id', row.prediction_id,
      'status', row.status,
      'live_generation', coalesce(row.live_generation, false)
    );
  end if;

  if row.status = 'succeeded' then
    return jsonb_build_object(
      'action', 'resume',
      'prediction_id', row.prediction_id,
      'status', row.status,
      'live_generation', coalesce(row.live_generation, false)
    );
  end if;

  if row.status = 'processing' then
    if row.started_at is not null
       and row.started_at > now() - make_interval(secs => orphan_secs) then
      return jsonb_build_object(
        'action', 'wait',
        'status', 'processing',
        'started_at', row.started_at
      );
    end if;
    -- Ambiguous crash after claim, before prediction_id: do not create another prediction.
    return jsonb_build_object(
      'action', 'orphan_timeout',
      'error_code', 'claim_orphan',
      'failure_category', 'server_error',
      'status', 'processing',
      'started_at', row.started_at
    );
  end if;

  -- Quota: succeeded live (24h) + active processing within orphan lease only.
  -- Expired orphans do not reserve capacity for 24h.
  select count(*)::int into session_used
  from public.pet_v2_preview_attempts a
  where a.session_id = sess
    and a.session_id <> ''
    and (
      (coalesce(a.live_generation, false) = true and a.status = 'succeeded' and a.created_at >= since)
      or (
        a.status = 'processing'
        and a.started_at is not null
        and a.started_at > now() - make_interval(secs => orphan_secs)
      )
    );

  select count(*)::int into ip_used
  from public.pet_v2_preview_attempts a
  where a.ip_hash = iph
    and a.ip_hash <> ''
    and (
      (coalesce(a.live_generation, false) = true and a.status = 'succeeded' and a.created_at >= since)
      or (
        a.status = 'processing'
        and a.started_at is not null
        and a.started_at > now() - make_interval(secs => orphan_secs)
      )
    );

  select count(*)::int into image_used
  from public.pet_v2_preview_attempts a
  where a.image_hash = img
    and a.image_hash <> ''
    and (
      (coalesce(a.live_generation, false) = true and a.status = 'succeeded' and a.created_at >= since)
      or (
        a.status = 'processing'
        and a.started_at is not null
        and a.started_at > now() - make_interval(secs => orphan_secs)
      )
    );

  if session_used >= greatest(1, coalesce(p_session_limit, 2)) then
    select min(
      case
        when coalesce(a.live_generation, false) = true and a.status = 'succeeded'
          then a.created_at + interval '24 hours'
        when a.status = 'processing'
          and a.started_at is not null
          and a.started_at > now() - make_interval(secs => orphan_secs)
          then a.started_at + make_interval(secs => orphan_secs)
        else null
      end
    ) into oldest
    from public.pet_v2_preview_attempts a
    where a.session_id = sess
      and (
        (coalesce(a.live_generation, false) = true and a.status = 'succeeded' and a.created_at >= since)
        or (
          a.status = 'processing'
          and a.started_at is not null
          and a.started_at > now() - make_interval(secs => orphan_secs)
        )
      );
    retry_after := greatest(
      1,
      ceil(extract(epoch from (coalesce(oldest, now() + interval '1 second') - now())))::int
    );
    return jsonb_build_object(
      'action', 'quota_denied',
      'error_code', 'rate_limited',
      'failure_category', 'rate_limit',
      'rate_limit_kind', 'session',
      'retry_after_seconds', retry_after,
      'remaining_session', 0
    );
  end if;

  if ip_used >= greatest(1, coalesce(p_ip_limit, 5)) then
    select min(
      case
        when coalesce(a.live_generation, false) = true and a.status = 'succeeded'
          then a.created_at + interval '24 hours'
        when a.status = 'processing'
          and a.started_at is not null
          and a.started_at > now() - make_interval(secs => orphan_secs)
          then a.started_at + make_interval(secs => orphan_secs)
        else null
      end
    ) into oldest
    from public.pet_v2_preview_attempts a
    where a.ip_hash = iph
      and (
        (coalesce(a.live_generation, false) = true and a.status = 'succeeded' and a.created_at >= since)
        or (
          a.status = 'processing'
          and a.started_at is not null
          and a.started_at > now() - make_interval(secs => orphan_secs)
        )
      );
    retry_after := greatest(
      1,
      ceil(extract(epoch from (coalesce(oldest, now() + interval '1 second') - now())))::int
    );
    return jsonb_build_object(
      'action', 'quota_denied',
      'error_code', 'rate_limited',
      'failure_category', 'rate_limit',
      'rate_limit_kind', 'ip',
      'retry_after_seconds', retry_after,
      'remaining_ip', 0
    );
  end if;

  if image_used >= greatest(1, coalesce(p_image_limit, 2)) then
    select min(
      case
        when coalesce(a.live_generation, false) = true and a.status = 'succeeded'
          then a.created_at + interval '24 hours'
        when a.status = 'processing'
          and a.started_at is not null
          and a.started_at > now() - make_interval(secs => orphan_secs)
          then a.started_at + make_interval(secs => orphan_secs)
        else null
      end
    ) into oldest
    from public.pet_v2_preview_attempts a
    where a.image_hash = img
      and (
        (coalesce(a.live_generation, false) = true and a.status = 'succeeded' and a.created_at >= since)
        or (
          a.status = 'processing'
          and a.started_at is not null
          and a.started_at > now() - make_interval(secs => orphan_secs)
        )
      );
    retry_after := greatest(
      1,
      ceil(extract(epoch from (coalesce(oldest, now() + interval '1 second') - now())))::int
    );
    return jsonb_build_object(
      'action', 'quota_denied',
      'error_code', 'rate_limited',
      'failure_category', 'rate_limit',
      'rate_limit_kind', 'image',
      'retry_after_seconds', retry_after
    );
  end if;

  if row.status not in ('pending', 'failed') then
    return jsonb_build_object(
      'action', 'claim_unavailable',
      'error_code', 'claim_unavailable',
      'failure_category', 'server_error',
      'status', row.status
    );
  end if;

  update public.pet_v2_preview_attempts
  set
    status = 'processing',
    started_at = now(),
    completed_at = null,
    last_error_category = null,
    session_id = case when sess <> '' then sess else session_id end,
    ip_hash = case when iph <> '' then iph else ip_hash end,
    image_hash = case when img <> '' then img else image_hash end
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
    if row.status = 'processing' then
      return jsonb_build_object('action', 'wait', 'status', 'processing', 'started_at', row.started_at);
    end if;
    return jsonb_build_object(
      'action', 'claim_unavailable',
      'error_code', 'claim_unavailable',
      'failure_category', 'server_error'
    );
  end if;

  return jsonb_build_object(
    'action', 'create',
    'status', 'processing',
    'remaining_session', greatest(0, greatest(1, coalesce(p_session_limit, 2)) - session_used - 1),
    'remaining_ip', greatest(0, greatest(1, coalesce(p_ip_limit, 5)) - ip_used - 1)
  );
end;
$$;

revoke all on function public.begin_pet_v2_preview_create(
  text, text, text, text, text, text, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.begin_pet_v2_preview_create(
  text, text, text, text, text, text, integer, integer, integer, integer
) to service_role;

comment on function public.begin_pet_v2_preview_create(
  text, text, text, text, text, text, integer, integer, integer, integer
) is
  'Atomic V2 preview admit+create gate: advisory-locked quota (succeeded live + processing reservations), exactly one create per key, orphan_timeout on ambiguous crashes.';

create or replace function public.begin_pet_v3_preview_create(
  p_idempotency_key text,
  p_session_id text,
  p_ip_hash text,
  p_image_hash text,
  p_species text default 'dog',
  p_scene_key text default 'royal-portrait',
  p_session_limit integer default 2,
  p_ip_limit integer default 5,
  p_image_limit integer default 2,
  p_orphan_seconds integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  key text := left(btrim(coalesce(p_idempotency_key, '')), 180);
  sess text := left(btrim(coalesce(p_session_id, '')), 64);
  iph text := left(btrim(coalesce(p_ip_hash, '')), 64);
  img text := left(btrim(coalesce(p_image_hash, '')), 64);
  row public.pet_v3_preview_attempts%rowtype;
  since timestamptz := now() - interval '24 hours';
  session_used integer := 0;
  ip_used integer := 0;
  image_used integer := 0;
  oldest timestamptz;
  retry_after integer;
  orphan_secs integer := greatest(30, least(coalesce(p_orphan_seconds, 90), 600));
begin
  if length(key) < 8 then
    return jsonb_build_object('action', 'invalid', 'error_code', 'invalid_idempotency_key');
  end if;

  -- Serialize admission across session / IP / image scopes for this transaction.
  perform pg_advisory_xact_lock(hashtext('v2pv:s'), hashtext(coalesce(nullif(sess, ''), 'anon')));
  perform pg_advisory_xact_lock(hashtext('v2pv:i'), hashtext(coalesce(nullif(iph, ''), 'unknown')));
  perform pg_advisory_xact_lock(hashtext('v2pv:h'), hashtext(coalesce(nullif(img, ''), 'none')));

  select * into row
  from public.pet_v3_preview_attempts
  where idempotency_key = key
  for update;

  if not found then
    begin
      insert into public.pet_v3_preview_attempts (
        idempotency_key,
        session_id,
        ip_hash,
        image_hash,
        species,
        scene_key,
        live_generation,
        status,
        provider,
        started_at
      )
      values (
        key,
        sess,
        iph,
        img,
        left(btrim(coalesce(p_species, 'dog')), 16),
        left(btrim(coalesce(p_scene_key, 'royal-portrait')), 64),
        false,
        'pending',
        'replicate',
        now()
      )
      returning * into row;
    exception
      when unique_violation then
        select * into row
        from public.pet_v3_preview_attempts
        where idempotency_key = key
        for update;
    end;
  end if;

  if coalesce(row.prediction_id, '') <> '' then
    return jsonb_build_object(
      'action', 'resume',
      'prediction_id', row.prediction_id,
      'status', row.status,
      'live_generation', coalesce(row.live_generation, false)
    );
  end if;

  if row.status = 'succeeded' then
    return jsonb_build_object(
      'action', 'resume',
      'prediction_id', row.prediction_id,
      'status', row.status,
      'live_generation', coalesce(row.live_generation, false)
    );
  end if;

  if row.status = 'processing' then
    if row.started_at is not null
       and row.started_at > now() - make_interval(secs => orphan_secs) then
      return jsonb_build_object(
        'action', 'wait',
        'status', 'processing',
        'started_at', row.started_at
      );
    end if;
    -- Ambiguous crash after claim, before prediction_id: do not create another prediction.
    return jsonb_build_object(
      'action', 'orphan_timeout',
      'error_code', 'claim_orphan',
      'failure_category', 'server_error',
      'status', 'processing',
      'started_at', row.started_at
    );
  end if;

  -- Quota: succeeded live (24h) + active processing within orphan lease only.
  -- Expired orphans do not reserve capacity for 24h.
  select count(*)::int into session_used
  from public.pet_v3_preview_attempts a
  where a.session_id = sess
    and a.session_id <> ''
    and (
      (coalesce(a.live_generation, false) = true and a.status = 'succeeded' and a.created_at >= since)
      or (
        a.status = 'processing'
        and a.started_at is not null
        and a.started_at > now() - make_interval(secs => orphan_secs)
      )
    );

  select count(*)::int into ip_used
  from public.pet_v3_preview_attempts a
  where a.ip_hash = iph
    and a.ip_hash <> ''
    and (
      (coalesce(a.live_generation, false) = true and a.status = 'succeeded' and a.created_at >= since)
      or (
        a.status = 'processing'
        and a.started_at is not null
        and a.started_at > now() - make_interval(secs => orphan_secs)
      )
    );

  select count(*)::int into image_used
  from public.pet_v3_preview_attempts a
  where a.image_hash = img
    and a.image_hash <> ''
    and (
      (coalesce(a.live_generation, false) = true and a.status = 'succeeded' and a.created_at >= since)
      or (
        a.status = 'processing'
        and a.started_at is not null
        and a.started_at > now() - make_interval(secs => orphan_secs)
      )
    );

  if session_used >= greatest(1, coalesce(p_session_limit, 2)) then
    select min(
      case
        when coalesce(a.live_generation, false) = true and a.status = 'succeeded'
          then a.created_at + interval '24 hours'
        when a.status = 'processing'
          and a.started_at is not null
          and a.started_at > now() - make_interval(secs => orphan_secs)
          then a.started_at + make_interval(secs => orphan_secs)
        else null
      end
    ) into oldest
    from public.pet_v3_preview_attempts a
    where a.session_id = sess
      and (
        (coalesce(a.live_generation, false) = true and a.status = 'succeeded' and a.created_at >= since)
        or (
          a.status = 'processing'
          and a.started_at is not null
          and a.started_at > now() - make_interval(secs => orphan_secs)
        )
      );
    retry_after := greatest(
      1,
      ceil(extract(epoch from (coalesce(oldest, now() + interval '1 second') - now())))::int
    );
    return jsonb_build_object(
      'action', 'quota_denied',
      'error_code', 'rate_limited',
      'failure_category', 'rate_limit',
      'rate_limit_kind', 'session',
      'retry_after_seconds', retry_after,
      'remaining_session', 0
    );
  end if;

  if ip_used >= greatest(1, coalesce(p_ip_limit, 5)) then
    select min(
      case
        when coalesce(a.live_generation, false) = true and a.status = 'succeeded'
          then a.created_at + interval '24 hours'
        when a.status = 'processing'
          and a.started_at is not null
          and a.started_at > now() - make_interval(secs => orphan_secs)
          then a.started_at + make_interval(secs => orphan_secs)
        else null
      end
    ) into oldest
    from public.pet_v3_preview_attempts a
    where a.ip_hash = iph
      and (
        (coalesce(a.live_generation, false) = true and a.status = 'succeeded' and a.created_at >= since)
        or (
          a.status = 'processing'
          and a.started_at is not null
          and a.started_at > now() - make_interval(secs => orphan_secs)
        )
      );
    retry_after := greatest(
      1,
      ceil(extract(epoch from (coalesce(oldest, now() + interval '1 second') - now())))::int
    );
    return jsonb_build_object(
      'action', 'quota_denied',
      'error_code', 'rate_limited',
      'failure_category', 'rate_limit',
      'rate_limit_kind', 'ip',
      'retry_after_seconds', retry_after,
      'remaining_ip', 0
    );
  end if;

  if image_used >= greatest(1, coalesce(p_image_limit, 2)) then
    select min(
      case
        when coalesce(a.live_generation, false) = true and a.status = 'succeeded'
          then a.created_at + interval '24 hours'
        when a.status = 'processing'
          and a.started_at is not null
          and a.started_at > now() - make_interval(secs => orphan_secs)
          then a.started_at + make_interval(secs => orphan_secs)
        else null
      end
    ) into oldest
    from public.pet_v3_preview_attempts a
    where a.image_hash = img
      and (
        (coalesce(a.live_generation, false) = true and a.status = 'succeeded' and a.created_at >= since)
        or (
          a.status = 'processing'
          and a.started_at is not null
          and a.started_at > now() - make_interval(secs => orphan_secs)
        )
      );
    retry_after := greatest(
      1,
      ceil(extract(epoch from (coalesce(oldest, now() + interval '1 second') - now())))::int
    );
    return jsonb_build_object(
      'action', 'quota_denied',
      'error_code', 'rate_limited',
      'failure_category', 'rate_limit',
      'rate_limit_kind', 'image',
      'retry_after_seconds', retry_after
    );
  end if;

  if row.status not in ('pending', 'failed') then
    return jsonb_build_object(
      'action', 'claim_unavailable',
      'error_code', 'claim_unavailable',
      'failure_category', 'server_error',
      'status', row.status
    );
  end if;

  update public.pet_v3_preview_attempts
  set
    status = 'processing',
    started_at = now(),
    completed_at = null,
    last_error_category = null,
    session_id = case when sess <> '' then sess else session_id end,
    ip_hash = case when iph <> '' then iph else ip_hash end,
    image_hash = case when img <> '' then img else image_hash end
  where idempotency_key = key
    and coalesce(prediction_id, '') = ''
    and status in ('pending', 'failed')
  returning * into row;

  if not found then
    select * into row
    from public.pet_v3_preview_attempts
    where idempotency_key = key;
    if coalesce(row.prediction_id, '') <> '' then
      return jsonb_build_object(
        'action', 'resume',
        'prediction_id', row.prediction_id,
        'status', row.status,
        'live_generation', coalesce(row.live_generation, false)
      );
    end if;
    if row.status = 'processing' then
      return jsonb_build_object('action', 'wait', 'status', 'processing', 'started_at', row.started_at);
    end if;
    return jsonb_build_object(
      'action', 'claim_unavailable',
      'error_code', 'claim_unavailable',
      'failure_category', 'server_error'
    );
  end if;

  return jsonb_build_object(
    'action', 'create',
    'status', 'processing',
    'remaining_session', greatest(0, greatest(1, coalesce(p_session_limit, 2)) - session_used - 1),
    'remaining_ip', greatest(0, greatest(1, coalesce(p_ip_limit, 5)) - ip_used - 1)
  );
end;
$$;

revoke all on function public.begin_pet_v3_preview_create(
  text, text, text, text, text, text, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.begin_pet_v3_preview_create(
  text, text, text, text, text, text, integer, integer, integer, integer
) to service_role;

comment on function public.begin_pet_v3_preview_create(
  text, text, text, text, text, text, integer, integer, integer, integer
) is
  'Atomic V3 preview admit+create gate: advisory-locked quota (succeeded live + processing reservations), exactly one create per key, orphan_timeout on ambiguous crashes.';

-- Keep acquire_pet_v2_preview_create as a hardened thin wrapper for compatibility / tests.
create or replace function public.acquire_pet_v2_preview_create(
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  key text := left(btrim(coalesce(p_idempotency_key, '')), 180);
  row public.pet_v2_preview_attempts%rowtype;
  orphan_secs constant integer := 90;
begin
  if length(key) < 8 then
    return jsonb_build_object('action', 'invalid');
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

  if row.status = 'processing' then
    if row.started_at is not null
       and row.started_at > now() - make_interval(secs => orphan_secs) then
      return jsonb_build_object('action', 'wait', 'status', 'processing', 'started_at', row.started_at);
    end if;
    return jsonb_build_object(
      'action', 'orphan_timeout',
      'error_code', 'claim_orphan',
      'failure_category', 'server_error',
      'started_at', row.started_at
    );
  end if;

  if row.status not in ('pending', 'failed') then
    return jsonb_build_object('action', 'claim_unavailable', 'status', row.status);
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
    select * into row from public.pet_v2_preview_attempts where idempotency_key = key;
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

commit;
