-- Canonical delivery ledger for the current Christmas commerce tables.
-- Legacy Christmas V2 keeps its isolated christmas_v2_email_deliveries ledger.

alter table public.christmas_orders
  add column if not exists delivery_email_sent_at timestamptz;

create table if not exists public.christmas_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_orders (id) on delete cascade,
  kind text not null,
  provider_message_id text,
  status text not null default 'queued',
  last_error text,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint christmas_email_deliveries_kind_chk check (
    kind in ('starter_ready', 'magic_ready', 'ultimate_ready', 'partial_failure')
  ),
  constraint christmas_email_deliveries_status_chk check (
    status in ('queued', 'sent', 'skipped', 'failed')
  ),
  constraint christmas_email_deliveries_attempt_count_chk check (attempt_count >= 0)
);

alter table public.christmas_email_deliveries
  add column if not exists last_error text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists sent_at timestamptz;

create unique index if not exists christmas_email_deliveries_order_kind_uidx
  on public.christmas_email_deliveries (order_id, kind);

create index if not exists christmas_email_deliveries_status_created_idx
  on public.christmas_email_deliveries (status, created_at desc);

alter table public.christmas_email_deliveries enable row level security;

drop policy if exists christmas_email_deliveries_admin_read on public.christmas_email_deliveries;
create policy christmas_email_deliveries_admin_read
  on public.christmas_email_deliveries for select
  to authenticated
  using (public.is_admin());

revoke all on table public.christmas_email_deliveries from anon;
grant select on table public.christmas_email_deliveries to authenticated;
grant all on table public.christmas_email_deliveries to service_role;

create or replace function public.christmas_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists christmas_email_deliveries_touch_updated_at
  on public.christmas_email_deliveries;
create trigger christmas_email_deliveries_touch_updated_at
before update on public.christmas_email_deliveries
for each row execute function public.christmas_touch_updated_at();
