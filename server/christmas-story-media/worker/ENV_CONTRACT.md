# Film worker environment contract (Mission 02E)

Do not deploy until staging credentials are authorized.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `CS_MEDIA_QUEUE_DIR` | yes | `/data/queue` | Private job JSON store |
| `CS_MEDIA_OUT_DIR` | yes | `/data/out` | Rendered MP4/poster/preview |
| `CS_MEDIA_TMP_DIR` | no | `/data/tmp` | Scratch; cleaned per job |
| `CS_FILM_WORKER_ID` | yes in prod | auto | Stable worker identity for leases |
| `CS_STORAGE_MODE` | yes | `local_private` | `local_private` \| `s3_private` (future) |
| `CS_S3_BUCKET` | if s3 | — | Private bucket only |
| `CS_S3_PREFIX` | if s3 | — | Order-scoped prefix |
| `CHRISTMAS_STORY_ADMIN_TOKEN` | song ops | — | Never log; never ship in `VITE_*` |
| `NODE_OPTIONS` | no | `--max-old-space-size=768` | Memory ceiling |

## Resource limits (suggested compose)

- cpus: `1.5`
- memory: `1536M`
- pids: `256`

## Safety

- No public HTTP media server in this image
- Argv-only FFmpeg (`shell: false`)
- Path jail via `safePaths`
- Structured JSON logs without PII / tokens
