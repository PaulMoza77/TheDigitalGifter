-- Christmas V2 pack finalization that waits for purchased videos before marking complete.
-- Additive: creates/replaces christmas_v2_finalize_generation_if_done against christmas_v2_* tables.
-- Does not alter LIVE Stripe, prices, or customer rows.

set lock_timeout = '5s';
set statement_timeout = '60s';

begin;

create or replace function public.christmas_v2_finalize_generation_if_done(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.christmas_v2_orders%rowtype;
  scene_total int := 0;
  scene_succeeded int := 0;
  scene_failed int := 0;
  video_total int := 0;
  video_succeeded int := 0;
  video_failed int := 0;
  video_expected int := 0;
  images_done boolean := false;
  videos_done boolean := false;
  ready_for_email boolean := false;
  final_status text;
begin
  select * into order_row from public.christmas_v2_orders where id = p_order_id for update;
  if not found then
    raise exception 'christmas v2 order not found';
  end if;

  video_expected := greatest(coalesce(order_row.video_count, 0), 0);

  select count(*) into scene_total
  from public.christmas_v2_order_scenes where order_id = p_order_id;
  select count(*) into scene_succeeded
  from public.christmas_v2_order_scenes
  where order_id = p_order_id and status in ('succeeded', 'ready');
  select count(*) into scene_failed
  from public.christmas_v2_order_scenes
  where order_id = p_order_id and status = 'failed';

  if scene_total = 0 then
    return jsonb_build_object(
      'done', false,
      'images_done', false,
      'videos_done', false,
      'ready_for_email', false,
      'should_enqueue_video', false
    );
  end if;

  images_done := (scene_succeeded + scene_failed) >= scene_total;
  if not images_done then
    return jsonb_build_object(
      'done', false,
      'images_done', false,
      'videos_done', false,
      'ready_for_email', false,
      'should_enqueue_video', false,
      'succeeded', scene_succeeded,
      'failed', scene_failed,
      'total', scene_total,
      'video_expected', video_expected
    );
  end if;

  -- Images finished; if pack includes videos, wait for video rows to finish.
  if video_expected > 0 then
    select count(*) into video_total
    from public.christmas_v2_order_videos where order_id = p_order_id;
    select count(*) into video_succeeded
    from public.christmas_v2_order_videos
    where order_id = p_order_id and status in ('succeeded', 'ready');
    select count(*) into video_failed
    from public.christmas_v2_order_videos
    where order_id = p_order_id and status = 'failed';

    if video_total < video_expected or (video_succeeded + video_failed) < video_total then
      update public.christmas_v2_orders
      set
        status = case when scene_succeeded > 0 then 'generating' else 'partial_failure' end,
        updated_at = now()
      where id = p_order_id;

      return jsonb_build_object(
        'done', false,
        'images_done', true,
        'videos_done', false,
        'ready_for_email', false,
        'should_enqueue_video', true,
        'succeeded', scene_succeeded,
        'failed', scene_failed,
        'total', scene_total,
        'video_expected', video_expected,
        'video_total', video_total,
        'video_succeeded', video_succeeded,
        'video_failed', video_failed
      );
    end if;

    videos_done := true;
  else
    videos_done := true;
  end if;

  if scene_succeeded = 0 and (video_expected = 0 or video_succeeded = 0) then
    final_status := 'failed';
    ready_for_email := false;
  elsif scene_failed > 0 or (video_expected > 0 and video_failed > 0) then
    final_status := 'partial_failure';
    ready_for_email := scene_succeeded > 0 or video_succeeded > 0;
  else
    final_status := 'complete';
    ready_for_email := true;
  end if;

  update public.christmas_v2_orders
  set
    status = final_status,
    generation_finished_at = now(),
    completed_at = case when final_status = 'complete' then now() else completed_at end,
    updated_at = now()
  where id = p_order_id;

  update public.christmas_v2_generation_jobs
  set
    status = case when final_status = 'failed' then 'failed' else 'completed' end,
    finished_at = now(),
    updated_at = now()
  where order_id = p_order_id;

  return jsonb_build_object(
    'done', true,
    'images_done', true,
    'videos_done', videos_done,
    'ready_for_email', ready_for_email,
    'should_enqueue_video', false,
    'status', final_status,
    'succeeded', scene_succeeded,
    'failed', scene_failed,
    'total', scene_total,
    'video_expected', video_expected,
    'video_succeeded', video_succeeded,
    'video_failed', video_failed
  );
end;
$$;

revoke all on function public.christmas_v2_finalize_generation_if_done(uuid)
  from anon, authenticated, public;
grant execute on function public.christmas_v2_finalize_generation_if_done(uuid)
  to service_role;

-- Idempotent unique guard for video source keys per order (prevents duplicate jobs on retries).
do $$
begin
  if to_regclass('public.christmas_v2_order_videos') is not null then
    create unique index if not exists christmas_v2_order_videos_order_source_uidx
      on public.christmas_v2_order_videos (order_id, source_scene_key);
  end if;
end $$;

commit;
