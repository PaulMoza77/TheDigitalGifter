-- Send-a-Gift: prepaid packages, share links, entitlements, atomic redemption.
begin;

alter table public.christmas_products drop constraint if exists christmas_products_type_chk;
alter table public.christmas_products add constraint christmas_products_type_chk check (
  product_type in (
    'photo_generator','santa_video','card','tree','advent','wishlist','gift_finder',
    'messages','hub','send_a_gift','other'
  )
);

insert into public.christmas_products (
  product_key, slug, product_type, name, description,
  active, public_discoverable, sort_order, route_path, locale_default, metadata
) values (
  'christmas_send_a_gift','send-a-gift','send_a_gift','Send a Gift',
  'One-time prepaid TDG gift packages with a secure recipient share link.',
  true, true, 5, '/send-a-gift', 'en',
  jsonb_build_object('foundation', true, 'live_offer', false, 'production_purchasable', false, 'funnel', 'christmas_send_a_gift')
)
on conflict (product_key) do update set
  product_type = excluded.product_type,
  name = excluded.name,
  description = excluded.description,
  active = true,
  public_discoverable = true,
  route_path = excluded.route_path,
  metadata = public.christmas_products.metadata || excluded.metadata,
  updated_at = now();

with prod as (select id from public.christmas_products where product_key = 'christmas_send_a_gift')
insert into public.christmas_packages (
  product_id, package_key, package_name, description, currency, price_cents,
  compare_at_cents, active, purchasable, features, sort_order, locale_default, metadata
)
select prod.id, v.package_key, v.package_name, v.description, 'usd', 0, null, true, false,
  v.features, v.sort_order, 'en', v.metadata
from prod cross join (values
  ('starter','Starter Gift','Small prepaid creative bundle. Live price pending founder activation.',
   '["1 Christmas portrait credit"]'::jsonb, 10,
   jsonb_build_object('live_offer', false, 'production_purchasable', false, 'entitlements',
     jsonb_build_array(jsonb_build_object('service_key','christmas_photo','quantity',1)))),
  ('classic','Christmas Gift','Balanced portrait + Santa video bundle. Live price pending founder activation.',
   '["1 Christmas portrait credit","1 Santa video credit"]'::jsonb, 20,
   jsonb_build_object('live_offer', false, 'production_purchasable', false, 'entitlements',
     jsonb_build_array(
       jsonb_build_object('service_key','christmas_photo','quantity',1),
       jsonb_build_object('service_key','christmas_santa_video','quantity',1)))),
  ('premium','Premium Gift','Richer multi-service prepaid bundle. Live price pending founder activation.',
   '["2 Christmas portrait credits","1 Santa video credit","1 Christmas card credit"]'::jsonb, 30,
   jsonb_build_object('live_offer', false, 'production_purchasable', false, 'entitlements',
     jsonb_build_array(
       jsonb_build_object('service_key','christmas_photo','quantity',2),
       jsonb_build_object('service_key','christmas_santa_video','quantity',1),
       jsonb_build_object('service_key','christmas_card','quantity',1))))
) as v(package_key, package_name, description, features, sort_order, metadata)
on conflict (product_id, package_key) do update set
  package_name = excluded.package_name,
  description = excluded.description,
  active = true,
  purchasable = false,
  price_cents = 0,
  features = excluded.features,
  metadata = public.christmas_packages.metadata || excluded.metadata,
  updated_at = now();

create table if not exists public.christmas_gift_shares (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_orders (id) on delete cascade,
  share_id text not null,
  status text not null default 'pending',
  package_key text not null,
  sender_display_name text,
  recipient_display_name text,
  gift_message_ciphertext text,
  email_status text not null default 'not_requested',
  email_last_error text,
  email_last_sent_at timestamptz,
  email_idempotency_key text,
  first_opened_at timestamptz,
  disabled_at timestamptz,
  disabled_reason text,
  activated_at timestamptz,
  activation_event_id text,
  last_safe_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_gift_shares_share_id_chk check (length(trim(share_id)) >= 32),
  constraint christmas_gift_shares_status_chk check (status in ('pending','active','disabled','fully_redeemed')),
  constraint christmas_gift_shares_email_chk check (email_status in ('not_requested','queued','sent','failed','skipped'))
);
create unique index if not exists christmas_gift_shares_order_uidx on public.christmas_gift_shares (order_id);
create unique index if not exists christmas_gift_shares_share_id_uidx on public.christmas_gift_shares (share_id);
create index if not exists christmas_gift_shares_status_idx on public.christmas_gift_shares (status, created_at desc);
drop trigger if exists christmas_gift_shares_touch_updated_at on public.christmas_gift_shares;
create trigger christmas_gift_shares_touch_updated_at before update on public.christmas_gift_shares
for each row execute function public.christmas_touch_updated_at();

create table if not exists public.christmas_gift_entitlements (
  id uuid primary key default gen_random_uuid(),
  gift_share_id uuid not null references public.christmas_gift_shares (id) on delete cascade,
  order_id uuid not null references public.christmas_orders (id) on delete cascade,
  service_key text not null,
  total_quantity integer not null,
  used_quantity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_gift_entitlements_qty_chk check (total_quantity > 0 and used_quantity >= 0 and used_quantity <= total_quantity),
  constraint christmas_gift_entitlements_service_chk check (length(trim(service_key)) > 0)
);
create unique index if not exists christmas_gift_entitlements_share_service_uidx on public.christmas_gift_entitlements (gift_share_id, service_key);
drop trigger if exists christmas_gift_entitlements_touch_updated_at on public.christmas_gift_entitlements;
create trigger christmas_gift_entitlements_touch_updated_at before update on public.christmas_gift_entitlements
for each row execute function public.christmas_touch_updated_at();

create table if not exists public.christmas_gift_redemptions (
  id uuid primary key default gen_random_uuid(),
  gift_share_id uuid not null references public.christmas_gift_shares (id) on delete cascade,
  entitlement_id uuid not null references public.christmas_gift_entitlements (id) on delete cascade,
  service_key text not null,
  quantity integer not null default 1,
  idempotency_key text not null,
  status text not null default 'completed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint christmas_gift_redemptions_qty_chk check (quantity > 0),
  constraint christmas_gift_redemptions_status_chk check (status in ('completed','rejected'))
);
create unique index if not exists christmas_gift_redemptions_idempotency_uidx on public.christmas_gift_redemptions (idempotency_key);
create index if not exists christmas_gift_redemptions_share_idx on public.christmas_gift_redemptions (gift_share_id, created_at desc);

create or replace function public.activate_christmas_send_a_gift(p_order_id uuid, p_activation_event_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  order_row public.christmas_orders%rowtype;
  pkg_row public.christmas_packages%rowtype;
  share_row public.christmas_gift_shares%rowtype;
  ent jsonb; v_service_key text; v_qty integer; share_token text; existing_count integer;
begin
  if p_order_id is null then return jsonb_build_object('ok', false, 'reason', 'missing_order_id'); end if;
  select * into order_row from public.christmas_orders where id = p_order_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'order_not_found'); end if;
  if order_row.product_key <> 'christmas_send_a_gift' then
    return jsonb_build_object('ok', false, 'reason', 'not_send_a_gift_order');
  end if;
  if order_row.payment_status <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'payment_not_paid', 'payment_status', order_row.payment_status);
  end if;
  select * into share_row from public.christmas_gift_shares where order_id = p_order_id for update;
  if found and share_row.status in ('active','fully_redeemed','disabled') then
    return jsonb_build_object('ok', true, 'status', 'already_activated', 'order_id', p_order_id,
      'share_id', share_row.share_id, 'gift_share_id', share_row.id);
  end if;
  select pkg.* into pkg_row from public.christmas_packages pkg
    join public.christmas_products p on p.id = pkg.product_id
    where p.product_key = 'christmas_send_a_gift' and pkg.package_key = order_row.package_key;
  if not found then return jsonb_build_object('ok', false, 'reason', 'package_not_found'); end if;
  if share_row.id is null then
    share_token := encode(extensions.gen_random_bytes(24), 'hex');
    insert into public.christmas_gift_shares (
      order_id, share_id, status, package_key, sender_display_name, recipient_display_name,
      gift_message_ciphertext, activated_at, activation_event_id, metadata
    ) values (
      p_order_id, share_token, 'active', order_row.package_key,
      nullif(trim(coalesce(order_row.metadata->>'sender_display_name','')),''),
      nullif(trim(coalesce(order_row.metadata->>'recipient_display_name','')),''),
      nullif(order_row.metadata->>'gift_message_ciphertext',''),
      now(), nullif(trim(p_activation_event_id),''),
      jsonb_build_object('package_key', order_row.package_key)
    ) returning * into share_row;
  else
    update public.christmas_gift_shares set status='active',
      activated_at = coalesce(activated_at, now()),
      activation_event_id = coalesce(nullif(trim(p_activation_event_id),''), activation_event_id),
      last_safe_error = null
    where id = share_row.id returning * into share_row;
  end if;
  select count(*) into existing_count from public.christmas_gift_entitlements where gift_share_id = share_row.id;
  if existing_count = 0 then
    for ent in select * from jsonb_array_elements(coalesce(pkg_row.metadata->'entitlements','[]'::jsonb)) loop
      v_service_key := nullif(trim(ent->>'service_key'),'');
      v_qty := coalesce((ent->>'quantity')::integer, 0);
      if v_service_key is null or v_qty <= 0 then continue; end if;
      insert into public.christmas_gift_entitlements (gift_share_id, order_id, service_key, total_quantity, used_quantity)
      values (share_row.id, p_order_id, v_service_key, v_qty, 0)
      on conflict (gift_share_id, service_key) do nothing;
    end loop;
  end if;
  update public.christmas_orders set
    fulfillment_status = case when fulfillment_status in ('not_started','queued','processing') then 'completed' else fulfillment_status end,
    fulfillment_completed_at = coalesce(fulfillment_completed_at, now()),
    metadata = metadata || jsonb_build_object('send_a_gift_share_id', share_row.share_id, 'send_a_gift_activated_at', share_row.activated_at)
  where id = p_order_id;
  return jsonb_build_object('ok', true, 'status', 'activated', 'order_id', p_order_id,
    'share_id', share_row.share_id, 'gift_share_id', share_row.id, 'package_key', share_row.package_key);
end; $$;
revoke all on function public.activate_christmas_send_a_gift(uuid, text) from anon, authenticated, public;
grant execute on function public.activate_christmas_send_a_gift(uuid, text) to service_role;

create or replace function public.redeem_christmas_gift_entitlement(
  p_share_id text, p_service_key text, p_idempotency_key text, p_quantity integer default 1
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  share_row public.christmas_gift_shares%rowtype;
  ent_row public.christmas_gift_entitlements%rowtype;
  prior public.christmas_gift_redemptions%rowtype;
  qty integer; remaining integer; all_done boolean;
begin
  qty := coalesce(p_quantity, 1);
  if qty <= 0 then return jsonb_build_object('ok', false, 'reason', 'invalid_quantity'); end if;
  if nullif(trim(p_share_id),'') is null or nullif(trim(p_service_key),'') is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_args');
  end if;
  if nullif(trim(p_idempotency_key),'') is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_idempotency_key');
  end if;
  select * into prior from public.christmas_gift_redemptions where idempotency_key = trim(p_idempotency_key);
  if found then
    return jsonb_build_object('ok', true, 'status', 'already_redeemed', 'redemption_id', prior.id,
      'service_key', prior.service_key, 'quantity', prior.quantity);
  end if;
  select * into share_row from public.christmas_gift_shares where share_id = trim(p_share_id) for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'gift_not_found'); end if;
  if share_row.status = 'disabled' then return jsonb_build_object('ok', false, 'reason', 'gift_disabled'); end if;
  if share_row.status = 'fully_redeemed' then return jsonb_build_object('ok', false, 'reason', 'gift_fully_redeemed'); end if;
  if share_row.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'gift_not_active', 'status', share_row.status); end if;
  select * into ent_row from public.christmas_gift_entitlements
    where gift_share_id = share_row.id and service_key = trim(p_service_key) for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'entitlement_not_in_gift'); end if;
  remaining := ent_row.total_quantity - ent_row.used_quantity;
  if remaining < qty then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_remaining', 'remaining', remaining);
  end if;
  update public.christmas_gift_entitlements set used_quantity = used_quantity + qty where id = ent_row.id returning * into ent_row;
  insert into public.christmas_gift_redemptions (gift_share_id, entitlement_id, service_key, quantity, idempotency_key, status)
  values (share_row.id, ent_row.id, ent_row.service_key, qty, trim(p_idempotency_key), 'completed') returning * into prior;
  select bool_and(used_quantity >= total_quantity) into all_done from public.christmas_gift_entitlements where gift_share_id = share_row.id;
  if all_done then update public.christmas_gift_shares set status = 'fully_redeemed' where id = share_row.id; end if;
  return jsonb_build_object('ok', true, 'status', 'redeemed', 'redemption_id', prior.id, 'service_key', ent_row.service_key,
    'quantity', qty, 'used_quantity', ent_row.used_quantity, 'total_quantity', ent_row.total_quantity,
    'remaining', ent_row.total_quantity - ent_row.used_quantity, 'gift_fully_redeemed', coalesce(all_done, false));
end; $$;
revoke all on function public.redeem_christmas_gift_entitlement(text, text, text, integer) from anon, authenticated, public;
grant execute on function public.redeem_christmas_gift_entitlement(text, text, text, integer) to service_role;

create or replace function public.mark_christmas_gift_opened(p_share_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare share_row public.christmas_gift_shares%rowtype;
begin
  update public.christmas_gift_shares set first_opened_at = coalesce(first_opened_at, now())
  where share_id = trim(p_share_id) and status in ('active','fully_redeemed') returning * into share_row;
  if not found then return jsonb_build_object('ok', false, 'reason', 'gift_not_openable'); end if;
  return jsonb_build_object('ok', true, 'share_id', share_row.share_id, 'first_opened_at', share_row.first_opened_at);
end; $$;
revoke all on function public.mark_christmas_gift_opened(text) from anon, authenticated, public;
grant execute on function public.mark_christmas_gift_opened(text) to service_role;

create or replace function public.disable_christmas_gift_share(p_share_id text, p_reason text default 'admin_disabled')
returns jsonb language plpgsql security definer set search_path = public as $$
declare share_row public.christmas_gift_shares%rowtype;
begin
  update public.christmas_gift_shares set status='disabled', disabled_at=now(),
    disabled_reason=left(coalesce(nullif(trim(p_reason),''),'admin_disabled'),200)
  where share_id = trim(p_share_id) returning * into share_row;
  if not found then return jsonb_build_object('ok', false, 'reason', 'gift_not_found'); end if;
  return jsonb_build_object('ok', true, 'status', 'disabled', 'share_id', share_row.share_id);
end; $$;
revoke all on function public.disable_christmas_gift_share(text, text) from anon, authenticated, public;
grant execute on function public.disable_christmas_gift_share(text, text) to service_role;

alter table public.christmas_gift_shares enable row level security;
alter table public.christmas_gift_entitlements enable row level security;
alter table public.christmas_gift_redemptions enable row level security;
drop policy if exists christmas_gift_shares_admin_read on public.christmas_gift_shares;
create policy christmas_gift_shares_admin_read on public.christmas_gift_shares for select using (public.is_admin());
drop policy if exists christmas_gift_entitlements_admin_read on public.christmas_gift_entitlements;
create policy christmas_gift_entitlements_admin_read on public.christmas_gift_entitlements for select using (public.is_admin());
drop policy if exists christmas_gift_redemptions_admin_read on public.christmas_gift_redemptions;
create policy christmas_gift_redemptions_admin_read on public.christmas_gift_redemptions for select using (public.is_admin());

commit;
