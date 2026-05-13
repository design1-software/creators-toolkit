# 📘 WHAT THIS FILE DOES: Builds a single Docker image containing both the
# Next.js web app (web/) and the Remotion render engine (project/).
# They run together so Remotion can access files saved by the API routes.
# 🔗 What is Docker: https://www.w3schools.com/docker/docker_intro.php
# 🔗 Multi-stage builds: https://docs.docker.com/build/building/multi-stage/
# 🔗 Remotion Docker guide: https://www.remotion.dev/docs/docker

# ── Stage 1: Install Next.js dependencies ─────────────────────────────────────
# 📘 Alpine Linux is a tiny Linux distro — great for fast dependency installs.
FROM node:20-alpine AS web-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci


# ── Stage 2: Install Remotion project dependencies ────────────────────────────
# 📘 bookworm-slim is Debian 12 — same OS family as the runner stage.
# Using the same OS here keeps npm's native dependency resolution consistent.
# PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true skips the automatic Chromium download
# during npm ci — we download it explicitly in the runner stage instead.
FROM node:20-bookworm-slim AS project-deps
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
# 📘 node:20-bookworm-slim is Debian 12 with Node.js pre-installed.
# Remotion's official Docker guide (https://www.remotion.dev/docs/docker) uses
# this as the base image — it's glibc-based so Chromium runs correctly.
FROM node:20-bookworm-slim AS runner

# 📘 Install the system libraries that Chromium requires to run.
# These are the exact packages listed in the Remotion Docker documentation.
# ffmpeg is added for audio mixing (voiceover + music) — not part of Remotion itself.
# '--no-install-recommends' skips optional packages to keep the image small.
# 'rm -rf /var/lib/apt/lists/*' removes apt's package index after install to save space.
# 🔗 apt-get reference: https://www.w3schools.com/linux/linux_install_software.asp
RUN apt-get update && apt-get install -y \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    ffmpeg \
    --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 📘 Set the Remotion project path so the API routes know where to find it.
ENV REMOTION_PROJECT_PATH=/app/project

# ── Copy the Next.js standalone build ─────────────────────────────────────────
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static     ./.next/static
COPY --from=builder /app/web/public           ./public

# ── Copy the Remotion project ─────────────────────────────────────────────────
COPY --from=project-deps /app/project/node_modules ./project/node_modules
COPY project/ ./project/

# 📘 Download the exact Chromium version that Remotion expects.
# 'remotion browser ensure' checks if the right Chromium is cached — if not,
# it downloads it. Chromium lands in /root/.cache/puppeteer and Remotion
# finds it automatically at render time.
# This must run AFTER project/node_modules is copied (it needs @remotion/cli).
# 🔗 Remotion browser ensure: https://www.remotion.dev/docs/cli/browser/ensure
RUN cd /app/project && npx remotion browser ensure

# 📘 Railway injects its own PORT at runtime — Next.js standalone reads it automatically.
EXPOSE 8080
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
