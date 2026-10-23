-- Reconcile the payment guard already installed in production; no price/data changes.
CREATE OR REPLACE FUNCTION public.fulfill_christmas_v2_order_payment(p_event_id text, p_session_id text, p_event_type text, p_payment_status text, p_payment_intent_id text, p_amount_cents integer, p_currency text, p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  order_row public.christmas_v2_orders%rowtype;
  already boolean := false;
begin
  select * into order_row from public.christmas_v2_orders where id = p_order_id for update;
  if not found then
    raise exception 'christmas v2 order not found';
  end if;

  if p_payment_status is distinct from 'paid' then raise exception 'payment is not paid'; end if;
  if p_amount_cents is distinct from order_row.amount_cents or lower(p_currency) is distinct from lower(order_row.currency) then
    raise exception 'payment amount or currency does not match order';
  end if;
  if order_row.paid_at is not null then
    already := true;
  else
    update public.christmas_v2_orders
    set
      status = 'paid',
      paid_at = now(),
      stripe_checkout_session_id = coalesce(nullif(p_session_id, ''), stripe_checkout_session_id),
      stripe_payment_intent_id = nullif(p_payment_intent_id, ''),
      stripe_payment_status = coalesce(nullif(p_payment_status, ''), 'paid'),
      charged_amount_cents = coalesce(p_amount_cents, amount_cents),
      updated_at = now()
    where id = p_order_id;

    insert into public.christmas_v2_generation_jobs (order_id, status)
    values (p_order_id, 'queued')
    on conflict (order_id) do nothing;
  end if;

  insert into public.processed_stripe_events (event_id, event_type, stripe_session_id, result)
  values (
    p_event_id,
    p_event_type,
    p_session_id,
    jsonb_build_object(
      'status', case when already then 'already_paid' else 'fulfilled' end,
      'christmas_order_id', p_order_id,
      'should_enqueue', true,
      'schema', 'christmas_v2'
    )
  )
  on conflict (event_id) do nothing;

  return jsonb_build_object(
    'status', case when already then 'already_paid' else 'fulfilled' end,
    'should_enqueue', not already,
    'already_paid', already,
    'christmas_order_id', p_order_id,
    'meta_event_id', order_row.meta_event_id
  );
end;
$function$;
