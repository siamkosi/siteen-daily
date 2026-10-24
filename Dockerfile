# syntax=docker/dockerfile:1
# Debian/glibc is supported by Playwright; the browser version comes from npm ci.
ARG NODE_IMAGE=node:24.22.1-bookworm-slim
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
RUN node scripts/check-container-env.mjs --build && npm run build

FROM ${NODE_IMAGE} AS app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 TZ=Asia/Bangkok \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright PDF_BROWSER=chromium \
    PDF_CHROMIUM_SANDBOX=true
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && apt-get update && apt-get install -y --no-install-recommends fontconfig ca-certificates \
    && node node_modules/playwright-core/cli.js install --with-deps --no-shell chromium \
    && rm -rf /var/lib/apt/lists/*
COPY public/fonts /usr/local/share/fonts/siteen
# Dependencies remain root-owned/readable; only the runtime cache needs ownership.
RUN fc-cache -f && mkdir -p /app/.next/cache \
    && chown node:node /app/.next /app/.next/cache
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/build-public-env.json ./build-public-env.json
COPY --chown=node:node public ./public
COPY --chown=node:node src/lib/server/pdf-renderer.ts ./src/lib/server/pdf-renderer.ts
COPY --chown=node:node scripts/check-container-env.mjs scripts/pdf-smoke.mjs ./scripts/
COPY --chmod=755 deploy/container-entrypoint.sh /usr/local/bin/siteen-entrypoint
USER node
EXPOSE 3000
ENTRYPOINT ["siteen-entrypoint"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]

# Optional local/CI verification image. Does not contact Supabase or deploy.
FROM app AS pdf-verify
USER root
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils \
    && rm -rf /var/lib/apt/lists/*
COPY --chmod=755 scripts/verify-pdf-linux.sh /usr/local/bin/verify-pdf-linux
USER node
CMD ["verify-pdf-linux"]

# Default build remains the production image, with no QA tools/results.
FROM app AS runtime
