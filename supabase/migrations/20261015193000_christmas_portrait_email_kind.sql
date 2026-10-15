-- Allow commerce portrait delivery emails on christmas_email_deliveries.
-- Additive constraint update only. Does not alter pet tables or prices.

begin;

alter table public.christmas_email_deliveries
  drop constraint if exists christmas_email_deliveries_kind_chk;
alter table public.christmas_email_deliveries
  add constraint christmas_email_deliveries_kind_chk check (
    kind in (
      'starter_ready',
      'magic_ready',
      'ultimate_ready',
      'partial_failure',
      'planner_ready',
      'portrait_ready'
    )
  );

commit;
