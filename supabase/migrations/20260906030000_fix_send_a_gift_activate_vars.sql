-- Fix ambiguous service_key variable in activate_christmas_send_a_gift.
begin;

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

commit;
