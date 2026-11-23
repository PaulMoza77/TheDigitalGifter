# Christmas Story film worker — isolated package for future VPS (Mission 02E).
# Build from repo root:
#   docker build -f server/christmas-story-media/worker/Dockerfile -t tdg-christmas-story-film-worker:02e .
# Do NOT deploy from this PR.
FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    fonts-liberation \
    python3 \
    python3-pil \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_VERSION=22.14.0
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
  | tar -xJ -C /usr/local --strip-components=1 \
  && node -v && ffmpeg -version | head -1

WORKDIR /app
COPY server/christmas-story-media/worker/package.worker.json /app/package.json
COPY server/christmas-story-media/*.ts /app/server/christmas-story-media/
COPY scripts/christmas-story-02d/film-worker.mjs /app/scripts/film-worker.mjs
COPY server/christmas-story-media/worker/entrypoint.sh /app/entrypoint.sh
COPY server/christmas-story-media/worker/healthcheck.sh /app/healthcheck.sh

RUN chmod +x /app/entrypoint.sh /app/healthcheck.sh \
  && mkdir -p /data/queue /data/out /data/tmp \
  && useradd -r -u 10001 -g root csworker \
  && chown -R csworker:root /data /app

USER csworker
ENV CS_MEDIA_QUEUE_DIR=/data/queue \
    CS_MEDIA_OUT_DIR=/data/out \
    CS_MEDIA_TMP_DIR=/data/tmp \
    CS_STORAGE_MODE=local_private \
    NODE_OPTIONS=--max-old-space-size=768

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/app/healthcheck.sh"]

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["--once"]
