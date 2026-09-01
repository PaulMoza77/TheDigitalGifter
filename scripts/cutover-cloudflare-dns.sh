#!/usr/bin/env bash
# Point thedigitalgifter.com + www to VPS (Cloudflare DNS API).
# Requires: CLOUDFLARE_API_TOKEN (Zone.DNS Edit), CLOUDFLARE_ZONE_ID or zone lookup.
# Optional: VPS_ORIGIN_IP (defaults to VPS_HOST env).
set -euo pipefail

TOKEN="${CLOUDFLARE_API_TOKEN:-}"
ZONE="${CLOUDFLARE_ZONE_ID:-}"
ORIGIN="${VPS_ORIGIN_IP:-${VPS_HOST:-}}"
DOMAIN="${CLOUDFLARE_ZONE_NAME:-thedigitalgifter.com}"

if [[ -z "$TOKEN" || -z "$ORIGIN" ]]; then
  echo "BLOCKED: set CLOUDFLARE_API_TOKEN and VPS_ORIGIN_IP (or VPS_HOST)."
  exit 2
fi

auth=( -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" )

if [[ -z "$ZONE" ]]; then
  ZONE="$(curl -sS "${auth[@]}" "https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      const j=JSON.parse(d||'{}');
      const id=j?.result?.[0]?.id;
      if(!id){ process.exit(2); }
      console.log(id);
    });
  ")"
fi

echo "Zone $ZONE → origin $ORIGIN (proxied A records for @ and www)"

upsert_a() {
  local name="$1"
  local list
  list="$(curl -sS "${auth[@]}" "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records?type=A&name=${name}")"
  local id
  id="$(echo "$list" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      const j=JSON.parse(d||'{}');
      console.log(j?.result?.[0]?.id||'');
    });
  ")"
  local body
  body="$(node -e "console.log(JSON.stringify({type:'A',name:'$name',content:'$ORIGIN',proxied:true,ttl:1}))")"
  if [[ -n "$id" ]]; then
    curl -sS -X PUT "${auth[@]}" -d "$body" \
      "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records/${id}" >/dev/null
    echo "Updated A $name"
  else
    curl -sS -X POST "${auth[@]}" -d "$body" \
      "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records" >/dev/null
    echo "Created A $name"
  fi
}

# Remove Vercel CNAME on www if present (A record replaces it).
upsert_a "$DOMAIN"
upsert_a "www.${DOMAIN}"
echo "Cloudflare DNS cutover complete. Allow ~2 minutes, then verify: curl -sSI https://www.${DOMAIN}/ | head"
