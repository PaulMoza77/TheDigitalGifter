-- Enforce share_id (read) ≠ owner_token_hash (write). Additive; no checkout change.

begin;

alter table public.christmas_wishlists
  drop constraint if exists christmas_wishlists_share_owner_distinct_chk;

alter table public.christmas_wishlists
  add constraint christmas_wishlists_share_owner_distinct_chk
  check (owner_token_hash is null or owner_token_hash <> share_id);

comment on constraint christmas_wishlists_share_owner_distinct_chk on public.christmas_wishlists is
  'share_id is public read capability; owner_token_hash is write capability. They must never be equal.';

commit;
