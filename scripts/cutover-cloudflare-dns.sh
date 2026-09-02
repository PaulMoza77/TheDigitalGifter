#!/usr/bin/env bash
# Point thedigitalgifter.com + www to the Mozas VPS (Cloudflare DNS API).
# Requires: CLOUDFLARE_API_TOKEN (Zone.DNS Edit).
# Origin is MOZAS_ORIGIN_IP or MOZAS_SSH_HOST. Preserves MX and unrelated records.
# Does not use VPS_*.
set -euo pipefail

TOKEN="${CLOUDFLARE_API_TOKEN:-}"
ZONE="${CLOUDFLARE_ZONE_ID:-}"
ORIGIN="${MOZAS_ORIGIN_IP:-${MOZAS_SSH_HOST:-}}"
DOMAIN="${CLOUDFLARE_ZONE_NAME:-thedigitalgifter.com}"

if [[ -z "$TOKEN" ]]; then
  echo "BLOCKED: CLOUDFLARE_API_TOKEN is missing. DNS cutover not performed."
  exit 2
fi
if [[ -z "${ORIGIN}" ]]; then
  echo "BLOCKED: set MOZAS_ORIGIN_IP or MOZAS_SSH_HOST to the authorized VPS address."
  exit 2
fi

auth=( -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" )

cf_json() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local tmp
  tmp="$(mktemp)"
  local code
  if [[ -n "${data}" ]]; then
    code="$(curl -sS -o "${tmp}" -w "%{http_code}" -X "${method}" "${auth[@]}" -d "${data}" "${url}")"
  else
    code="$(curl -sS -o "${tmp}" -w "%{http_code}" -X "${method}" "${auth[@]}" "${url}")"
  fi
  if [[ "${code}" -lt 200 || "${code}" -ge 300 ]]; then
    echo "Cloudflare HTTP ${code} for ${method} ${url}" >&2
    rm -f "${tmp}"
    return 1
  fi
  node -e "
    const fs=require('fs');
    const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8')||'{}');
    if (j.success !== true) {
      console.error('Cloudflare success=false');
      process.exit(2);
    }
    process.stdout.write(JSON.stringify(j));
  " "${tmp}"
  local rc=$?
  rm -f "${tmp}"
  return $rc
}

if [[ -z "$ZONE" ]]; then
  ZONE="$(cf_json GET "https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}" \
    | node -e "
      let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
        const j=JSON.parse(d||'{}');
        const id=j?.result?.[0]?.id;
        if(!id){ process.exit(2); }
        process.stdout.write(id);
      });
    ")"
fi

echo "Zone ${ZONE} → origin ${ORIGIN} (proxied A for @ and www). Email records are not modified."

list_type() {
  local type="$1"
  local name="$2"
  cf_json GET "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records?type=${type}&name=${name}"
}

upsert_a() {
  local name="$1"
  local cname
  cname="$(list_type CNAME "${name}")"
  node -e "
    const j=JSON.parse(process.argv[1]||'{}');
    for (const rec of j.result||[]) {
      if (rec.type==='CNAME') process.stdout.write(rec.id+'\\n');
    }
  " "${cname}" | while read -r cid; do
    [[ -z "${cid}" ]] && continue
    echo "Removing conflicting CNAME ${name} (${cid})"
    cf_json DELETE "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records/${cid}" >/dev/null
  done

  local existing
  existing="$(list_type A "${name}")"
  local id
  id="$(echo "${existing}" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      const j=JSON.parse(d||'{}');
      process.stdout.write(j?.result?.[0]?.id||'');
    });
  ")"
  local body
  body="$(node -e "console.log(JSON.stringify({type:'A',name:'${name}',content:'${ORIGIN}',proxied:true,ttl:1}))")"
  if [[ -n "${id}" ]]; then
    cf_json PUT "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records/${id}" "${body}" >/dev/null
    echo "Updated A ${name}"
  else
    cf_json POST "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records" "${body}" >/dev/null
    echo "Created A ${name}"
  fi
}

verify_records() {
  local name="$1"
  local a
  a="$(list_type A "${name}")"
  echo "${a}" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      const j=JSON.parse(d||'{}');
      const recs=j.result||[];
      if (!recs.length) { console.error('missing A ${name}'); process.exit(2); }
      for (const rec of recs) {
        if (rec.content !== '${ORIGIN}') {
          console.error('A ${name} content mismatch');
          process.exit(2);
        }
        console.log('verified A ${name} -> ' + rec.content + ' proxied=' + rec.proxied);
      }
    });
  "
  local aaaa
  aaaa="$(list_type AAAA "${name}" || true)"
  echo "${aaaa}" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      const j=JSON.parse(d||'{}');
      const recs=j.result||[];
      if (recs.length) {
        console.log('NOTE: AAAA records still present for ${name} (' + recs.length + ') — review if unexpected');
      } else {
        console.log('verified no AAAA for ${name}');
      }
    });
  "
}

mkdir -p docs/audits
{
  echo "# DNS snapshot before TDG cutover $(date -u +%FT%TZ)"
  echo
  echo "Origin target: ${ORIGIN}"
  echo
  (command -v dig >/dev/null && dig +noall +answer "${DOMAIN}" A "${DOMAIN}" AAAA "${DOMAIN}" MX "www.${DOMAIN}" A "www.${DOMAIN}" AAAA "www.${DOMAIN}" CNAME) || true
} >"docs/audits/tdg-dns-before-cutover.txt"

upsert_a "${DOMAIN}"
upsert_a "www.${DOMAIN}"
verify_records "${DOMAIN}"
verify_records "www.${DOMAIN}"

echo "Cloudflare DNS cutover complete. Allow propagation, then verify HTTPS on www.${DOMAIN}."
echo "Rollback DNS: restore the A/CNAME values saved in docs/audits/tdg-dns-before-cutover.txt (Vercel remains available)."
