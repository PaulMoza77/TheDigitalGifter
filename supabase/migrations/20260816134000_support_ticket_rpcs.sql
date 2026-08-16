-- Support RPCs so guests can create/read a ticket without listing other rows.
begin;

create or replace function public.create_support_ticket(
  p_subject text,
  p_message text,
  p_name text default null,
  p_email text default null,
  p_page_url text default null,
  p_status text default 'open',
  p_priority text default 'normal'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket public.support_tickets%rowtype;
  msg public.support_ticket_messages%rowtype;
begin
  if p_subject is null or length(trim(p_subject)) = 0 then
    raise exception 'subject required';
  end if;
  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'message required';
  end if;

  insert into public.support_tickets (
    user_id, name, email, subject, status, priority, page_url
  ) values (
    auth.uid(),
    nullif(trim(coalesce(p_name, '')), ''),
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    trim(p_subject),
    coalesce(nullif(trim(p_status), ''), 'open'),
    coalesce(nullif(trim(p_priority), ''), 'normal'),
    nullif(trim(coalesce(p_page_url, '')), '')
  ) returning * into ticket;

  insert into public.support_ticket_messages (
    ticket_id, sender_id, sender_type, message
  ) values (
    ticket.id, auth.uid(), 'client', trim(p_message)
  ) returning * into msg;

  return jsonb_build_object('ticket', to_jsonb(ticket), 'message', to_jsonb(msg));
end;
$$;

create or replace function public.add_support_message(
  p_ticket_id uuid,
  p_message text,
  p_sender_type text default 'client'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket public.support_tickets%rowtype;
  msg public.support_ticket_messages%rowtype;
  sender text;
begin
  if p_ticket_id is null then
    raise exception 'ticket required';
  end if;
  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'message required';
  end if;

  select * into ticket from public.support_tickets where id = p_ticket_id;
  if not found then
    raise exception 'ticket not found';
  end if;

  if not (
    public.is_admin()
    or (auth.uid() is not null and ticket.user_id = auth.uid())
    or (auth.uid() is null and ticket.user_id is null)
  ) then
    raise exception 'forbidden';
  end if;

  sender := case
    when p_sender_type in ('client', 'admin', 'ai', 'system') then p_sender_type
    else 'client'
  end;

  insert into public.support_ticket_messages (
    ticket_id, sender_id, sender_type, message
  ) values (
    ticket.id,
    case when sender = 'client' then auth.uid() else null end,
    sender,
    trim(p_message)
  ) returning * into msg;

  update public.support_tickets set updated_at = now() where id = ticket.id;

  return to_jsonb(msg);
end;
$$;

create or replace function public.update_support_ticket(
  p_ticket_id uuid,
  p_status text default null,
  p_priority text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket public.support_tickets%rowtype;
begin
  select * into ticket from public.support_tickets where id = p_ticket_id;
  if not found then
    raise exception 'ticket not found';
  end if;

  if not (
    public.is_admin()
    or (auth.uid() is not null and ticket.user_id = auth.uid())
    or (auth.uid() is null and ticket.user_id is null)
  ) then
    raise exception 'forbidden';
  end if;

  update public.support_tickets
  set status = coalesce(nullif(trim(p_status), ''), status),
      priority = coalesce(nullif(trim(p_priority), ''), priority),
      updated_at = now()
  where id = p_ticket_id
  returning * into ticket;

  return to_jsonb(ticket);
end;
$$;

grant execute on function public.create_support_ticket(text, text, text, text, text, text, text)
  to anon, authenticated, service_role;
grant execute on function public.add_support_message(uuid, text, text)
  to anon, authenticated, service_role;
grant execute on function public.update_support_ticket(uuid, text, text)
  to anon, authenticated, service_role;

commit;
