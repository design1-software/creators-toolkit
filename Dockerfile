# 📘 WHAT THIS FILE DOES: Builds a single Docker image containing both the
# Next.js web app (web/) and the Remotion render engine (project/).
# They run together so Remotion can access files saved by the API routes.
# 🔗 What is Docker: https://www.w3schools.com/docker/docker_intro.php
# 🔗 Multi-stage builds: https://docs.docker.com/build/building/multi-stage/

# ── Stage 1: Install Next.js dependencies ─────────────────────────────────────
FROM node:20-alpine AS web-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci


# ── Stage 2: Install Remotion project dependencies ────────────────────────────
# 📘 We use the official Remotion base image here so Chromium is downloaded
# in a compatible environment — same image that will run the renders.
# PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true skips a redundant second download
# since the base image already has Chromium set up correctly.
# 🔗 Remotion Docker docs: https://www.remotion.dev/docs/docker
FROM ghcr.io/remotion-dev/base AS project-deps
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
# 📘 ARG CACHEBUST forces Docker to invalidate all layers below this line when
# its value changes. Set it to today's date to guarantee a clean rebuild.
ARG CACHEBUST=2026-05-12
# 📘 The official Remotion base image (ghcr.io/remotion-dev/base) ships with:
# - The exact Chromium version Remotion expects
# - All required system libraries (nss, drm, atk, etc.)
# - Correct sandbox configuration out of the box
# - Node.js pre-installed
# This replaces our manual apt-get install of chromium + 10 separate lib packages.
# 🔗 Remotion base image: https://github.com/remotion-dev/remotion/pkgs/container/base
FROM ghcr.io/remotion-dev/base AS runner

# 📘 Install FFmpeg on top of the Remotion base image.
# FFmpeg handles audio mixing (voiceover + music) and audio extraction from video.
# The base image doesn't include it since Remotion itself doesn't need it.
RUN apt-get update && apt-get install -y ffmpeg --no-install-recommends \
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

# 📘 Railway injects its own PORT at runtime — Next.js standalone reads it automatically.
EXPOSE 8080
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
