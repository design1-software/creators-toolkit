# 📘 WHAT THIS FILE DOES: Defines the Linux environment this app runs in on Railway.
# A Dockerfile is a recipe — it tells Docker exactly how to build a container image
# step by step, from a bare Linux machine to a fully running Next.js app.
# 🔗 What is Docker: https://www.w3schools.com/docker/docker_intro.php
# 🔗 Dockerfile reference: https://docs.docker.com/reference/dockerfile/

# ── Stage 1: Install dependencies ─────────────────────────────────────────────
# 📘 'FROM' picks the base image — a pre-built Linux environment to start from.
# node:20-alpine is a minimal Linux distro (Alpine) with Node.js 20 pre-installed.
# 'AS deps' names this stage so we can copy files from it in later stages.
FROM node:20-alpine AS deps

# 📘 Some Node.js packages need this C library to compile native code on Alpine Linux.
RUN apk add --no-cache libc6-compat

# 📘 WORKDIR sets the working directory inside the container — like 'cd /app'.
# All following commands run from this folder.
WORKDIR /app

# 📘 Copy only the package files first (not the source code).
# Docker caches each step — copying package.json first means dependencies are
# only re-installed when package.json changes, not on every code change.
# 🔗 npm ci vs npm install: https://www.w3schools.com/nodejs/nodejs_npm.asp
COPY package*.json ./
RUN npm ci


# ── Stage 2: Build the app ────────────────────────────────────────────────────
# 📘 A fresh stage for building — starts clean so build tools don't leak into production.
FROM node:20-alpine AS builder
WORKDIR /app

# 📘 Copy the installed node_modules from Stage 1 into this stage.
# '--from=deps' tells Docker which earlier stage to copy from.
COPY --from=deps /app/node_modules ./node_modules

# 📘 Now copy all the source code.
COPY . .

# 📘 Disable Next.js telemetry (anonymous usage reporting) during build.
ENV NEXT_TELEMETRY_DISABLED=1

# 📘 'npm run build' compiles TypeScript, optimizes React, and produces the
# .next/standalone folder we configured in next.config.ts.
RUN npm run build


# ── Stage 3: Production runner ────────────────────────────────────────────────
# 📘 The final image that actually runs in Railway. Starting fresh again keeps it small —
# no build tools, no source code, only what the running app needs.
FROM node:20-alpine AS runner

# 📘 Install FFmpeg — a command-line video/audio processing tool.
# 'apk add' is Alpine Linux's package manager (like 'brew install' on Mac).
# '--no-cache' skips saving the package index to keep the image smaller.
# 🔗 FFmpeg overview: https://www.w3schools.com/tags/ref_av_dom.asp
RUN apk add --no-cache ffmpeg

WORKDIR /app

# 📘 NODE_ENV=production tells Node.js and Next.js to run in optimized mode.
# This disables dev warnings and enables performance optimizations.
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 📘 Copy only the files needed to run the app — not the source code or build tools.
# .next/standalone contains a self-contained Node.js server (server.js).
# .next/static contains pre-built CSS, JS, and images served directly to the browser.
# public/ contains static assets like icons and SVGs.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static
COPY --from=builder /app/public           ./public

# 📘 EXPOSE tells Railway which port this app listens on.
# Railway's default is 8080 — Next.js standalone reads the PORT env var Railway injects.
EXPOSE 8080

# 📘 HOSTNAME="0.0.0.0" makes the server accept connections from outside the container.
# The default "localhost" would only accept connections from inside — the app would
# be unreachable from the internet.
ENV HOSTNAME="0.0.0.0"

# 📘 CMD is the command that starts the app when the container launches.
# 'node server.js' runs the standalone Next.js server built in Stage 2.
CMD ["node", "server.js"]
