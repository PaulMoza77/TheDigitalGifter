#!/usr/bin/env bash
# Generate a realistic 5s Christmas cabin loop via Replicate Seedance.
# Requires: REPLICATE_API_TOKEN
set -euo pipefail

TOKEN="${REPLICATE_API_TOKEN:-}"
[[ -n "${TOKEN}" ]] || { echo "REPLICATE_API_TOKEN is required" >&2; exit 2; }

IMAGE_URL="${1:-https://www.thedigitalgifter.com/christmas/cabin-hero-1920.jpg}"
MODEL="${CHRISTMAS_VIDEO_MODEL:-bytedance/seedance-1-pro-fast}"
OUT="${2:-public/christmas/cabin-hero-loop.mp4}"
OUT720="${OUT%.mp4}-720.mp4"

PROMPT='Photoreal living Christmas cabin interior, camera fixed. Outside the panoramic windows, gentle continuous snowfall drifts over snowy mountains and the wooden deck. The stone fireplace fire burns with realistic flickering orange flames and soft rising embers. The outdoor fire pit on the deck also flickers naturally. Candle flames on the coffee table and mantel dance subtly. Warm fairy lights on the Christmas tree and mantel garland twinkle softly. Preserve the exact room, furniture, and composition. No text, no people, no morphing, cinematic realism.'

echo "Creating Seedance prediction model=${MODEL}"
CREATE="$(curl -fsS -X POST "https://api.replicate.com/v1/models/${MODEL}/predictions" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: wait" \
  -d "$(python3 - <<PY
import json
print(json.dumps({
  "input": {
    "prompt": """${PROMPT}""",
    "image": "${IMAGE_URL}",
    "duration": 5,
    "resolution": "1080p",
    "camera_fixed": True,
    "fps": 24,
  }
}))
PY
)")"

ID="$(python3 - <<PY
import json,sys
print(json.loads('''${CREATE}''').get('id',''))
PY
)"
STATUS="$(python3 - <<PY
import json
print(json.loads('''${CREATE}''').get('status',''))
PY
)"
echo "prediction=${ID} status=${STATUS}"

for _ in $(seq 1 90); do
  PRED="$(curl -fsS "https://api.replicate.com/v1/predictions/${ID}" -H "Authorization: Bearer ${TOKEN}")"
  STATUS="$(python3 - <<PY
import json
print(json.loads('''${PRED}''').get('status',''))
PY
)"
  echo "poll status=${STATUS}"
  if [[ "${STATUS}" == "succeeded" || "${STATUS}" == "failed" || "${STATUS}" == "canceled" ]]; then
    break
  fi
  sleep 3
done

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

curl -fsSL -o "${OUT}" "${URL}"
ffmpeg -y -i "${OUT}" -vf 'scale=1280:720' -c:v libx264 -pix_fmt yuv420p -preset medium -crf 20 -movflags +faststart -an "${OUT720}"
echo "Wrote ${OUT} and ${OUT720}"
