# Christmas Planner QA access

No authorized paid QA account or planner test-access grant exists in this repository. The Google-signed-in account that looks Free is a normal unpaid account. Pet-funnel internal test sessions do not unlock Christmas Planner.

## Do not confuse this with payment

`grant_christmas_planner_qa_access` is an explicit service-role grant. It:

- writes `user_entitlements` with `source = 'admin'` and `metadata.qa = true`
- leaves `christmas_order_id` null
- does not insert into `christmas_orders`
- does not set `payment_status`

`get_christmas_planner_access()` then returns `access_source = "qa_grant"` and `payment_fulfilled = false`. The private app shows: “Test access is on for this account. It is not a Stripe payment.”

Stripe fulfillment remains `grant_christmas_planner_entitlements` after a verified paid order. That path is the only proof of payment.

## How to open one isolated QA account

1. Create a new auth user that is not a customer account. Do not reuse the Free account that already has planner data.
2. Apply migration `20260921193000_christmas_planner_qa_access.sql`.
3. With the service role, call:

```sql
select public.grant_christmas_planner_qa_access(
  '<auth.users id>'::uuid,
  'QA for Christmas Planner account journeys'
);
```

The reason must be at least 12 characters. Authenticated clients cannot call this function.

4. Sign in as that user and open `/account/christmas`. Meals, budget, and grocery should unlock. The QA note must stay visible.
5. When finished, remove only that grant:

```sql
select public.revoke_christmas_planner_qa_access('<auth.users id>'::uuid);
```

This does not charge a card and does not mark an order paid.

## Free gift people

Free accounts can add 3 gift people. A row named Household is created by Gift shopping for general presents and does not use one of those 3 places. That is why a Free account can show 4 recipient rows while the limit copy says 3. People already saved above the cap are kept. New gift people are refused until Christmas Planner ($17) is actually entitled.
