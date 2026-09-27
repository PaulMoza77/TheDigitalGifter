#!/usr/bin/env bash
# Output HF_CREDENTIALS to stdout only (never log). Same source as deploy-public-generator.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=mozas-ssh.sh
source "${ROOT}/scripts/mozas-ssh.sh"
mozas_prepare_ssh
mozas_verify_remote_identity
script_b64="$(
  python3 - <<'PY'
import base64
script = r'''
from pathlib import Path
val = ""
for line in Path("/opt/mozas/projects/thedigitalgifter/secrets/app.env").read_text().splitlines():
    if line.startswith("HF_CREDENTIALS="):
        raw = line.split("=", 1)[1].strip()
        if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in {'"', "'"}:
            raw = raw[1:-1]
        val = raw
print(val, end="")
'''
print(base64.b64encode(script.encode()).decode())
PY
)"
mozas_ssh "python3 -c 'import base64; exec(base64.b64decode(\"${script_b64}\"))'"
