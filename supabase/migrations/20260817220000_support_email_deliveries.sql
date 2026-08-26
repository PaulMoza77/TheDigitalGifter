-- Additive support email delivery. Reuses support_tickets / support_ticket_messages.
-- Records Resend attempts so admin replies are never claimed as emailed unless delivery succeeds.

begin;
create table if not exists public.support_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  message_id uuid references public.support_ticket_messages(id) on delete cascade,
  kind text not null,
  status text not null,
  idempotency_key text not null,
  provider_message_id text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_email_deliveries_kind_chk
    check (kind in ('ticket_received', 'admin_reply')),
  constraint support_email_deliveries_status_chk
    check (status in ('queued', 'sent', 'pending', 'failed', 'skipped'))
);
create unique index if not exists support_email_deliveries_idempotency_uidx
  on public.support_email_deliveries (idempotency_key);
create unique index if not exists support_email_deliveries_ticket_received_uidx
  on public.support_email_deliveries (ticket_id)
  where kind = 'ticket_received';
create unique index if not exists support_email_deliveries_message_uidx
  on public.support_email_deliveries (message_id)
  where message_id is not null;
create index if not exists support_email_deliveries_ticket_idx
  on public.support_email_deliveries (ticket_id, created_at desc);
alter table public.support_email_deliveries enable row level security;
drop policy if exists support_email_deliveries_admin_read on public.support_email_deliveries;
create policy support_email_deliveries_admin_read
  on public.support_email_deliveries
  for select
  using (public.is_admin());
revoke all on table public.support_email_deliveries from public, anon;
grant select on table public.support_email_deliveries to authenticated;
grant all on table public.support_email_deliveries to service_role;
commit;
