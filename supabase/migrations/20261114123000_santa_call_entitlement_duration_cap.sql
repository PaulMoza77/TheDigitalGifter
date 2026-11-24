-- Hotfix: V2 duration_chk capped max_duration_seconds at 600 (one extension only).
-- Required for unlimited paid cumulative extensions (infra ceiling 7200s).

alter table public.christmas_santa_call_entitlements
  drop constraint if exists christmas_santa_call_entitlements_duration_chk;

alter table public.christmas_santa_call_entitlements
  add constraint christmas_santa_call_entitlements_duration_chk
  check (
    max_duration_seconds > 0
    and max_duration_seconds <= 7200
    and remaining_seconds >= 0
    and remaining_seconds <= max_duration_seconds
  );
