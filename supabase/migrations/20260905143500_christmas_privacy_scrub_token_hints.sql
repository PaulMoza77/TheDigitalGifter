-- Christmas privacy harden: scrub plaintext delivery tokens from order metadata.
-- Backward-compatible: public_token_hash remains auth gate; ciphertext is recovery store.
-- Does not delete customer media or drop tables.

-- Remove capability tokens mistakenly stored as metadata.public_token_hint
update public.christmas_orders
set
  metadata = coalesce(metadata, '{}'::jsonb) - 'public_token_hint' - 'public_token' - 'delivery_token' - 'owner_token',
  updated_at = now()
where metadata ? 'public_token_hint'
   or metadata ? 'public_token'
   or metadata ? 'delivery_token'
   or metadata ? 'owner_token';

comment on column public.christmas_orders.public_token_hash is
  'SHA-256 of high-entropy delivery token. Auth gate for getOrder; never store plaintext token in metadata.';

comment on column public.christmas_orders.public_token_ciphertext is
  'Soft-encoded delivery token for server-side email recovery only. Prefer this over metadata hints.';

-- Retention policy marker (no automatic purge without founder/legal clearance)
comment on table public.christmas_orders is
  'Christmas commerce orders. Media retention: policy_pending_founder_legal. Paid outputs must not be auto-purged without product promise + legal OK.';
