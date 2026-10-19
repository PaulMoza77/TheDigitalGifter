-- Isolated JWT/RLS proofs for admin role-escalation hotfix.
-- NEVER run against production. Synthetic users only.
-- Companion: supabase/migrations/20261012130000_hotfix_admin_role_escalation.sql
--
-- Expected: all sections raise NOTICE 'PASS ...' and exit 0.

\set ON_ERROR_STOP on
\echo '=== admin role escalation iso proof ==='

create extension if not exists pgcrypto;

-- Roles used by Supabase-style RLS
do $$ begin
  create role anon nologin;
exception when duplicate_object then null;
end $$;
do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null;
end $$;
do $$ begin
  create role service_role nologin bypassrls;
exception when duplicate_object then null;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- Minimal auth stubs (JWT claim simulation)
create schema if not exists auth;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'sub', current_setting('request.jwt.claim.sub', true),
    'email', current_setting('request.jwt.claim.email', true),
    'role', current_setting('request.jwt.claim.role', true),
    'app_metadata', jsonb_build_object(
      'role', current_setting('request.jwt.claim.app_role', true)
    )
  );
$$;

-- Representative pre-hotfix schema
drop table if exists public.christmas_v2_orders cascade;
drop table if exists public.orders_protected cascade;
drop table if exists public.profiles cascade;
drop table if exists public.admin_users cascade;

create table public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key,
  email text,
  role text default 'user',
  is_volocar_admin boolean default false,
  display_name text
);

create table public.orders_protected (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  payload text not null
);

create table public.christmas_v2_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_email text,
  amount_cents int,
  media_url text
);

alter table public.admin_users enable row level security;
alter table public.profiles enable row level security;
alter table public.orders_protected enable row level security;
alter table public.christmas_v2_orders enable row level security;

create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- Vulnerable production-shaped is_admin (pre-hotfix)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where lower(au.email) = public.current_user_email()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

grant execute on function public.current_user_email() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;

grant select on table public.admin_users to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select on table public.orders_protected to authenticated;
grant select on table public.christmas_v2_orders to authenticated;

create policy admin_users_self_read on public.admin_users
  for select to authenticated
  using (
    public.is_admin()
    or (public.current_user_email() <> '' and lower(email) = public.current_user_email())
  );

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_upsert on public.profiles
  for all to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy orders_protected_select on public.orders_protected
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy christmas_v2_orders_admin_read on public.christmas_v2_orders
  for select to authenticated, anon
  using (public.is_admin());

-- Synthetic fixtures
do $$
declare
  admin_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  user_a uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  user_b uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
begin
  insert into public.admin_users(email) values ('admin@example.test');
  insert into public.profiles(id, email, role, display_name) values
    (admin_id, 'admin@example.test', 'admin', 'Admin'),
    (user_a, 'usera@example.test', 'user', 'User A'),
    (user_b, 'userb@example.test', 'user', 'User B');
  insert into public.orders_protected(user_id, payload) values
    (user_b, 'user-b-secret-order'),
    (admin_id, 'admin-order');
  insert into public.christmas_v2_orders(buyer_email, amount_cents, media_url) values
    ('userb@example.test', 2700, 'https://example.test/media/private.mp4');
end $$;

-- Helper: set JWT claims for a synthetic principal.
-- Does NOT call set_config('role') — that GUC is SET ROLE and would sticky-switch
-- the SQL session away from the table owner mid-script.
create or replace function public._iso_set_jwt(p_sub uuid, p_email text, p_role text default 'authenticated', p_app_role text default '')
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_sub::text, ''), true);
  perform set_config('request.jwt.claim.email', coalesce(p_email, ''), true);
  perform set_config('request.jwt.claim.role', coalesce(p_role, 'authenticated'), true);
  perform set_config('request.jwt.claim.app_role', coalesce(p_app_role, ''), true);
end;
$$;

-- ---------------------------------------------------------------------------
-- PRE-PROOF: vulnerable path allows self-promotion (documents the bug)
-- ---------------------------------------------------------------------------
do $$
declare
  became boolean;
  can_read boolean;
begin
  perform public._iso_set_jwt(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'usera@example.test',
    'authenticated',
    'admin' -- forged app_metadata.role must not matter
  );
  set local role authenticated;

  update public.profiles
    set role = 'admin'
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

  select public.is_admin() into became;
  if became is not true then
    raise exception 'PREFAIL expected_vulnerable_self_promote';
  end if;

  select exists(
    select 1 from public.orders_protected where payload = 'user-b-secret-order'
  ) into can_read;
  if can_read is not true then
    raise exception 'PREFAIL expected_vulnerable_cross_user_read';
  end if;

  select exists(
    select 1 from public.christmas_v2_orders
  ) into can_read;
  if can_read is not true then
    raise exception 'PREFAIL expected_vulnerable_christmas_read';
  end if;

  reset role;
  -- restore user A to non-admin for post-fix proofs
  update public.profiles
    set role = 'user'
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

  raise notice 'PASS pre_vulnerable_escalation_reproduced';
end $$;

-- ---------------------------------------------------------------------------
-- APPLY HOTFIX MIGRATION (inline equivalent of 20261012130000)
-- ---------------------------------------------------------------------------
\i supabase/migrations/20261012130000_hotfix_admin_role_escalation.sql

-- Re-apply migration (idempotency / repeated grants)
\i supabase/migrations/20261012130000_hotfix_admin_role_escalation.sql

-- ---------------------------------------------------------------------------
-- POST proofs
-- ---------------------------------------------------------------------------

-- 1) User A cannot promote itself via UPDATE
do $$
begin
  perform public._iso_set_jwt(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'usera@example.test'
  );
  set local role authenticated;
  begin
    update public.profiles
      set role = 'admin'
      where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
    raise exception 'FAIL user_a_self_promote_update';
  exception
    when others then
      if sqlerrm like '%immutable%' or sqlerrm like '%cannot be set%' or sqlerrm like '%permission denied%' then
        raise notice 'PASS 1_user_a_cannot_self_promote_update (%)', sqlerrm;
      else
        raise;
      end if;
  end;
  reset role;
end $$;

-- 2) User A cannot become admin via INSERT/UPSERT
do $$
declare
  new_id uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
begin
  perform public._iso_set_jwt(new_id, 'usera-insert@example.test');
  set local role authenticated;
  begin
    insert into public.profiles(id, email, role)
    values (new_id, 'usera-insert@example.test', 'admin');
    raise exception 'FAIL user_a_insert_admin_role';
  exception
    when others then
      if sqlerrm like '%cannot be set%' or sqlerrm like '%permission denied%' then
        raise notice 'PASS 2_user_a_cannot_insert_admin_role (%)', sqlerrm;
      else
        raise;
      end if;
  end;

  -- legitimate upsert with role=user / default must work
  insert into public.profiles(id, email, role, display_name)
  values (new_id, 'usera-insert@example.test', 'user', 'Inserted')
  on conflict (id) do update set display_name = excluded.display_name;

  if not exists (select 1 from public.profiles where id = new_id and role = 'user') then
    raise exception 'FAIL legitimate_insert_broken';
  end if;
  raise notice 'PASS 2b_legitimate_insert_user_role';
  reset role;
end $$;

-- 3) User A cannot modify admin_users
do $$
begin
  perform public._iso_set_jwt(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'usera@example.test'
  );
  set local role authenticated;
  begin
    insert into public.admin_users(email) values ('usera@example.test');
    raise exception 'FAIL user_a_insert_admin_users';
  exception
    when insufficient_privilege then
      raise notice 'PASS 3_user_a_cannot_insert_admin_users';
    when others then
      if sqlerrm like '%permission denied%' then
        raise notice 'PASS 3_user_a_cannot_insert_admin_users (%)', sqlerrm;
      else
        raise;
      end if;
  end;
  begin
    delete from public.admin_users where email = 'admin@example.test';
    raise exception 'FAIL user_a_delete_admin_users';
  exception
    when insufficient_privilege then
      raise notice 'PASS 3b_user_a_cannot_delete_admin_users';
    when others then
      if sqlerrm like '%permission denied%' then
        raise notice 'PASS 3b_user_a_cannot_delete_admin_users (%)', sqlerrm;
      else
        raise;
      end if;
  end;
  reset role;
end $$;

-- 4) Forged JWT app_metadata.role does not grant is_admin
do $$
declare
  adminish boolean;
begin
  perform public._iso_set_jwt(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'usera@example.test',
    'authenticated',
    'admin'
  );
  set local role authenticated;
  select public.is_admin() into adminish;
  if adminish then
    raise exception 'FAIL forged_app_metadata_role_grants_admin';
  end if;
  raise notice 'PASS 4_forged_jwt_app_role_ignored';
  reset role;
end $$;

-- 5) User A cannot SELECT user B protected data
do $$
declare
  n int;
begin
  perform public._iso_set_jwt(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'usera@example.test'
  );
  set local role authenticated;
  select count(*) into n from public.orders_protected where payload = 'user-b-secret-order';
  if n <> 0 then
    raise exception 'FAIL user_a_read_user_b_orders';
  end if;
  raise notice 'PASS 5_user_a_cannot_read_user_b_protected';
  reset role;
end $$;

-- 6) User A cannot read christmas_v2 ledger via RLS
do $$
declare
  n int;
begin
  perform public._iso_set_jwt(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'usera@example.test'
  );
  set local role authenticated;
  select count(*) into n from public.christmas_v2_orders;
  if n <> 0 then
    raise exception 'FAIL user_a_read_christmas_v2';
  end if;
  raise notice 'PASS 6_user_a_cannot_read_christmas_v2';
  reset role;
end $$;

-- 7) Normal profile updates still work
do $$
begin
  perform public._iso_set_jwt(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'usera@example.test'
  );
  set local role authenticated;
  update public.profiles
    set display_name = 'User A Updated'
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
  if not exists (
    select 1 from public.profiles
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
      and display_name = 'User A Updated'
      and role = 'user'
  ) then
    raise exception 'FAIL normal_profile_update';
  end if;
  raise notice 'PASS 7_normal_profile_update';
  reset role;
end $$;

-- 8) Legitimate admin retains access
do $$
declare
  n int;
  adminish boolean;
begin
  perform public._iso_set_jwt(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'admin@example.test'
  );
  set local role authenticated;
  select public.is_admin() into adminish;
  if adminish is not true then
    raise exception 'FAIL legitimate_admin_is_admin';
  end if;
  select count(*) into n from public.orders_protected;
  if n < 2 then
    raise exception 'FAIL legitimate_admin_orders_read';
  end if;
  select count(*) into n from public.christmas_v2_orders;
  if n < 1 then
    raise exception 'FAIL legitimate_admin_christmas_read';
  end if;
  raise notice 'PASS 8_legitimate_admin_access';
  reset role;
end $$;

-- 9) Admin removal revokes access (profiles.role leftover must not restore admin)
do $$
declare
  adminish boolean;
  n int;
begin
  delete from public.admin_users where email = 'admin@example.test';
  -- Owner/service path may leave profiles.role='admin'; clients cannot.
  update public.profiles
    set role = 'admin'
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

  perform public._iso_set_jwt(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'admin@example.test'
  );
  set local role authenticated;
  select public.is_admin() into adminish;
  if adminish then
    raise exception 'FAIL admin_removal_still_admin_via_profiles_role';
  end if;
  select count(*) into n from public.christmas_v2_orders;
  if n <> 0 then
    raise exception 'FAIL admin_removal_still_reads_christmas';
  end if;
  raise notice 'PASS 9_admin_removal_revokes_access';
  reset role;

  -- restore admin fixture for remaining checks
  insert into public.admin_users(email) values ('admin@example.test');
  update public.profiles
    set role = 'admin'
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
end $$;

-- 10/11) Function definition + grants sanity after repeated migration
do $$
declare
  def text;
begin
  select pg_get_functiondef('public.is_admin()'::regprocedure) into def;
  if position('admin_users' in def) = 0 then
    raise exception 'FAIL is_admin_missing_admin_users';
  end if;
  if position('p.role' in def) > 0 or position('profiles p' in def) > 0 then
    raise exception 'FAIL is_admin_still_trusts_profiles_role';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'profiles_prevent_role_escalation'
  ) then
    raise exception 'FAIL trigger_missing';
  end if;
  raise notice 'PASS 10_11_migration_idempotent_definition';
end $$;

-- 12) anon/authenticated/public permission surface
do $$
declare
  has_write boolean;
begin
  select exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'admin_users'
      and grantee in ('anon', 'authenticated', 'public')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ) into has_write;
  if has_write then
    raise exception 'FAIL admin_users_client_write_grant';
  end if;

  select exists (
    select 1
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
      and grantee in ('anon', 'authenticated', 'public')
      and privilege_type = 'UPDATE'
  ) into has_write;
  if has_write then
    raise exception 'FAIL profiles_role_client_update_grant';
  end if;

  raise notice 'PASS 12_client_grants_correct';
end $$;

\echo '=== admin role escalation iso proof DONE ==='
