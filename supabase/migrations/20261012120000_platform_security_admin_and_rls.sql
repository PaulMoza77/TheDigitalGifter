-- Platform security harden (additive):
-- 1) Stop treating client-writable profiles.role as admin authority.
-- 2) Freeze profiles.role escalation for non–admin_users callers.
-- 3) Ensure christmas_v2_* tables have RLS + admin-only SELECT policies in-repo.
-- Does NOT write to production until applied by operators.

-- ---------------------------------------------------------------------------
-- is_admin(): admin_users allowlist ONLY (profiles.role is no longer trusted)
-- ---------------------------------------------------------------------------
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
  );
$$;

comment on function public.is_admin() is
  'True only when auth email is listed in public.admin_users. profiles.role is intentionally ignored.';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Freeze profiles.role changes unless caller is already an allowlisted admin
-- or the session is service_role / postgres.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  session_role text := coalesce(current_setting('role', true), '');
begin
  if tg_op = 'INSERT' then
    if coalesce(new.role, '') = '' or lower(coalesce(new.role, '')) = 'user' then
      new.role := coalesce(nullif(new.role, ''), 'user');
      return new;
    end if;
    if lower(coalesce(new.role, '')) = 'admin'
       and not public.is_admin()
       and jwt_role is distinct from 'service_role'
       and session_role not in ('service_role', 'supabase_admin', 'postgres') then
      raise exception 'profiles.role cannot be set to admin by clients';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    if not public.is_admin()
       and jwt_role is distinct from 'service_role'
       and session_role not in ('service_role', 'supabase_admin', 'postgres') then
      raise exception 'profiles.role is immutable for non-admin callers';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
  before insert or update on public.profiles
  for each row
  execute function public.profiles_prevent_role_escalation();

-- ---------------------------------------------------------------------------
-- christmas_v2_* RLS parity (idempotent): enable + admin-only SELECT
-- ---------------------------------------------------------------------------
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
begin
  foreach t in array tables loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    -- Drop permissive policies if any were added outside migrations.
    -- Keep/create single admin-read policy.
    begin
      execute format('drop policy if exists %I on public.%I', t || '_admin_read', t);
    exception when undefined_object then null;
    end;
    execute format(
      'create policy %I on public.%I for select to authenticated, anon using (public.is_admin())',
      t || '_admin_read',
      t
    );
    -- Authenticated SELECT grant is OK with admin-only RLS; revoke writes from clients.
    execute format('revoke insert, update, delete on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('revoke all on table public.%I from anon', t);
  end loop;
end $$;
