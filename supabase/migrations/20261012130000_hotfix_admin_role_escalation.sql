-- Hotfix: admin privilege escalation via client-writable profiles.role
-- ============================================================================
-- Standalone. No Christmas V2 schema dependency.
-- Safe to apply to production mainline independently of unreleased funnels.
--
-- Changes:
-- 1) is_admin() trusts public.admin_users allowlist ONLY.
-- 2) BEFORE INSERT/UPDATE trigger blocks non-allowlisted role escalation.
-- 3) Column privileges: authenticated cannot UPDATE privilege columns
--    (INSERT of role='user' remains; trigger blocks privilege values).
--
-- Compatibility:
-- - Legitimate admins remain those listed in public.admin_users (email match).
-- - Aggregate precheck: profiles with role='admin' but not in admin_users should be 0
--   before apply; if non-zero, add allowlist rows first (do not delete accounts).
-- - Frontend must stop preferring profiles.role (see useAdminAuth).
--
-- Rollback implications:
-- - Do NOT blindly restore the profiles.role OR-branch in is_admin().
-- - If emergency rollback is required, keep the trigger and column revokes;
--   only restore is_admin()'s admin_users branch semantics under incident lead approval.
-- - Re-granting UPDATE(role) to authenticated re-opens the escalation path.

-- ---------------------------------------------------------------------------
-- is_admin(): admin_users allowlist ONLY
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
-- Defense-in-depth: freeze privilege-bearing profile columns for clients
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
  privileged boolean := false;
begin
  -- service_role / postgres / supabase_admin may manage privilege columns.
  if jwt_role = 'service_role'
     or session_role in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;

  -- Already-allowlisted admins may adjust privilege columns (rare ops path).
  -- Uses the NEW is_admin() (admin_users only), so self-promotion cannot pass.
  privileged := public.is_admin();

  if tg_op = 'INSERT' then
    if coalesce(new.role, '') = '' then
      new.role := 'user';
    end if;

    if lower(coalesce(new.role, '')) = 'admin' and not privileged then
      raise exception 'profiles.role cannot be set to admin by clients';
    end if;

    if to_jsonb(new) ? 'is_volocar_admin'
       and coalesce((to_jsonb(new) ->> 'is_volocar_admin')::boolean, false)
       and not privileged then
      raise exception 'profiles.is_volocar_admin cannot be set by clients';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role and not privileged then
      raise exception 'profiles.role is immutable for non-admin callers';
    end if;

    if to_jsonb(new) ? 'is_volocar_admin'
       and to_jsonb(old) ? 'is_volocar_admin'
       and (to_jsonb(new) ->> 'is_volocar_admin') is distinct from (to_jsonb(old) ->> 'is_volocar_admin')
       and not privileged then
      raise exception 'profiles.is_volocar_admin is immutable for non-admin callers';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.profiles_prevent_role_escalation() is
  'Blocks client INSERT/UPDATE of profiles.role / is_volocar_admin unless caller is already admin_users-allowlisted or service_role.';

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
  before insert or update on public.profiles
  for each row
  execute function public.profiles_prevent_role_escalation();

-- ---------------------------------------------------------------------------
-- Explicit column privileges (defense in depth alongside trigger)
-- ---------------------------------------------------------------------------
-- Keep INSERT (incl. role='user') so signup/upsert paths work; trigger blocks
-- privilege values on INSERT. For UPDATE: PostgreSQL ignores column-level REVOKE
-- when a table-level UPDATE grant exists, so revoke table UPDATE then re-grant
-- UPDATE only on non-privilege columns.
grant select, insert on table public.profiles to authenticated;
revoke all on table public.profiles from anon, public;

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into cols
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'profiles'
    and c.column_name not in ('role', 'is_volocar_admin');

  execute 'revoke update on table public.profiles from anon, authenticated, public';

  if cols is null or length(trim(cols)) = 0 then
    raise exception 'hotfix_admin_role_escalation: no non-privilege profiles columns to grant UPDATE';
  end if;

  execute format('grant update (%s) on table public.profiles to authenticated', cols);
end $$;

-- Re-assert admin_users least privilege: clients may only SELECT (membership check).
revoke insert, update, delete, truncate, references, trigger on table public.admin_users
  from anon, authenticated, public;
grant select on table public.admin_users to authenticated;
