# TheDigitalGifter origin image for Mozas VPS.
# Client Vite keys are build args from /opt/mozas/projects/thedigitalgifter/secrets/app.env.
# This image does not copy or overwrite the VPS secrets directory.
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_APP_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_APP_URL=$VITE_APP_URL
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_ANON_KEY"
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache wget ffmpeg \
  && addgroup -S tdg && adduser -S tdg -G tdg
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install --no-save tsx@4.20.5
COPY --from=build /app/dist ./dist
COPY api ./api
COPY server ./server
COPY src ./src
COPY public/.well-known ./public/.well-known
ENV NODE_ENV=production \
    VERCEL_ENV=production \
    PORT=8080
EXPOSE 8080
USER tdg
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "--import", "tsx", "server/origin.mjs"]
