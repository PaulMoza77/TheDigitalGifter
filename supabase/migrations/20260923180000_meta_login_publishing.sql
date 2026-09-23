-- Extend the existing social publisher for Facebook Login for Business
-- and photo/video/Reel targets. Does not add a second account or job table.

begin;

alter table public.social_oauth_states
  add column if not exists oauth_redirect_uri text;

alter table public.social_publication_targets
  add column if not exists provider_container_id text;

alter table public.social_publication_targets
  drop constraint if exists social_publication_targets_platform_check;

alter table public.social_publication_targets
  add constraint social_publication_targets_platform_check
  check (platform in (
    'instagram_reels',
    'instagram_photo',
    'instagram_video',
    'facebook_reels',
    'facebook_photo',
    'facebook_video',
    'tiktok',
    'youtube_shorts'
  ));

commit;
