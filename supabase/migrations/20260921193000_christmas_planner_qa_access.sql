-- Explicit Christmas Planner QA access.
-- This is not Stripe fulfillment: it never inserts an order and never marks a payment paid.
-- Execute only with the service role, for a real auth user, with a written reason.

create or replace function public.get_christmas_planner_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid;
  season integer;
  features text[] := array[]::text[];
  package_keys text[] := array[]::text[];
  payment_fulfilled boolean := false;
  qa_grant boolean := false;
  access_source text := 'free';
begin
  uid := auth.uid();
  if uid is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_authenticated',
      'features', '[]'::jsonb,
      'payment_fulfilled', false,
      'access_source', 'free'
    );
  end if;

  season := public.christmas_planner_season_year(now());

  select coalesce(array_agg(distinct feat), array[]::text[])
  into features
  from public.user_entitlements e
  cross join lateral unnest(public.map_planner_entitlement_to_features(e.entitlement_key)) as feat
  where e.status = 'active'
    and (e.expires_at is null or e.expires_at > now())
    and e.season_year = season
    and e.user_id = uid
    and feat is not null;

  select coalesce(array_agg(distinct e.tier), array[]::text[])
  into package_keys
  from public.user_entitlements e
  where e.status = 'active'
    and (e.expires_at is null or e.expires_at > now())
    and e.season_year = season
    and e.user_id = uid
    and e.tier is not null
    and e.tier <> '';

  select exists (
    select 1
    from public.user_entitlements e
    join public.christmas_orders o on o.id = e.christmas_order_id
    where e.user_id = uid
      and e.status = 'active'
      and e.season_year = season
      and (e.expires_at is null or e.expires_at > now())
      and o.payment_status = 'paid'
      and o.refunded_at is null
  ) into payment_fulfilled;

  select exists (
    select 1
    from public.user_entitlements e
    where e.user_id = uid
      and e.status = 'active'
      and e.season_year = season
      and e.christmas_order_id is null
      and e.source = 'admin'
      and coalesce(e.metadata->>'qa', '') = 'true'
  ) into qa_grant;

  access_source := case
    when payment_fulfilled then 'stripe'
    when qa_grant then 'qa_grant'
    when coalesce(cardinality(features), 0) > 0 then 'admin'
    else 'free'
  end;

  return jsonb_build_object(
    'ok', true,
    'season_year', season,
    'features', to_jsonb(coalesce(features, array[]::text[])),
    'package_keys', to_jsonb(coalesce(package_keys, array[]::text[])),
    'paid', coalesce(cardinality(features), 0) > 0,
    'payment_fulfilled', payment_fulfilled,
    'access_source', access_source
  );
end;
$$;

revoke all on function public.get_christmas_planner_access() from public, anon;
grant execute on function public.get_christmas_planner_access() to authenticated;

create or replace function public.grant_christmas_planner_qa_access(
  p_user_id uuid,
  p_reason text,
  p_season_year integer default 2026
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  keys text[] := array[
    'planner.plan',
    'planner.gifts',
    'planner.budget',
    'planner.meals',
    'planner.recipes_collection',
    'planner.hosting',
    'planner.travel',
    'planner.rescue_mode',
    'planner.premium_content'
  ];
  key text;
  granted integer := 0;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_user');
  end if;
  if length(trim(coalesce(p_reason, ''))) < 12 then
    return jsonb_build_object('ok', false, 'reason', 'reason_required');
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    return jsonb_build_object('ok', false, 'reason', 'user_not_found');
  end if;

  foreach key in array keys
  loop
    insert into public.user_entitlements (
      user_id, product_key, entitlement_key, tier, season_year,
      status, source, christmas_order_id, metadata
    )
    select
      p_user_id,
      'christmas_planner_2026',
      key,
      'founding_pass',
      coalesce(p_season_year, 2026),
      'active',
      'admin',
      null,
      jsonb_build_object(
        'qa', true,
        'payment_fulfilled', false,
        'reason', left(trim(p_reason), 240)
      )
    where not exists (
      select 1
      from public.user_entitlements existing
      where existing.user_id = p_user_id
        and existing.entitlement_key = key
        and existing.season_year = coalesce(p_season_year, 2026)
        and existing.status = 'active'
    );
    if found then
      granted := granted + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'access_source', 'qa_grant',
    'payment_fulfilled', false,
    'granted', granted,
    'user_id', p_user_id
  );
end;
$$;

revoke all on function public.grant_christmas_planner_qa_access(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.grant_christmas_planner_qa_access(uuid, text, integer) to service_role;

create or replace function public.revoke_christmas_planner_qa_access(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
begin
  update public.user_entitlements
  set status = 'revoked', updated_at = now()
  where user_id = p_user_id
    and status = 'active'
    and source = 'admin'
    and christmas_order_id is null
    and coalesce(metadata->>'qa', '') = 'true';
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'revoked', n, 'payment_rows_touched', 0);
end;
$$;

revoke all on function public.revoke_christmas_planner_qa_access(uuid) from public, anon, authenticated;
grant execute on function public.revoke_christmas_planner_qa_access(uuid) to service_role;

-- Free gift-people cap applies to new rows only. Existing people are kept.
-- Household is the gift-shopping list and does not consume a gift-person place.
create or replace function public.christmas_planner_enforce_free_recipient_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  people integer;
  entitled boolean;
  season integer;
begin
  if lower(trim(new.display_name)) = 'household' then
    return new;
  end if;

  season := public.christmas_planner_season_year(now());

  select exists (
    select 1
    from public.christmas_planner_profiles p
    join public.user_entitlements e on e.user_id = p.user_id
    where p.id = new.profile_id
      and e.status = 'active'
      and e.season_year = season
      and (e.expires_at is null or e.expires_at > now())
      and 'gift_planner' = any (public.map_planner_entitlement_to_features(e.entitlement_key))
  ) into entitled;

  if entitled then
    return new;
  end if;

  select count(*) into people
  from public.christmas_gift_recipients
  where profile_id = new.profile_id
    and lower(trim(display_name)) <> 'household';

  if people >= 3 then
    raise exception 'free_recipient_limit'
      using errcode = 'P0001',
            hint = 'Existing gift people are kept. Christmas Planner removes the cap.';
  end if;

  return new;
end;
$$;

drop trigger if exists christmas_gift_recipients_free_cap on public.christmas_gift_recipients;
create trigger christmas_gift_recipients_free_cap
before insert on public.christmas_gift_recipients
for each row execute function public.christmas_planner_enforce_free_recipient_cap();
