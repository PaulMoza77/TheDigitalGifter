#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"
MIGRATION="supabase/migrations/20260909190000_christmas_generation_result_share.sql"
SUPABASE_URL="${SUPABASE_URL:-https://${PROJECT_REF}.supabase.co}"
FUNCTION_URL="${SUPABASE_URL%/}/functions/v1/christmas-result-share"

[[ "$PROJECT_REF" == "kjlsocejpmnzhhduyumy" ]] || { echo "BLOCKED: unexpected project $PROJECT_REF"; exit 2; }
[[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]] || { echo "BLOCKED: SUPABASE_ACCESS_TOKEN missing"; exit 2; }
[[ -f "$MIGRATION" ]] || { echo "BLOCKED: migration missing"; exit 2; }

mgmt_sql() {
  local sql="$1" out="$2" payload code
  payload="$(node -e 'process.stdout.write(JSON.stringify({query:process.argv[1]}))' -- "$sql")"
  code="$(curl -sS -o "$out" -w '%{http_code}' -X POST \
    "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" -d "$payload")"
  [[ "$code" == "200" || "$code" == "201" ]] || { echo "Management SQL failed HTTP $code"; cat "$out"; exit 2; }
}

mgmt_sql "$(cat "$MIGRATION")" /tmp/result-share-migration.json
echo "Migration applied."

npx --yes supabase functions deploy christmas-result-share \
  --project-ref "$PROJECT_REF" --no-verify-jwt
echo "Edge function deployed."

VERIFY_SQL="select c.relrowsecurity as rls_enabled,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='christmas_generation_shares' and column_name='share_token_hash') as hash_column,
  not exists(select 1 from information_schema.columns where table_schema='public' and table_name='christmas_generation_shares' and column_name='share_token_ciphertext') as no_ciphertext,
  has_table_privilege('anon','public.christmas_generation_shares','SELECT') as anon_select,
  has_table_privilege('authenticated','public.christmas_generation_shares','SELECT') as authenticated_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='christmas_generation_shares';"
mgmt_sql "$VERIFY_SQL" /tmp/result-share-schema.json
cat /tmp/result-share-schema.json
node - <<'NODE'
const fs=require('fs'); const x=JSON.parse(fs.readFileSync('/tmp/result-share-schema.json','utf8')); const r=Array.isArray(x)?x[0]:x;
if(!r || r.rls_enabled!==true || r.hash_column!==true || r.no_ciphertext!==true || r.anon_select!==false || r.authenticated_select!==false) process.exit(2);
NODE
echo "Schema/RLS verification PASS."

# Remove only fixtures from prior interrupted smoke runs.
mgmt_sql "delete from public.christmas_orders where metadata->>'source'='christmas-result-share-smoke';" /tmp/result-share-precleanup.json
echo "Prior synthetic fixtures cleaned."

SAFE_ASSET_SQL="select a.storage_path
from public.christmas_order_assets a
join public.christmas_orders o on o.id=a.order_id
where a.storage_bucket='christmas-generated'
  and a.storage_path is not null
  and (a.storage_path like 'smoke/%' or coalesce(o.metadata->>'is_test','false')='true')
order by a.created_at desc limit 1;"
mgmt_sql "$SAFE_ASSET_SQL" /tmp/result-share-safe-asset.json
SAFE_PATH="$(node -e "const x=require('/tmp/result-share-safe-asset.json'); const r=Array.isArray(x)?x[0]:x; process.stdout.write(r?.storage_path||'')")"
if [[ -z "$SAFE_PATH" ]]; then SAFE_PATH="smoke/result-share-no-object"; fi
SAFE_PATH_SQL="$(printf '%s' "$SAFE_PATH" | sed "s/'/''/g")"

SMOKE_TOKEN="$(openssl rand -hex 24)"
SMOKE_HASH="$(node -e "const c=require('crypto');process.stdout.write(c.createHash('sha256').update(process.argv[1]).digest('hex'))" "$SMOKE_TOKEN")"
SMOKE_B64="$(printf '%s' "$SMOKE_TOKEN" | base64 | tr -d '\n')"
ORDER_ID="$(node -e 'process.stdout.write(require("crypto").randomUUID())')"
ASSET_ID="$(node -e 'process.stdout.write(require("crypto").randomUUID())')"

cleanup() {
  local sql payload code
  sql="delete from public.christmas_orders where id='${ORDER_ID}'::uuid and metadata->>'source'='christmas-result-share-smoke';"
  payload="$(node -e 'process.stdout.write(JSON.stringify({query:process.argv[1]}))' -- "$sql")"
  code="$(curl -sS -o /tmp/result-share-cleanup.json -w '%{http_code}' -X POST \
    "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" -H "Content-Type: application/json" -d "$payload" || true)"
  echo "Smoke cleanup HTTP $code"
}
trap cleanup EXIT

FIXTURE_SQL="begin;
insert into public.christmas_orders
  (id,public_token_hash,public_token_ciphertext,product_key,package_key,sku,currency,amount_cents,payment_status,fulfillment_status,paid_at,fulfillment_completed_at,style_key,metadata)
values
  ('${ORDER_ID}'::uuid,'${SMOKE_HASH}','${SMOKE_B64}','christmas_photo','smoke_result_share','smoke_result_share','usd',0,'paid','completed',now(),now(),'smoke','{\"is_test\":true,\"source\":\"christmas-result-share-smoke\"}'::jsonb);
insert into public.christmas_order_assets
  (id,order_id,asset_kind,storage_bucket,storage_path,metadata)
values
  ('${ASSET_ID}'::uuid,'${ORDER_ID}'::uuid,'other','christmas-generated','${SAFE_PATH_SQL}','{\"style_key\":\"smoke\"}'::jsonb);
update public.christmas_orders set result_asset_id='${ASSET_ID}'::uuid where id='${ORDER_ID}'::uuid;
commit;"
mgmt_sql "$FIXTURE_SQL" /tmp/result-share-fixture.json

CHECK_SQL="select o.id as order_id,a.id as asset_id
from public.christmas_orders o join public.christmas_order_assets a on a.order_id=o.id
where o.id='${ORDER_ID}'::uuid and a.id='${ASSET_ID}'::uuid and o.result_asset_id=a.id
  and o.metadata->>'source'='christmas-result-share-smoke';"
mgmt_sql "$CHECK_SQL" /tmp/result-share-fixture-check.json
node - <<'NODE'
const x=require('/tmp/result-share-fixture-check.json'); if(!Array.isArray(x) || x.length!==1 || !x[0].order_id || !x[0].asset_id) process.exit(2);
NODE
echo "Synthetic fixture PASS."

post_share() {
  local body="$1" out="$2" expected="$3" code
  code="$(curl -sS -o "$out" -w '%{http_code}' -X POST "$FUNCTION_URL" -H 'Content-Type: application/json' -d "$body")"
  [[ "$code" == "$expected" ]] || { echo "Function smoke expected $expected got $code"; cat "$out"; exit 2; }
}

post_share "{\"action\":\"enableShare\",\"public_token\":\"${SMOKE_TOKEN}\"}" /tmp/result-share-enable.json 200
GEN_ID="$(node -e "const x=require('/tmp/result-share-enable.json');process.stdout.write(x.generation_id||'')")"
SHARE_TOKEN="$(node -e "const x=require('/tmp/result-share-enable.json');process.stdout.write(x.share_token||'')")"
[[ -n "$GEN_ID" && ${#SHARE_TOKEN} -ge 32 ]] || { echo "Enable smoke failed"; cat /tmp/result-share-enable.json; exit 2; }

post_share "{\"action\":\"getOwnerShare\",\"public_token\":\"${SMOKE_TOKEN}\"}" /tmp/result-share-owner-enabled.json 200
node - <<'NODE'
const x=require('/tmp/result-share-owner-enabled.json'); if(x.ok!==true || x.share_enabled!==true || !x.generation_id) process.exit(2);
NODE

if [[ "$SAFE_PATH" != "smoke/result-share-no-object" ]]; then
  post_share "{\"action\":\"getSharedResult\",\"generation_id\":\"${GEN_ID}\",\"token\":\"${SHARE_TOKEN}\"}" /tmp/result-share-open.json 200
  node - <<'NODE'
const x=require('/tmp/result-share-open.json'); if(x.ok!==true || !x.resultUrl || !x.generation_id) process.exit(2);
NODE
  echo "Public open smoke PASS using pre-existing test/smoke asset."
else
  post_share "{\"action\":\"getSharedResult\",\"generation_id\":\"${GEN_ID}\",\"token\":\"not-a-valid-capability-token\"}" /tmp/result-share-invalid-open.json 404
  echo "No pre-existing test storage object; positive signed-asset open skipped, token gate PASS."
fi

post_share "{\"action\":\"revokeShare\",\"public_token\":\"${SMOKE_TOKEN}\"}" /tmp/result-share-revoke.json 200
post_share "{\"action\":\"getOwnerShare\",\"public_token\":\"${SMOKE_TOKEN}\"}" /tmp/result-share-owner-revoked.json 200
node - <<'NODE'
const x=require('/tmp/result-share-owner-revoked.json'); if(x.ok!==true || x.share_enabled!==false) process.exit(2);
NODE
post_share "{\"action\":\"getSharedResult\",\"generation_id\":\"${GEN_ID}\",\"token\":\"${SHARE_TOKEN}\"}" /tmp/result-share-revoked-open.json 404

echo "RESULT_SHARE_SMOKE_PASS enable=PASS owner_state=PASS revoke=PASS old_link_denied=PASS"
