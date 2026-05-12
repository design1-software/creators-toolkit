# 📘 WHAT THIS FILE DOES: Builds a single Docker image containing both the
# Next.js web app (web/) and the Remotion render engine (project/).
# They run together so Remotion can access files saved by the API routes.
# 🔗 What is Docker: https://www.w3schools.com/docker/docker_intro.php
# 🔗 Multi-stage builds: https://docs.docker.com/build/building/multi-stage/

# ── Stage 1: Install Next.js dependencies ─────────────────────────────────────
# 📘 Alpine Linux is a tiny Linux distro — much smaller than Ubuntu or Debian.
# We use it for build stages to keep things fast. The runner uses Debian (below)
# because Chromium (needed by Remotion) works more reliably there.
FROM node:20-alpine AS web-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci


# ── Stage 2: Install Remotion project dependencies ────────────────────────────
# 📘 We skip Chromium's automatic download here — we'll install the system
# Chromium in the runner stage instead. This avoids downloading it twice
# and ensures we use a version compatible with the Linux environment.
FROM node:20-alpine AS project-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app/project
COPY project/package*.json ./
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm ci


# ── Stage 3: Build the Next.js app ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app/web
COPY --from=web-deps /app/web/node_modules ./node_modules
COPY web/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# ── Stage 4: Production runner ────────────────────────────────────────────────
# 📘 We switch to Debian (bookworm-slim) here because Chromium and its system
# library dependencies install cleanly on Debian. Alpine can be tricky for
# Chromium due to its use of musl libc instead of the standard glibc.
FROM node:20-bookworm-slim AS runner

# 📘 Install system tools:
# - ffmpeg: handles audio/video processing (mixing, extracting audio)
# - chromium + its libs: required by Remotion to render React components to video
# '--no-install-recommends' keeps the image lean by skipping optional packages.
# 'rm -rf /var/lib/apt/lists/*' removes apt's package index to save space.
# 🔗 FFmpeg overview: https://www.w3schools.com/tags/ref_av_dom.asp
RUN apt-get update && apt-get install -y \
    ffmpeg \
    chromium \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxkbcommon0 \
    libasound2 \
    --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 📘 Tell Puppeteer (used by Remotion) to use the system Chromium we just installed
# instead of trying to download its own — the download would fail at runtime.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# 📘 Set the Remotion project path so the API routes know where to find it.
# This replaces the local Mac path that was in .env.local.
ENV REMOTION_PROJECT_PATH=/app/project

# ── Copy the Next.js standalone build ─────────────────────────────────────────
# 📘 'output: standalone' in next.config.ts produced a self-contained server.
# We only need these three folders to run the web app — not all of node_modules.
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static     ./.next/static
COPY --from=builder /app/web/public           ./public

# ── Copy the Remotion project ─────────────────────────────────────────────────
# 📘 We copy the source files and the pre-installed node_modules from Stage 2.
# This means Remotion's CLI is available at /app/project/node_modules/.bin/remotion.
COPY --from=project-deps /app/project/node_modules ./project/node_modules
COPY project/ ./project/

# 📘 Railway injects its own PORT at runtime — Next.js standalone reads it automatically.
EXPOSE 8080
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
