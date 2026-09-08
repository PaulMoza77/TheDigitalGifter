#!/usr/bin/env bash
# Generate a photoreal 5s Christmas cabin loop via Replicate Seedance.
# Requires: REPLICATE_API_TOKEN
#
# Usage:
#   REPLICATE_API_TOKEN=... ./scripts/generate-cabin-seedance.sh
#   REPLICATE_API_TOKEN=... ./scripts/generate-cabin-seedance.sh path/to/source.jpg
set -euo pipefail

TOKEN="${REPLICATE_API_TOKEN:-}"
[[ -n "${TOKEN}" ]] || { echo "REPLICATE_API_TOKEN is required" >&2; exit 2; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_SRC="${1:-${ROOT}/public/christmas/cabin-hero-seedance-source.jpg}"
MODEL="${CHRISTMAS_VIDEO_MODEL:-bytedance/seedance-1-pro-fast}"
OUT="${2:-${ROOT}/public/christmas/cabin-hero-loop.mp4}"
OUT720="${OUT%.mp4}-720.mp4"

PROMPT='Ultra-realistic living photograph of this exact Christmas mountain cabin interior. Camera completely fixed, no pan, no zoom, no Ken Burns. Through the panoramic windows: gentle continuous snowfall over snowy pines and mountains, outdoor deck fire pit flames flickering naturally. Indoor stone fireplace: realistic dancing orange flames and soft rising embers. Coffee-table and mantel candle flames flicker subtly. Warm fairy lights on the Christmas tree and mantel garland twinkle softly and feel alive. Preserve exact room layout, furniture, and composition. No text, no UI, no people, no morphing, cinematic HDR, seamless 5-second loop feel.'

upload_image() {
  local path="$1"
  python3 - <<PY
import json, urllib.request, mimetypes, os
token = os.environ["REPLICATE_API_TOKEN"]
path = "${path}"
# Create upload URL
req = urllib.request.Request(
    "https://api.replicate.com/v1/files",
    data=b"",
    headers={"Authorization": f"Bearer {token}"},
    method="POST",
)
# Prefer multipart via curl below — this helper only prints path check
print(path)
PY
  # Replicate file upload (multipart)
  RESP="$(curl -fsS -X POST "https://api.replicate.com/v1/files" \
    -H "Authorization: Bearer ${TOKEN}" \
    -F "content=@${path};type=image/jpeg")"
  python3 - <<PY
import json
data=json.loads('''${RESP}''')
url=data.get("urls",{}).get("get") or data.get("url") or ""
if not url:
    raise SystemExit(f"upload failed: {data}")
print(url)
PY
}

if [[ -f "${LOCAL_SRC}" ]]; then
  echo "Uploading reference ${LOCAL_SRC}"
  IMAGE_URL="$(upload_image "${LOCAL_SRC}")"
else
  IMAGE_URL="${LOCAL_SRC}"
fi
echo "image=${IMAGE_URL}"
echo "Creating Seedance prediction model=${MODEL}"

PAYLOAD="$(python3 - <<PY
import json
print(json.dumps({
  "input": {
    "prompt": """${PROMPT}""",
    "image": """${IMAGE_URL}""",
    "duration": 5,
    "resolution": "1080p",
    "camera_fixed": True,
    "fps": 24,
  }
}))
PY
)"

CREATE="$(curl -fsS -X POST "https://api.replicate.com/v1/models/${MODEL}/predictions" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: wait" \
  -d "${PAYLOAD}")"

ID="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))' <<<"${CREATE}")"
STATUS="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' <<<"${CREATE}")"
echo "prediction=${ID} status=${STATUS}"
PRED="${CREATE}"

for _ in $(seq 1 120); do
  if [[ "${STATUS}" == "succeeded" || "${STATUS}" == "failed" || "${STATUS}" == "canceled" ]]; then
    break
  fi
  sleep 3
  PRED="$(curl -fsS "https://api.replicate.com/v1/predictions/${ID}" -H "Authorization: Bearer ${TOKEN}")"
  STATUS="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' <<<"${PRED}")"
  echo "poll status=${STATUS}"
done

if [[ "${STATUS}" != "succeeded" ]]; then
  echo "Seedance failed: ${PRED}" >&2
  exit 1
fi

URL="$(python3 - <<PY
import json
pred=json.loads('''${PRED}''')
out=pred.get('output')
if isinstance(out,str):
  print(out)
elif isinstance(out,list) and out:
  print(out[0])
elif isinstance(out,dict) and isinstance(out.get('url'),str):
  print(out['url'])
PY
)"
[[ -n "${URL}" ]] || { echo "No output URL: ${PRED}" >&2; exit 1; }

echo "Downloading ${URL}"
curl -fsSL -o "${OUT}" "${URL}"
# Normalize to H.264 faststart + 720p companion
ffmpeg -y -i "${OUT}" -c:v libx264 -pix_fmt yuv420p -preset medium -crf 18 -movflags +faststart -an "${OUT}.tmp.mp4"
mv "${OUT}.tmp.mp4" "${OUT}"
ffmpeg -y -i "${OUT}" -vf 'scale=1280:720' -c:v libx264 -pix_fmt yuv420p -preset medium -crf 20 -movflags +faststart -an "${OUT720}"
echo "Wrote ${OUT} and ${OUT720}"
