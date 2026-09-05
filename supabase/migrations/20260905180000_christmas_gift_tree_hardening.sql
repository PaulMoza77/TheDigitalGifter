-- Gift Tree hardening: identity-scoped spend (no email OR-steal), reserve helper.
-- Additive / replace-function only. Safe to re-run.

begin;

-- Remaining opens: prefer a single identity (user > guest > email), never OR them together.
create or replace function public.christmas_gift_tree_remaining_opens(
  p_season_year int,
  p_user_id uuid default null,
  p_guest_token_hash text default null,
  p_email_normalized text default null
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(greatest(opens_granted - opens_consumed, 0)), 0)::int
  from public.christmas_gift_tree_opens
  where season_year = p_season_year
    and case
      when p_user_id is not null then user_id = p_user_id
      when p_guest_token_hash is not null and length(trim(p_guest_token_hash)) > 0
        then guest_token_hash = p_guest_token_hash
      when p_email_normalized is not null and length(trim(p_email_normalized)) > 0
        then email_normalized = lower(trim(p_email_normalized))
      else false
    end;
$$;

revoke all on function public.christmas_gift_tree_remaining_opens(int, uuid, text, text) from public;
grant execute on function public.christmas_gift_tree_remaining_opens(int, uuid, text, text) to service_role;

-- Consume one open under a single identity + advisory lock to reduce double-spend races.
create or replace function public.christmas_gift_tree_consume_open(
  p_season_year int,
  p_user_id uuid default null,
  p_guest_token_hash text default null,
  p_email_normalized text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id uuid;
  remaining int;
  lock_key text;
begin
  lock_key := coalesce(
    p_user_id::text,
    nullif(trim(coalesce(p_guest_token_hash, '')), ''),
    lower(nullif(trim(coalesce(p_email_normalized, '')), ''))
  );
  if lock_key is null then
    return jsonb_build_object('ok', false, 'reason', 'identity_required');
  end if;

  perform pg_advisory_xact_lock(8712345, hashtext(lock_key));

  select id into row_id
  from public.christmas_gift_tree_opens
  where season_year = p_season_year
    and opens_consumed < opens_granted
    and case
      when p_user_id is not null then user_id = p_user_id
      when p_guest_token_hash is not null and length(trim(p_guest_token_hash)) > 0
        then guest_token_hash = p_guest_token_hash
      when p_email_normalized is not null and length(trim(p_email_normalized)) > 0
        then email_normalized = lower(trim(p_email_normalized))
      else false
    end
  order by created_at asc
  for update skip locked
  limit 1;

  if row_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_opens_remaining');
  end if;

  update public.christmas_gift_tree_opens
  set opens_consumed = opens_consumed + 1,
      updated_at = now()
  where id = row_id
    and opens_consumed < opens_granted;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'race_lost');
  end if;

  remaining := public.christmas_gift_tree_remaining_opens(
    p_season_year, p_user_id, p_guest_token_hash, p_email_normalized
  );

  return jsonb_build_object(
    'ok', true,
    'consumed_row_id', row_id,
    'remaining_opens', remaining
  );
end;
$$;

revoke all on function public.christmas_gift_tree_consume_open(int, uuid, text, text) from public;
grant execute on function public.christmas_gift_tree_consume_open(int, uuid, text, text) to service_role;

commit;
