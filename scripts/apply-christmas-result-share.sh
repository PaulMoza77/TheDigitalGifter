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
[[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]] || { echo "BLOCKED: SUPABASE_SERVICE_ROLE_KEY missing"; exit 2; }
[[ -f "$MIGRATION" ]] || { echo "BLOCKED: migration missing"; exit 2; }

mgmt_sql() {
  local sql="$1" out="$2" payload code
  payload="$(node -e 'process.stdout.write(JSON.stringify({query:process.argv[1]}))' "$sql")"
  code="$(curl -sS -o "$out" -w '%{http_code}' -X POST \
    "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" -d "$payload")"
  [[ "$code" == "200" || "$code" == "201" ]] || { echo "Management SQL failed HTTP $code"; cat "$out"; exit 2; }
}

SQL="$(cat "$MIGRATION")"
mgmt_sql "$SQL" /tmp/result-share-migration.json
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

SMOKE_TOKEN="$(openssl rand -hex 24)"
SMOKE_HASH="$(node -e "const c=require('crypto');process.stdout.write(c.createHash('sha256').update(process.argv[1]).digest('hex'))" "$SMOKE_TOKEN")"
SMOKE_B64="$(printf '%s' "$SMOKE_TOKEN" | base64 | tr -d '\n')"
SMOKE_PATH="smoke/result-share-$(date +%s)-${RANDOM}.txt"
ORDER_ID=""
ASSET_ID=""

cleanup() {
  if [[ -n "$ORDER_ID" ]]; then
    mgmt_sql "delete from public.christmas_orders where id='${ORDER_ID}'::uuid and metadata->>'source'='christmas-result-share-smoke';" /tmp/result-share-cleanup-db.json || true
  fi
  curl -sS -o /tmp/result-share-cleanup-storage.json -X DELETE \
    "${SUPABASE_URL%/}/storage/v1/object/christmas-generated/${SMOKE_PATH}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" >/dev/null || true
}
trap cleanup EXIT

FIXTURE_SQL="with o as (
  insert into public.christmas_orders
    (public_token_hash,public_token_ciphertext,product_key,package_key,sku,currency,amount_cents,payment_status,fulfillment_status,paid_at,fulfillment_completed_at,style_key,metadata)
  values
    ('${SMOKE_HASH}','${SMOKE_B64}','christmas_photo','smoke_result_share','smoke_result_share','usd',0,'paid','completed',now(),now(),'smoke','{\"is_test\":true,\"source\":\"christmas-result-share-smoke\"}'::jsonb)
  returning id
), a as (
  insert into public.christmas_order_assets(order_id,asset_kind,storage_bucket,storage_path,metadata)
  select id,'other','christmas-generated','${SMOKE_PATH}','{\"style_key\":\"smoke\"}'::jsonb from o
  returning id,order_id
), u as (
  update public.christmas_orders x set result_asset_id=a.id from a where x.id=a.order_id returning x.id
)
select u.id as order_id,a.id as asset_id from u join a on a.order_id=u.id;"
mgmt_sql "$FIXTURE_SQL" /tmp/result-share-fixture.json
ORDER_ID="$(node -e "const x=require('/tmp/result-share-fixture.json'); const r=Array.isArray(x)?x[0]:x; process.stdout.write(r?.order_id||'')")"
ASSET_ID="$(node -e "const x=require('/tmp/result-share-fixture.json'); const r=Array.isArray(x)?x[0]:x; process.stdout.write(r?.asset_id||'')")"
[[ -n "$ORDER_ID" && -n "$ASSET_ID" ]] || { echo "Fixture creation failed"; cat /tmp/result-share-fixture.json; exit 2; }

echo -n 'TDG Christmas result-share synthetic smoke asset' >/tmp/result-share-smoke.txt
UPLOAD_CODE="$(curl -sS -o /tmp/result-share-upload.json -w '%{http_code}' -X POST \
  "${SUPABASE_URL%/}/storage/v1/object/christmas-generated/${SMOKE_PATH}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: text/plain" -H "x-upsert: true" --data-binary @/tmp/result-share-smoke.txt)"
[[ "$UPLOAD_CODE" == "200" || "$UPLOAD_CODE" == "201" ]] || { echo "Storage upload failed HTTP $UPLOAD_CODE"; cat /tmp/result-share-upload.json; exit 2; }

post_share() {
  local body="$1" out="$2" expected="$3" code
  code="$(curl -sS -o "$out" -w '%{http_code}' -X POST "$FUNCTION_URL" -H 'Content-Type: application/json' -d "$body")"
  [[ "$code" == "$expected" ]] || { echo "Function smoke expected $expected got $code"; cat "$out"; exit 2; }
}

post_share "{\"action\":\"enableShare\",\"public_token\":\"${SMOKE_TOKEN}\"}" /tmp/result-share-enable.json 200
GEN_ID="$(node -e "const x=require('/tmp/result-share-enable.json');process.stdout.write(x.generation_id||'')")"
SHARE_TOKEN="$(node -e "const x=require('/tmp/result-share-enable.json');process.stdout.write(x.share_token||'')")"
[[ -n "$GEN_ID" && ${#SHARE_TOKEN} -ge 32 ]] || { echo "Enable smoke failed"; cat /tmp/result-share-enable.json; exit 2; }

post_share "{\"action\":\"getSharedResult\",\"generation_id\":\"${GEN_ID}\",\"token\":\"${SHARE_TOKEN}\"}" /tmp/result-share-open.json 200
node - <<'NODE'
const x=require('/tmp/result-share-open.json'); if(x.ok!==true || !x.resultUrl || x.generation_id==null) process.exit(2);
NODE

post_share "{\"action\":\"revokeShare\",\"public_token\":\"${SMOKE_TOKEN}\"}" /tmp/result-share-revoke.json 200
node - <<'NODE'
const x=require('/tmp/result-share-revoke.json'); if(x.ok!==true || x.share_enabled!==false) process.exit(2);
NODE

post_share "{\"action\":\"getSharedResult\",\"generation_id\":\"${GEN_ID}\",\"token\":\"${SHARE_TOKEN}\"}" /tmp/result-share-revoked.json 404
node - <<'NODE'
const x=require('/tmp/result-share-revoked.json'); if(x.error!=='unavailable') process.exit(2);
NODE

echo "RESULT_SHARE_SMOKE_PASS enable=open=revoke=old_link_denied"
