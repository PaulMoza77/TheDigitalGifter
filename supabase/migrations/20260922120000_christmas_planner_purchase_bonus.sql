-- Christmas Planner Founding Pass: 300 bonus AI credits on verified Stripe fulfillment.
-- Idempotent grant/revoke through credits_ledger. QA grants never receive purchase credits.

create unique index if not exists credits_ledger_planner_bonus_note_uidx
  on public.credits_ledger (note)
  where note like 'christmas_planner_purchase_bonus%';

create or replace function public.grant_christmas_planner_purchase_bonus(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.christmas_orders%rowtype;
  email_norm text;
  note_text text;
  uid uuid;
begin
  if p_order_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_order_id');
  end if;

  select * into order_row
  from public.christmas_orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'order_not_found');
  end if;

  if order_row.product_key not in ('christmas_planner_2026', 'christmas_planner')
     and order_row.product_key not like 'christmas_planner%' then
    return jsonb_build_object('ok', false, 'reason', 'not_planner');
  end if;

  if order_row.payment_status <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'not_paid');
  end if;

  if coalesce(order_row.package_key, '') <> 'founding_pass' then
    return jsonb_build_object('ok', false, 'reason', 'not_founding_pass');
  end if;

  if coalesce(order_row.metadata->>'qa', '') in ('true', '1')
     or coalesce(order_row.metadata->>'qa_grant', '') in ('true', '1') then
    return jsonb_build_object('ok', false, 'reason', 'qa_access');
  end if;

  uid := order_row.user_id;
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_user');
  end if;

  email_norm := lower(trim(coalesce(order_row.email_normalized, order_row.email, '')));
  if email_norm = '' then
    select lower(trim(coalesce(u.email, '')))
      into email_norm
    from auth.users u
    where u.id = uid;
  end if;
  if email_norm = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_email');
  end if;

  note_text := 'christmas_planner_purchase_bonus:' || order_row.id::text;

  if exists (select 1 from public.credits_ledger cl where cl.note = note_text) then
    return jsonb_build_object('ok', true, 'status', 'already_granted', 'credits', 300);
  end if;

  insert into public.credits_ledger (
    user_convex_id,
    user_id,
    direction,
    credits,
    event_type,
    category,
    amount,
    currency,
    note,
    order_convex_id,
    template_title,
    occurred_at
  ) values (
    email_norm,
    uid,
    'in',
    300,
    'christmas_planner_purchase_bonus',
    'christmas_planner_2026',
    0,
    coalesce(nullif(trim(order_row.currency), ''), 'usd'),
    note_text,
    order_row.id::text,
    'Christmas Planner 2026 Founding Pass bonus',
    now()
  );

  update public.christmas_orders
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'planner_bonus_credits_granted', 300,
    'planner_bonus_event_type', 'christmas_planner_purchase_bonus'
  )
  where id = order_row.id;

  return jsonb_build_object('ok', true, 'status', 'granted', 'credits', 300);
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'status', 'already_granted', 'credits', 300);
end;
$$;

revoke all on function public.grant_christmas_planner_purchase_bonus(uuid) from public, anon, authenticated;
grant execute on function public.grant_christmas_planner_purchase_bonus(uuid) to service_role;

create or replace function public.revoke_christmas_planner_purchase_bonus(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  grant_row public.credits_ledger%rowtype;
  email_norm text;
  bal integer;
  debit integer;
  revoke_note text;
  granted integer;
begin
  if p_order_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_order_id');
  end if;

  revoke_note := 'christmas_planner_purchase_bonus_revoke:' || p_order_id::text;

  if exists (select 1 from public.credits_ledger cl where cl.note = revoke_note) then
    return jsonb_build_object('ok', true, 'status', 'already_revoked');
  end if;

  select * into grant_row
  from public.credits_ledger
  where note = 'christmas_planner_purchase_bonus:' || p_order_id::text
  limit 1;

  if not found then
    insert into public.credits_ledger (
      user_convex_id, user_id, direction, credits, event_type, category, note, order_convex_id, template_title
    )
    select
      coalesce(o.email_normalized, o.email, ''),
      o.user_id,
      'out',
      0,
      'christmas_planner_purchase_bonus_revoke',
      'christmas_planner_2026',
      revoke_note,
      o.id::text,
      'Christmas Planner 2026 Founding Pass bonus adjustment (no grant found)'
    from public.christmas_orders o
    where o.id = p_order_id;
    return jsonb_build_object('ok', true, 'status', 'no_grant', 'debited', 0);
  end if;

  granted := greatest(0, coalesce(grant_row.credits, 0));
  email_norm := lower(trim(coalesce(grant_row.user_convex_id, '')));
  if email_norm = '' then
    bal := 0;
  else
    bal := public.app_credits_balance(email_norm);
  end if;
  debit := least(granted, greatest(0, bal));

  insert into public.credits_ledger (
    user_convex_id,
    user_id,
    direction,
    credits,
    event_type,
    category,
    note,
    order_convex_id,
    template_title,
    occurred_at
  ) values (
    grant_row.user_convex_id,
    grant_row.user_id,
    'out',
    debit,
    'christmas_planner_purchase_bonus_revoke',
    'christmas_planner_2026',
    revoke_note,
    p_order_id::text,
    'Christmas Planner 2026 Founding Pass bonus adjustment',
    now()
  );

  return jsonb_build_object('ok', true, 'status', 'revoked', 'debited', debit, 'balance_before', bal);
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'status', 'already_revoked');
end;
$$;

revoke all on function public.revoke_christmas_planner_purchase_bonus(uuid) from public, anon, authenticated;
grant execute on function public.revoke_christmas_planner_purchase_bonus(uuid) to service_role;

create or replace function public.refund_christmas_planner_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated integer;
  bonus jsonb;
begin
  update public.christmas_orders
  set
    payment_status = 'refunded',
    refunded_at = coalesce(refunded_at, now()),
    updated_at = now()
  where id = p_order_id
    and (
      product_key = 'christmas_planner_2026'
      or product_key = 'christmas_planner'
      or product_key like 'christmas_planner%'
    );
  get diagnostics updated = row_count;

  perform public.revoke_christmas_planner_entitlements(p_order_id);
  bonus := public.revoke_christmas_planner_purchase_bonus(p_order_id);

  return jsonb_build_object('ok', true, 'matched', updated > 0, 'bonus', bonus);
end;
$$;

revoke all on function public.refund_christmas_planner_order(uuid) from public, anon, authenticated;
grant execute on function public.refund_christmas_planner_order(uuid) to service_role;

create or replace function public.claim_christmas_planner_order(
  p_user_id uuid,
  p_public_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.christmas_orders%rowtype;
  already boolean;
begin
  if p_user_id is null or length(trim(coalesce(p_public_token_hash, ''))) < 16 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_claim');
  end if;

  select * into order_row
  from public.christmas_orders
  where public_token_hash = p_public_token_hash
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'order_not_found');
  end if;

  if order_row.payment_status <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'not_paid');
  end if;

  if order_row.user_id is not null and order_row.user_id <> p_user_id then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed');
  end if;

  already := order_row.user_id = p_user_id;

  update public.christmas_orders
  set user_id = p_user_id
  where id = order_row.id
    and (user_id is null or user_id = p_user_id);

  update public.user_entitlements e
  set user_id = p_user_id
  where e.christmas_order_id = order_row.id
    and (e.user_id is null or e.user_id = p_user_id)
    and not exists (
      select 1
      from public.user_entitlements other
      where other.user_id = p_user_id
        and other.entitlement_key = e.entitlement_key
        and other.season_year = e.season_year
        and other.status = 'active'
        and other.id <> e.id
    );

  perform public.grant_christmas_planner_purchase_bonus(order_row.id);

  return jsonb_build_object(
    'ok', true,
    'order_id', order_row.id,
    'already', already,
    'product_key', order_row.product_key,
    'package_key', order_row.package_key
  );
end;
$$;

revoke all on function public.claim_christmas_planner_order(uuid, text)
  from anon, authenticated, public;
grant execute on function public.claim_christmas_planner_order(uuid, text)
  to service_role;
