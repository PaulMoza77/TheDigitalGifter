begin;
-- Protect token-backed conversations from the older UUID-only guest RPCs.
do $$
declare n text; signature text; definition text;
begin
  foreach signature in array array['public.load_support_thread(uuid)', 'public.add_support_message(uuid,text,text)', 'public.update_support_ticket(uuid,text,text)'] loop
    definition := pg_get_functiondef(signature::regprocedure);
    definition := replace(definition, 'auth.uid() is null and ticket.user_id is null', 'auth.uid() is null and ticket.user_id is null and ticket.guest_access_hash is null');
    execute definition;
  end loop;
end $$;
create or replace function public.reply_public_support_ticket(p_reference text, p_guest_token text, p_message text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare t public.support_tickets%rowtype; m public.support_ticket_messages%rowtype;
begin
 select * into t from public.support_tickets where public_reference=upper(trim(p_reference)) for update;
 if not found or t.guest_access_hash is null or t.guest_access_hash <> encode(digest(convert_to(coalesce(p_guest_token,''),'UTF8'),'sha256'),'hex') then raise exception 'forbidden'; end if;
 if t.status='closed' then raise exception 'closed'; end if;
 if length(trim(coalesce(p_message,''))) not between 1 and 4000 then raise exception 'invalid message'; end if;
 if (select count(*) from public.support_ticket_messages where ticket_id=t.id and sender_type='client' and created_at > now()-interval '1 minute') >= 5 then raise exception 'too many messages'; end if;
 insert into public.support_ticket_messages(ticket_id,sender_type,message) values(t.id,'client',trim(p_message)) returning * into m;
 update public.support_tickets set status='needs_agent',updated_at=now() where id=t.id;
 return jsonb_build_object('ok',true,'messageId',m.id);
end $$;
revoke all on function public.reply_public_support_ticket(text,text,text) from public;
grant execute on function public.reply_public_support_ticket(text,text,text) to anon,authenticated,service_role;

create table public.support_admin_alerts (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 message_id uuid not null unique references public.support_ticket_messages(id) on delete cascade,
 status text not null default 'queued' check(status in ('queued','sending','sent','failed')),
 attempts integer not null default 0,
 retry_at timestamptz not null default now(),
 provider_id text, error_code text, created_at timestamptz not null default now()
);
alter table public.support_admin_alerts enable row level security;
create policy support_alerts_admin on public.support_admin_alerts for select to authenticated using(public.is_admin());
revoke all on public.support_admin_alerts from anon,authenticated;
grant select on public.support_admin_alerts to authenticated;
grant all on public.support_admin_alerts to service_role;
create or replace function public.queue_support_admin_alert() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.sender_type='client' then insert into public.support_admin_alerts(ticket_id,message_id) values(new.ticket_id,new.id) on conflict(message_id) do nothing; end if;
 return new;
end $$;
create trigger support_admin_alert after insert on public.support_ticket_messages for each row execute function public.queue_support_admin_alert();
create or replace function public.claim_support_admin_alerts(p_ticket_id uuid default null)
returns setof public.support_admin_alerts language sql security definer set search_path=public as $$
 update public.support_admin_alerts set status='sending', attempts=attempts+1,retry_at=now()+interval '2 minutes'
 where id in (select id from public.support_admin_alerts where status<>'sent' and attempts<8 and retry_at<=now() and (p_ticket_id is null or ticket_id=p_ticket_id) order by created_at limit 20 for update skip locked)
 returning *;
$$;
revoke all on function public.claim_support_admin_alerts(uuid) from public,anon,authenticated;
grant execute on function public.claim_support_admin_alerts(uuid) to service_role;
commit;
