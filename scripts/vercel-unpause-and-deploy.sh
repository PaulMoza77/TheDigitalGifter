#!/usr/bin/env bash
# ROLLBACK ONLY. TDG production origin is Mozas VPS.
# Do not use this for routine deploys. Existing Vercel deployments stay until
# the founder confirms a live payment.
# Requires: VERCEL_TOKEN with access to team tdg6
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TOKEN="${VERCEL_TOKEN:-${VERCEL_ACCESS_TOKEN:-}}"
if [[ -z "$TOKEN" ]]; then
  echo "BLOCKED: VERCEL_TOKEN is not set."
  echo "Create one at https://vercel.com/account/settings/tokens"
  echo "Add to GitHub Production secrets as VERCEL_TOKEN."
  exit 2
fi

auth() { curl -sS -H "Authorization: Bearer $TOKEN" "$@"; }

TEAM_ID="${VERCEL_ORG_ID:-${VERCEL_TEAM_ID:-}}"
if [[ -z "$TEAM_ID" ]]; then
  echo "Resolving Vercel team id for slug tdg6…"
  TEAM_ID="$(auth "https://api.vercel.com/v2/teams" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      const j=JSON.parse(d||'{}');
      const t=(j.teams||[]).find(x=>x.slug==='tdg6'||x.name==='tdg6');
      if(t&&t.id) console.log(t.id);
    });
  ")"
fi

PROJECT="${VERCEL_PROJECT_NAME:-the-digital-gifter}"
PROJECT_ID="${VERCEL_PROJECT_ID:-}"
if [[ -z "$PROJECT_ID" ]]; then
  echo "Resolving project id for $PROJECT…"
  if [[ -n "$TEAM_ID" ]]; then
    PROJECT_ID="$(auth "https://api.vercel.com/v9/projects/${PROJECT}?teamId=${TEAM_ID}" | node -e "
      let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
        try { const j=JSON.parse(d); if(j.id) console.log(j.id); } catch {}
      });
    ")"
  else
    PROJECT_ID="$(auth "https://api.vercel.com/v9/projects/${PROJECT}" | node -e "
      let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
        try { const j=JSON.parse(d); if(j.id) console.log(j.id); } catch {}
      });
    ")"
  fi
fi

unpause_project() {
  local id="$1"
  local name="$2"
  [[ -z "$id" ]] && return 0
  echo "Unpausing project ${name} (${id})…"
  local qs=""
  [[ -n "$TEAM_ID" ]] && qs="?teamId=${TEAM_ID}"
  auth -X POST "https://api.vercel.com/v1/projects/${id}/unpause${qs}" >/dev/null || true
}

unpause_project "$PROJECT_ID" "$PROJECT"

# Secondary preview project (optional)
PREVIEW_ID="$(auth "https://api.vercel.com/v9/projects/the-digital-gifter-d5vu${TEAM_ID:+?teamId=${TEAM_ID}}" | node -e "
  let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
    try { const j=JSON.parse(d); if(j.id) console.log(j.id); } catch {}
  });
" 2>/dev/null || true)"
unpause_project "$PREVIEW_ID" "the-digital-gifter-d5vu"

echo "Building frontend…"
npm run build

echo "Deploying production to Vercel…"
DEPLOY_ARGS=(deploy --prebuilt --prod --yes --token "$TOKEN")
[[ -n "$TEAM_ID" ]] && DEPLOY_ARGS+=(--scope "$TEAM_ID")
[[ -n "$PROJECT_ID" ]] && DEPLOY_ARGS+=(--project "$PROJECT_ID")

npx --yes vercel "${DEPLOY_ARGS[@]}"
echo "Vercel production deploy complete. Live: https://www.thedigitalgifter.com"
