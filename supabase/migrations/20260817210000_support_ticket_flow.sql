-- Additive support-ticket flow. Reuses public.support_tickets.
-- Adds category, public reference, guest access hash, and optional pet order FK.
-- Does not drop policies or recreate the tickets table.

begin;
alter table public.support_tickets
  add column if not exists category text,
  add column if not exists public_reference text,
  add column if not exists pet_order_id uuid,
  add column if not exists guest_access_hash text;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'support_tickets_category_chk'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_category_chk
      check (
        category is null
        or category in ('pet_order', 'generation', 'billing', 'account', 'other')
      );
  end if;
end
$$;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'support_tickets_status_flow_chk'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_status_flow_chk
      check (
        status in (
          'open',
          'in_progress',
          'waiting_for_customer',
          'resolved',
          'closed',
          'needs_agent',
          'ai_replied'
        )
      );
  end if;
end
$$;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'support_tickets_pet_order_fk'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_pet_order_fk
      foreign key (pet_order_id) references public.pet_orders(id) on delete set null;
  end if;
end
$$;
create unique index if not exists support_tickets_public_reference_uidx
  on public.support_tickets (public_reference)
  where public_reference is not null;
create index if not exists support_tickets_pet_order_idx
  on public.support_tickets (pet_order_id)
  where pet_order_id is not null;
create index if not exists support_tickets_email_created_idx
  on public.support_tickets (lower(email), created_at desc);
create or replace function public.support_public_reference()
returns text
language plpgsql
set search_path = public, extensions
as $$
declare
  candidate text;
begin
  loop
    candidate := 'TDG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (
      select 1 from public.support_tickets where public_reference = candidate
    );
  end loop;
  return candidate;
end;
$$;
create or replace function public.sanitize_support_page_path(p_value text)
returns text
language plpgsql
immutable
as $$
declare
  raw text := coalesce(p_value, '');
  path text;
begin
  path := split_part(split_part(raw, '?', 1), '#', 1);
  if path ~* 'https?://' then
    begin
      path := regexp_replace(path, '^https?://[^/]+', '');
    exception when others then
      path := '/support';
    end;
  end if;
  if path is null or length(trim(path)) = 0 or path not like '/%' then
    return '/support';
  end if;
  if path ~* 'token=|publicToken|@' then
    return '/support';
  end if;
  return left(path, 180);
end;
$$;
create or replace function public.create_public_support_ticket(
  p_email text,
  p_category text,
  p_subject text,
  p_message text,
  p_pet_public_token text default null,
  p_page_path text default null,
  p_honeypot text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  email_norm text;
  category_norm text;
  subject_norm text;
  message_norm text;
  token_norm text;
  page_path text;
  order_id uuid;
  ticket public.support_tickets%rowtype;
  msg public.support_ticket_messages%rowtype;
  guest_token text;
  recent_count integer;
begin
  if length(trim(coalesce(p_honeypot, ''))) > 0 then
    return jsonb_build_object(
      'ok', true,
      'reference', 'TDG-000000',
      'expectedResponse', 'We typically reply within 1–2 business days.',
      'guestToken', null
    );
  end if;

  email_norm := lower(trim(coalesce(p_email, '')));
  category_norm := trim(coalesce(p_category, ''));
  subject_norm := trim(coalesce(p_subject, ''));
  message_norm := trim(coalesce(p_message, ''));
  token_norm := nullif(trim(coalesce(p_pet_public_token, '')), '');
  page_path := public.sanitize_support_page_path(p_page_path);

  if email_norm !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' or length(email_norm) > 254 then
    raise exception 'valid email required';
  end if;
  if category_norm not in ('pet_order', 'generation', 'billing', 'account', 'other') then
    raise exception 'category required';
  end if;
  if length(subject_norm) < 3 or length(subject_norm) > 120 then
    raise exception 'subject required';
  end if;
  if length(message_norm) < 10 or length(message_norm) > 4000 then
    raise exception 'message required';
  end if;

  select count(*) into recent_count
  from public.support_tickets
  where lower(email) = email_norm
    and created_at > now() - interval '15 minutes';
  if recent_count >= 3 then
    raise exception 'too many tickets';
  end if;

  if token_norm is not null then
    if length(token_norm) > 200 then
      raise exception 'invalid order';
    end if;
    select id into order_id
    from public.pet_orders
    where public_token_hash = encode(digest(convert_to(token_norm, 'UTF8'), 'sha256'), 'hex')
    limit 1;
  end if;

  guest_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.support_tickets (
    user_id,
    email,
    subject,
    status,
    priority,
    page_url,
    category,
    public_reference,
    pet_order_id,
    guest_access_hash
  ) values (
    auth.uid(),
    email_norm,
    subject_norm,
    'open',
    'normal',
    page_path,
    category_norm,
    public.support_public_reference(),
    order_id,
    encode(digest(convert_to(guest_token, 'UTF8'), 'sha256'), 'hex')
  ) returning * into ticket;

  insert into public.support_ticket_messages (
    ticket_id, sender_id, sender_type, message
  ) values (
    ticket.id, auth.uid(), 'client', message_norm
  ) returning * into msg;

  return jsonb_build_object(
    'ok', true,
    'reference', ticket.public_reference,
    'expectedResponse', 'We typically reply within 1–2 business days.',
    'guestToken', guest_token,
    'status', ticket.status
  );
end;
$$;
create or replace function public.load_own_support_ticket(
  p_reference text,
  p_guest_token text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  ticket public.support_tickets%rowtype;
  token_hash text;
  can_read boolean;
begin
  if p_reference is null or length(trim(p_reference)) = 0 then
    return null;
  end if;

  select * into ticket
  from public.support_tickets
  where public_reference = upper(trim(p_reference))
  limit 1;
  if not found then
    return null;
  end if;

  token_hash := case
    when p_guest_token is null or length(trim(p_guest_token)) = 0 then null
    else encode(digest(convert_to(trim(p_guest_token), 'UTF8'), 'sha256'), 'hex')
  end;

  can_read :=
    public.is_admin()
    or (ticket.user_id is not null and ticket.user_id = auth.uid())
    or (
      ticket.guest_access_hash is not null
      and token_hash is not null
      and ticket.guest_access_hash = token_hash
    );

  if not can_read then
    return null;
  end if;

  return jsonb_build_object(
    'reference', ticket.public_reference,
    'status', ticket.status,
    'category', ticket.category,
    'subject', ticket.subject,
    'createdAt', ticket.created_at,
    'hasPetOrder', ticket.pet_order_id is not null,
    'messages', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'senderType', m.sender_type,
          'message', m.message,
          'createdAt', m.created_at
        )
        order by m.created_at
      )
      from public.support_ticket_messages m
      where m.ticket_id = ticket.id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.support_public_reference() from public, anon, authenticated;
revoke all on function public.sanitize_support_page_path(text) from public;
revoke all on function public.create_public_support_ticket(text, text, text, text, text, text, text) from public;
revoke all on function public.load_own_support_ticket(text, text) from public;
grant execute on function public.support_public_reference() to service_role;
grant execute on function public.sanitize_support_page_path(text) to anon, authenticated, service_role;
grant execute on function public.create_public_support_ticket(text, text, text, text, text, text, text)
  to anon, authenticated, service_role;
grant execute on function public.load_own_support_ticket(text, text)
  to anon, authenticated, service_role;
-- Guests create/read via RPCs only. They cannot list or mutate tickets by UUID.
revoke select on public.support_tickets from anon;
revoke select on public.support_ticket_messages from anon;
revoke update on public.support_tickets from anon;
drop policy if exists support_tickets_update on public.support_tickets;
create policy support_tickets_update on public.support_tickets
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists support_msgs_insert on public.support_ticket_messages;
create policy support_msgs_insert on public.support_ticket_messages
  for insert with check (
    public.is_admin()
    or exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.user_id = auth.uid()
    )
  );
commit;
