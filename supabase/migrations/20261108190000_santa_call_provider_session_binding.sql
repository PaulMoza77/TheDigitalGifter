-- Bind an OpenAI Realtime call ID to exactly one authenticated active TDG session.
-- The provider call ID is later used by the trusted edge function to terminate billing.
create or replace function public.bind_christmas_santa_call_provider_session(
  p_session_id uuid,
  p_access_token_hash text,
  p_provider_session_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sess public.christmas_santa_call_sessions%rowtype;
  ent public.christmas_santa_call_entitlements%rowtype;
begin
  if p_provider_session_id !~ '^rtc_[A-Za-z0-9_-]{8,200}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_provider_session');
  end if;

  select * into sess
  from public.christmas_santa_call_sessions
  where id = p_session_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'missing_session');
  end if;

  select * into ent
  from public.christmas_santa_call_entitlements
  where id = sess.entitlement_id
    and access_token_hash = lower(trim(p_access_token_hash));
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;
  if sess.provider <> 'openai_realtime' then
    return jsonb_build_object('ok', false, 'code', 'invalid_provider');
  end if;
  if sess.status not in ('connecting', 'connected', 'listening', 'speaking', 'reconnecting') then
    return jsonb_build_object('ok', false, 'code', 'session_closed');
  end if;
  if sess.provider_session_id is not null and sess.provider_session_id <> p_provider_session_id then
    return jsonb_build_object('ok', false, 'code', 'provider_session_already_bound');
  end if;

  update public.christmas_santa_call_sessions
  set provider_session_id = p_provider_session_id, updated_at = now()
  where id = sess.id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.bind_christmas_santa_call_provider_session(uuid, text, text)
  from anon, authenticated, public;
grant execute on function public.bind_christmas_santa_call_provider_session(uuid, text, text)
  to service_role;
