-- Christmas Wishlist V2: priorities, media, preferences, reservation activation
-- Additive. Keeps guest-first ownership; does not expose purchaser identity.

begin;

-- Priority: add really_want (playful importance ladder)
alter table public.christmas_wishlist_items
  drop constraint if exists christmas_wishlist_items_priority_chk;
alter table public.christmas_wishlist_items
  add constraint christmas_wishlist_items_priority_chk check (
    priority in ('really_want', 'would_love', 'nice_to_have', 'surprise_me')
  );

-- Optional product image + quantity + preference details
alter table public.christmas_wishlist_items
  add column if not exists image_url text,
  add column if not exists quantity integer not null default 1,
  add column if not exists preference_size text not null default '',
  add column if not exists preference_color text not null default '',
  add column if not exists reserved_at timestamptz,
  add column if not exists purchased_at timestamptz;

alter table public.christmas_wishlist_items
  drop constraint if exists christmas_wishlist_items_qty_chk;
alter table public.christmas_wishlist_items
  add constraint christmas_wishlist_items_qty_chk check (quantity between 1 and 20);

alter table public.christmas_wishlist_items
  drop constraint if exists christmas_wishlist_items_pref_size_chk;
alter table public.christmas_wishlist_items
  add constraint christmas_wishlist_items_pref_size_chk check (char_length(preference_size) <= 40);

alter table public.christmas_wishlist_items
  drop constraint if exists christmas_wishlist_items_pref_color_chk;
alter table public.christmas_wishlist_items
  add constraint christmas_wishlist_items_pref_color_chk check (char_length(preference_color) <= 40);

alter table public.christmas_wishlist_items
  drop constraint if exists christmas_wishlist_items_image_chk;
alter table public.christmas_wishlist_items
  add constraint christmas_wishlist_items_image_chk check (
    image_url is null
    or (
      char_length(image_url) <= 500
      and image_url ~* '^https?://'
      and image_url !~* '^(javascript|data|vbscript):'
    )
  );

-- Audience hint for creation flow (me / child / family / someone_else)
alter table public.christmas_wishlists
  add column if not exists audience text not null default 'me';

alter table public.christmas_wishlists
  drop constraint if exists christmas_wishlists_audience_chk;
alter table public.christmas_wishlists
  add constraint christmas_wishlists_audience_chk check (
    audience in ('me', 'child', 'family', 'someone_else')
  );

comment on column public.christmas_wishlist_items.reservation_status is
  'Viewer coordination: none|reserved|purchased. Identity never stored — only opaque reservation_token_hash.';
comment on column public.christmas_wishlists.audience is
  'Who the wishlist is for. Soft metadata for UX; not required for sharing.';

commit;
