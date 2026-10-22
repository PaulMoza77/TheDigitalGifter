-- Isolated assertions for platform privilege / RLS harden.
-- Run against a disposable schema clone — NEVER against production customer data.
-- Expected companion migration: 20261012120000_platform_security_admin_and_rls.sql

\echo '=== platform security iso ==='

-- 1) is_admin ignores profiles.role
do $$
declare
  def text;
begin
  select pg_get_functiondef('public.is_admin()'::regprocedure) into def;
  if def is null then
    raise exception 'FAIL is_admin_missing';
  end if;
  if position('admin_users' in def) = 0 then
    raise exception 'FAIL is_admin_missing_admin_users';
  end if;
  if position('p.role' in def) > 0 or position('profiles p' in def) > 0 then
    raise exception 'FAIL is_admin_still_trusts_profiles_role';
  end if;
  raise notice 'PASS is_admin_admin_users_only';
end $$;

-- 2) role escalation trigger present
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'profiles_prevent_role_escalation'
  ) then
    raise exception 'FAIL profiles_role_trigger_missing';
  end if;
  raise notice 'PASS profiles_role_trigger';
end $$;

-- 3) christmas_v2 RLS enabled + admin-only policies
do $$
declare
  t text;
  tables text[] := array[
    'christmas_v2_orders',
    'christmas_v2_order_scenes',
    'christmas_v2_order_videos',
    'christmas_v2_generation_jobs',
    'christmas_v2_checkout_sessions',
    'christmas_v2_email_deliveries',
    'christmas_v2_funnel_events'
  ];
  rls boolean;
begin
  foreach t in array tables loop
    if to_regclass(format('public.%I', t)) is null then
      raise notice 'SKIP % missing', t;
      continue;
    end if;
    select c.relrowsecurity into rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = t;
    if rls is not true then
      raise exception 'FAIL rls_disabled_%', t;
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = t || '_admin_read'
    ) then
      raise exception 'FAIL missing_admin_read_%', t;
    end if;
  end loop;
  raise notice 'PASS christmas_v2_rls_admin_read';
end $$;

\echo '=== platform security iso done ==='
