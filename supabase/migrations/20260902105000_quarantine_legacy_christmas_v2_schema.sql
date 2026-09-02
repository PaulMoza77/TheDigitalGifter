-- Quarantine production Christmas V2 prototype tables that collide with the
-- dedicated commerce foundation (tdg-christmas-foundation-002).
--
-- Evidence (2026-09-02, linked project kjlsocejpmnzhhduyumy):
--   public.christmas_orders already existed with sku/pack_key/status schema
--   (5 rows, all awaiting_* test/e2e/smoke; no paid customers).
--   Remote migration 20260831190000_christmas_v2_funnel applied via agent psql
--   without SQL body stored in schema_migrations.
--
-- This migration RENAMES legacy objects (preserves rows) so subsequent
-- 20260902120000 / 20260902140000 can create the ADR commerce schema safely.
-- Does not delete customer data.

set lock_timeout = '5s';
set statement_timeout = '120s';

-- ---------------------------------------------------------------------------
-- Rename colliding RPCs (different signatures / bodies from foundation)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'fulfill_christmas_order_payment'
      and pg_get_function_identity_arguments(p.oid) =
        'p_event_id text, p_session_id text, p_event_type text, p_payment_status text, p_payment_intent_id text, p_amount_cents integer, p_currency text, p_order_id uuid'
  ) then
    execute $f$
      alter function public.fulfill_christmas_order_payment(
        text, text, text, text, text, integer, text, uuid
      ) rename to fulfill_christmas_v2_order_payment
    $f$;
  end if;

  if to_regprocedure('public.claim_christmas_generation_job(uuid)') is not null then
    execute 'alter function public.claim_christmas_generation_job(uuid) rename to claim_christmas_v2_generation_job';
  end if;

  if to_regprocedure('public.christmas_finalize_generation_if_done(uuid)') is not null then
    execute 'alter function public.christmas_finalize_generation_if_done(uuid) rename to christmas_v2_finalize_generation_if_done';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Rename indexes that would collide by name with foundation indexes
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename in (
        'christmas_orders',
        'christmas_generation_jobs',
        'christmas_checkout_sessions',
        'christmas_email_deliveries',
        'christmas_order_scenes',
        'christmas_order_videos'
      )
      and indexname not like 'christmas_v2_%'
  loop
    execute format('alter index public.%I rename to %I', r.indexname, 'christmas_v2_' || r.indexname);
  end loop;
exception
  when duplicate_table then
    raise notice 'index rename skipped due to existing christmas_v2_ name';
  when undefined_table then
    raise notice 'index rename skipped; table missing';
end $$;

-- ---------------------------------------------------------------------------
-- Rename tables (FKs follow automatically)
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.christmas_orders') is not null
     and to_regclass('public.christmas_v2_orders') is null then
    -- Only quarantine when this is the LEGACY shape (sku column), not foundation.
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'christmas_orders'
        and column_name = 'sku'
    ) then
      alter table public.christmas_checkout_sessions rename to christmas_v2_checkout_sessions;
      alter table public.christmas_email_deliveries rename to christmas_v2_email_deliveries;
      alter table public.christmas_generation_jobs rename to christmas_v2_generation_jobs;
      alter table public.christmas_order_scenes rename to christmas_v2_order_scenes;
      alter table public.christmas_order_videos rename to christmas_v2_order_videos;
      alter table public.christmas_orders rename to christmas_v2_orders;
    end if;
  end if;
end $$;

-- Policies remain attached to renamed tables; rename for clarity where present.
do $$
begin
  if to_regclass('public.christmas_v2_orders') is not null then
    begin
      alter policy christmas_orders_admin_read on public.christmas_v2_orders
        rename to christmas_v2_orders_admin_read;
    exception when undefined_object then null;
    end;
  end if;
  if to_regclass('public.christmas_v2_generation_jobs') is not null then
    begin
      alter policy christmas_generation_jobs_admin_read on public.christmas_v2_generation_jobs
        rename to christmas_v2_generation_jobs_admin_read;
    exception when undefined_object then null;
    end;
  end if;
  if to_regclass('public.christmas_v2_checkout_sessions') is not null then
    begin
      alter policy christmas_checkout_sessions_admin_read on public.christmas_v2_checkout_sessions
        rename to christmas_v2_checkout_sessions_admin_read;
    exception when undefined_object then null;
    end;
  end if;
  if to_regclass('public.christmas_v2_email_deliveries') is not null then
    begin
      alter policy christmas_email_deliveries_admin_read on public.christmas_v2_email_deliveries
        rename to christmas_v2_email_deliveries_admin_read;
    exception when undefined_object then null;
    end;
  end if;
  if to_regclass('public.christmas_v2_order_scenes') is not null then
    begin
      alter policy christmas_order_scenes_admin_read on public.christmas_v2_order_scenes
        rename to christmas_v2_order_scenes_admin_read;
    exception when undefined_object then null;
    end;
  end if;
  if to_regclass('public.christmas_v2_order_videos') is not null then
    begin
      alter policy christmas_order_videos_admin_read on public.christmas_v2_order_videos
        rename to christmas_v2_order_videos_admin_read;
    exception when undefined_object then null;
    end;
  end if;
end $$;
