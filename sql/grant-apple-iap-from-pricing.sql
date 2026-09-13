-- Replace hardcoded Apple product → credits map with Admin pricing_items.
-- Requires sql/apple-iap.sql (grant_apple_iap_credits) already applied.
-- Requires sql/pricing-apple-product-ids.sql (metadata.apple_product_id) applied.

create or replace function public.grant_apple_iap_credits(
  p_user_id uuid,
  p_user_email text,
  p_transaction_id text,
  p_original_transaction_id text,
  p_product_id text,
  p_environment text,
  p_purchase_date timestamptz,
  p_bundle_id text,
  p_app_account_token text,
  p_credits integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.apple_iap_transactions%rowtype;
  inserted public.apple_iap_transactions%rowtype;
  email_norm text;
  note_text text;
  expected_credits integer;
  pricing_key text;
begin
  if p_user_id is null then
    raise exception 'user required';
  end if;
  if p_transaction_id is null or length(trim(p_transaction_id)) = 0 then
    raise exception 'transaction_id required';
  end if;
  if p_environment not in ('Sandbox', 'Production') then
    raise exception 'invalid environment';
  end if;
  if trim(coalesce(p_bundle_id, '')) <> 'com.thedigitalgifter.app' then
    raise exception 'invalid bundle';
  end if;
  if lower(trim(coalesce(p_app_account_token, ''))) <> lower(p_user_id::text) then
    raise exception 'account token mismatch';
  end if;

  -- Source of truth: Admin pricing_items (metadata.apple_product_id),
  -- with audited fallbacks for starter/creator/pro/enterprise until metadata is seeded.
  select
    greatest(1, coalesce(pi.credits, 0)),
    pi.key
  into expected_credits, pricing_key
  from public.pricing_items pi
  where pi.category in ('credit_pack', 'credits')
    and coalesce(pi.active, true) = true
    and coalesce(pi.is_active, true) = true
    and (
      lower(trim(coalesce(pi.metadata->>'apple_product_id', pi.metadata->>'appleProductId', '')))
        = lower(trim(coalesce(p_product_id, '')))
      or (
        nullif(trim(coalesce(pi.metadata->>'apple_product_id', pi.metadata->>'appleProductId', '')), '') is null
        and (
          (pi.key = 'starter' and lower(trim(p_product_id)) = 'com.thedigitalgifter.app.credits.starter')
          or (pi.key = 'creator' and lower(trim(p_product_id)) = 'com.thedigitalgifter.app.credits.creator')
          or (pi.key = 'pro' and lower(trim(p_product_id)) = 'com.thedigitalgifter.app.credits.pro')
          or (pi.key = 'enterprise' and lower(trim(p_product_id)) = 'com.thedigitalgifter.app.credits.enterprise')
        )
      )
    )
  order by pi.sort_order asc nulls last
  limit 1;

  if expected_credits is null or expected_credits < 1 then
    raise exception 'unknown product';
  end if;
  if p_credits is distinct from expected_credits then
    raise exception 'credit amount mismatch';
  end if;

  email_norm := lower(trim(coalesce(p_user_email, '')));
  if email_norm = '' then
    raise exception 'user email required for ledger';
  end if;
  note_text := 'apple_iap:' || trim(p_transaction_id);

  select * into existing
  from public.apple_iap_transactions
  where transaction_id = trim(p_transaction_id);

  if found then
    if existing.user_id is distinct from p_user_id
      or existing.product_id is distinct from trim(p_product_id)
      or existing.bundle_id is distinct from trim(p_bundle_id)
      or existing.credits_granted is distinct from expected_credits
      or lower(existing.app_account_token) is distinct from lower(p_user_id::text)
    then
      raise exception 'transaction replay mismatch';
    end if;

    -- Heal ledger if a prior partial write left the tx without credits_ledger.
    if not exists (
      select 1 from public.credits_ledger cl where cl.note = note_text
    ) then
      insert into public.credits_ledger (
        user_convex_id,
        user_id,
        direction,
        credits,
        event_type,
        category,
        note,
        template_title
      ) values (
        email_norm,
        p_user_id,
        'in',
        expected_credits,
        'apple_iap',
        'apple_iap',
        note_text,
        coalesce(pricing_key, trim(p_product_id))
      );
    elsif not exists (
      select 1
      from public.credits_ledger cl
      where cl.note = note_text
        and cl.user_id = p_user_id
        and cl.direction = 'in'
        and cl.credits = expected_credits
    ) then
      raise exception 'ledger replay mismatch';
    end if;

    return jsonb_build_object(
      'status', 'already_processed',
      'transaction_id', existing.transaction_id,
      'credits_granted', existing.credits_granted,
      'product_id', existing.product_id,
      'granted_at', existing.granted_at,
      'user_id', existing.user_id,
      'pricing_key', pricing_key
    );
  end if;

  insert into public.apple_iap_transactions (
    user_id,
    user_email,
    transaction_id,
    original_transaction_id,
    product_id,
    environment,
    purchase_date,
    bundle_id,
    app_account_token,
    credits_granted,
    status,
    granted_at
  ) values (
    p_user_id,
    email_norm,
    trim(p_transaction_id),
    nullif(trim(coalesce(p_original_transaction_id, '')), ''),
    trim(p_product_id),
    p_environment,
    p_purchase_date,
    trim(p_bundle_id),
    lower(trim(p_app_account_token)),
    expected_credits,
    'granted',
    now()
  )
  returning * into inserted;

  if exists (
    select 1 from public.credits_ledger cl where cl.note = note_text
  ) then
    if not exists (
      select 1
      from public.credits_ledger cl
      where cl.note = note_text
        and cl.user_id = p_user_id
        and cl.direction = 'in'
        and cl.credits = expected_credits
    ) then
      raise exception 'ledger replay mismatch';
    end if;

    return jsonb_build_object(
      'status', 'already_processed',
      'transaction_id', inserted.transaction_id,
      'credits_granted', inserted.credits_granted,
      'product_id', inserted.product_id,
      'granted_at', inserted.granted_at,
      'user_id', inserted.user_id,
      'pricing_key', pricing_key
    );
  end if;

  insert into public.credits_ledger (
    user_convex_id,
    user_id,
    direction,
    credits,
    event_type,
    category,
    note,
    template_title
  ) values (
    email_norm,
    p_user_id,
    'in',
    expected_credits,
    'apple_iap',
    'apple_iap',
    note_text,
    coalesce(pricing_key, trim(p_product_id))
  );

  return jsonb_build_object(
    'status', 'granted',
    'transaction_id', inserted.transaction_id,
    'credits_granted', inserted.credits_granted,
    'product_id', inserted.product_id,
    'granted_at', inserted.granted_at,
    'user_id', inserted.user_id,
    'pricing_key', pricing_key
  );
exception
  when unique_violation then
    select * into existing
    from public.apple_iap_transactions
    where transaction_id = trim(p_transaction_id);

    if found then
      if existing.user_id is distinct from p_user_id
        or existing.product_id is distinct from trim(p_product_id)
        or existing.bundle_id is distinct from trim(p_bundle_id)
        or existing.credits_granted is distinct from expected_credits
        or lower(existing.app_account_token) is distinct from lower(p_user_id::text)
      then
        raise exception 'transaction replay mismatch';
      end if;

      if not exists (
        select 1 from public.credits_ledger cl where cl.note = note_text
      ) then
        insert into public.credits_ledger (
          user_convex_id,
          user_id,
          direction,
          credits,
          event_type,
          category,
          note,
          template_title
        ) values (
          email_norm,
          p_user_id,
          'in',
          expected_credits,
          'apple_iap',
          'apple_iap',
          note_text,
          coalesce(pricing_key, trim(p_product_id))
        );
      end if;

      return jsonb_build_object(
        'status', 'already_processed',
        'transaction_id', existing.transaction_id,
        'credits_granted', existing.credits_granted,
        'product_id', existing.product_id,
        'granted_at', existing.granted_at,
        'user_id', existing.user_id,
        'pricing_key', pricing_key
      );
    end if;
    raise;
end;
$$;

revoke all on function public.grant_apple_iap_credits(
  uuid, text, text, text, text, text, timestamptz, text, text, integer
) from public;
revoke all on function public.grant_apple_iap_credits(
  uuid, text, text, text, text, text, timestamptz, text, text, integer
) from anon, authenticated;
grant execute on function public.grant_apple_iap_credits(
  uuid, text, text, text, text, text, timestamptz, text, text, integer
) to service_role;

-- Idempotent unique index for Apple ledger notes (defense in depth).
create unique index if not exists credits_ledger_apple_iap_note_uidx
  on public.credits_ledger (note)
  where note like 'apple_iap:%';
