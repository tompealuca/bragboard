# Bragboard server image: PocketBase (API, auth, database, admin UI) + the web app.
# Builds for linux/amd64 and linux/arm64 (Raspberry Pi 4/5 with a 64-bit OS).

# ---- 1. Build the web app. Runs on the build machine's own CPU, the output is static files.
FROM --platform=$BUILDPLATFORM node:22-alpine AS web
WORKDIR /app
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
# Empty on purpose: the web app talks to the server it is served from.
ENV EXPO_PUBLIC_API_URL=
RUN npx expo export --platform web --output-dir dist

# ---- 2. PocketBase with our schema, plus the web app as static files.
FROM alpine:3.22
ARG PB_VERSION=0.40.6
ARG TARGETARCH

RUN apk add --no-cache ca-certificates tzdata unzip \
    && cd /tmp \
    && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" -O pb.zip \
    && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/checksums.txt" -O checksums.txt \
    && grep "pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" checksums.txt | sed "s/pocketbase_.*\.zip/pb.zip/" | sha256sum -c - \
    && mkdir -p /pb \
    && unzip -q pb.zip pocketbase -d /pb \
    && rm -f pb.zip checksums.txt \
    && apk del unzip

COPY server/pb_migrations /pb/pb_migrations
COPY server/pb_hooks /pb/pb_hooks
COPY --from=web /app/dist /pb/pb_public

WORKDIR /pb
VOLUME /pb/pb_data
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8090/api/health >/dev/null || exit 1

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--publicDir=/pb/pb_public", "--migrationsDir=/pb/pb_migrations", "--hooksDir=/pb/pb_hooks"]
