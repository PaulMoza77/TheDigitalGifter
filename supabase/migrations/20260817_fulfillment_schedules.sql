-- Official fulfillment scheduler: pg_cron + pg_net + Vault secret NAMES only.
-- Do not put secret values in this file. Apply after Vault secrets exist, or
-- run `select public.ensure_fulfillment_schedules();` after creating them.
-- See docs/fulfillment-schedules.md. This is not tested by PGlite.

create extension if not exists pg_net;
create extension if not exists pg_cron;
create extension if not exists supabase_vault;

create or replace function public.invoke_fulfillment_cron(p_fn text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fn text;
  v_url text;
  v_bearer text;
  v_request_id bigint;
begin
  v_fn := p_fn;
  if v_fn not in ('process-fulfillment-jobs', 'purge-expired-media') then
    raise exception 'unknown fulfillment function: %', v_fn;
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'fulfillment_project_url'
  limit 1;

  select decrypted_secret into v_bearer
  from vault.decrypted_secrets
  where name = 'fulfillment_scheduler_bearer'
  limit 1;

  if v_url is null or btrim(v_url) = '' or v_bearer is null or btrim(v_bearer) = '' then
    raise exception
      'Vault secrets fulfillment_project_url and fulfillment_scheduler_bearer must exist before scheduling';
  end if;

  v_url := rtrim(v_url, '/') || '/functions/v1/' || v_fn;

  select net.http_post(
    url := v_url,
    headers := pg_catalog.jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_bearer
    ),
    body := '{}'::pg_catalog.jsonb
  ) into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.ensure_fulfillment_schedules()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
begin
  for v_job in
    select jobid
    from cron.job
    where jobname in ('process-fulfillment-jobs', 'purge-expired-media')
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  perform cron.schedule(
    'process-fulfillment-jobs',
    '* * * * *',
    $cron$select public.invoke_fulfillment_cron('process-fulfillment-jobs')$cron$
  );

  perform cron.schedule(
    'purge-expired-media',
    '15 * * * *',
    $cron$select public.invoke_fulfillment_cron('purge-expired-media')$cron$
  );

  return public.fulfillment_schedule_status();
end;
$$;

create or replace function public.fulfillment_schedule_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_process boolean := false;
  v_purge boolean := false;
  v_process_sched text;
  v_purge_sched text;
begin
  select true, schedule into v_process, v_process_sched
  from cron.job
  where jobname = 'process-fulfillment-jobs'
  limit 1;

  select true, schedule into v_purge, v_purge_sched
  from cron.job
  where jobname = 'purge-expired-media'
  limit 1;

  return pg_catalog.jsonb_build_object(
    'ok', coalesce(v_process, false) and coalesce(v_purge, false)
      and v_process_sched = '* * * * *'
      and v_purge_sched = '15 * * * *',
    'process_fulfillment_jobs', pg_catalog.jsonb_build_object(
      'present', coalesce(v_process, false),
      'schedule', v_process_sched
    ),
    'purge_expired_media', pg_catalog.jsonb_build_object(
      'present', coalesce(v_purge, false),
      'schedule', v_purge_sched
    )
  );
end;
$$;

revoke all on function public.invoke_fulfillment_cron(text) from public, anon, authenticated;
revoke all on function public.ensure_fulfillment_schedules() from public, anon, authenticated;
revoke all on function public.fulfillment_schedule_status() from public, anon, authenticated;
grant execute on function public.invoke_fulfillment_cron(text) to postgres;
grant execute on function public.ensure_fulfillment_schedules() to postgres;
grant execute on function public.fulfillment_schedule_status() to postgres, service_role;

do $$
begin
  if exists (
    select 1 from vault.decrypted_secrets where name = 'fulfillment_project_url'
  ) and exists (
    select 1 from vault.decrypted_secrets where name = 'fulfillment_scheduler_bearer'
  ) then
    perform public.ensure_fulfillment_schedules();
  else
    raise notice
      'Skipping schedule install: create Vault secrets fulfillment_project_url and fulfillment_scheduler_bearer, then select public.ensure_fulfillment_schedules();';
  end if;
end
$$;
