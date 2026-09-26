#!/usr/bin/env bash
set -euo pipefail
cd /workspace
source scripts/mozas-ssh.sh
mozas_prepare_ssh
mozas_ssh 'docker exec thedigitalgifter env CONTENT_AUTOPILOT_CONCEPT_ID=70fe89ae-1993-463f-be66-ca3694294d03 CONTENT_AUTOPILOT_RESUME_TICKS=150 CONTENT_AUTOPILOT_TICK_PAUSE_MS=25000 node /tmp/content-autopilot-resume-ticks.mjs' 2>&1 | tee /tmp/ca-canary-resume.log
