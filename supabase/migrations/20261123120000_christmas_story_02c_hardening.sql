-- Mission 02C hardening for Christmas Story durable orders.
-- Apply only to isolated test/staging. Do NOT apply to production without authorization.

begin;

-- Ensure transition helper is not executable by browser roles
revoke all on function public.christmas_story_assert_transition(text, text) from public, anon, authenticated;
grant execute on function public.christmas_story_assert_transition(text, text) to service_role;

-- Reaffirm SECURITY DEFINER RPCs are service_role-only
revoke all on function public.christmas_story_transition_order(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.christmas_story_transition_order(uuid, text, text, jsonb) to service_role;
revoke all on function public.christmas_story_fulfill_payment(uuid, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.christmas_story_fulfill_payment(uuid, text, text, integer, text, text) to service_role;

-- Owner select must never expose token hashes via a view; keep column grants tight
revoke select (buyer_access_token_hash) on public.christmas_story_orders from authenticated;
revoke select (buyer_access_token_hash) on public.christmas_story_drafts from authenticated;
revoke all on public.christmas_story_access_grants from authenticated, anon, public;
revoke all on public.christmas_story_audit_events from authenticated, anon, public;

-- Explicit deny: no public storage object policies for story buckets
drop policy if exists christmas_story_source_public on storage.objects;
drop policy if exists christmas_story_generated_public on storage.objects;
drop policy if exists christmas_story_source_anon_read on storage.objects;
drop policy if exists christmas_story_generated_anon_read on storage.objects;

-- Recovery challenge table (email magic link / code) — hash-at-rest only
create table if not exists public.christmas_story_recovery_challenges (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_story_orders (id) on delete cascade,
  email_hash text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint christmas_story_recovery_hashes_chk check (
    length(email_hash) = 64 and length(token_hash) = 64
  )
);

create index if not exists christmas_story_recovery_order_idx
  on public.christmas_story_recovery_challenges (order_id, created_at desc);

alter table public.christmas_story_recovery_challenges enable row level security;
revoke all on table public.christmas_story_recovery_challenges from anon, authenticated, public;
grant all on table public.christmas_story_recovery_challenges to service_role;

-- Checkout expiry helper (service_role only)
create or replace function public.christmas_story_expire_checkout(
  p_order_id uuid,
  p_actor text default 'system'
) returns public.christmas_story_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.christmas_story_orders;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required';
  end if;

  select * into v_order from public.christmas_story_orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.payment_status = 'paid' then
    return v_order;
  end if;

  if v_order.status is distinct from 'CHECKOUT_PENDING' then
    return v_order;
  end if;

  update public.christmas_story_orders
  set
    payment_status = 'expired',
    status = 'FAILED',
    failed_reason = coalesce(failed_reason, 'checkout_expired'),
    updated_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into public.christmas_story_audit_events (order_id, event_name, actor_kind, metadata)
  values (
    p_order_id,
    'checkout_expired',
    coalesce(nullif(p_actor, ''), 'system'),
    '{}'::jsonb
  );

  return v_order;
end;
$$;

revoke all on function public.christmas_story_expire_checkout(uuid, text) from public, anon, authenticated;
grant execute on function public.christmas_story_expire_checkout(uuid, text) to service_role;

commit;
