# Creators Toolkit

**An AI-powered content production suite built with Next.js, Remotion, and multiple AI APIs.**

Live deployment: [creators-toolkit-production.up.railway.app](https://creators-toolkit-production.up.railway.app)

This project was designed and built as a full-stack portfolio piece demonstrating real-world software engineering skills across the complete stack: web application development, REST API design, cloud deployment, AI service integration, and video rendering pipelines.

---

## Table of Contents

1. [What This Project Does](#1-what-this-project-does)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Key SWE Concepts Demonstrated](#4-key-swe-concepts-demonstrated)
5. [Feature Deep Dives](#5-feature-deep-dives)
6. [Project Structure](#6-project-structure)
7. [Running Locally](#7-running-locally)
8. [Deployment](#8-deployment)
9. [API Integrations](#9-api-integrations)

---

## 1. What This Project Does

Creators Toolkit is a suite of six tools for content creators, all powered by AI. Each tool takes a user input, passes it through a multi-step pipeline that coordinates AI models, media processing, and video rendering, and delivers a finished media asset ready to publish.

| Tool | Input | Output |
|---|---|---|
| **Short-Form Enhancement** | Any video file | Enhanced 9:16 MP4 with captions, kinetic text, Ken Burns zoom, lower thirds, and audio visualizer |
| **Animated Quotes** | Quote text + author | 15–30s animated 1:1 MP4 with script typography and optional AI music |
| **Promo Video** | Chat with Claude about your brand | 30–60s 16:9 MP4 with voiceover, background image, and background music |
| **Copywriting** | Topic description | Platform-optimized captions, hooks, hashtags, and CTAs |
| **Content Repurposer** | Long-form content | The same content rewritten in the correct format for 6 platforms |
| **Thumbnail A/B** | Video title/topic | Four CSS-rendered thumbnail concepts to compare and choose from |

---

## 2. Tech Stack

Each technology in this project serves a specific purpose. Here is what each one does and why it was chosen.

### Frontend

| Technology | Purpose | Learn More |
|---|---|---|
| **Next.js 16** | The React framework that powers the entire web application. Handles routing, server-side API routes, and the production build. | [nextjs.org/docs](https://nextjs.org/docs) |
| **React 19** | The UI library. Every page and component is a React function that re-renders when state changes. | [react.dev](https://react.dev) |
| **TypeScript** | Adds static types to JavaScript. Catches bugs at compile time rather than at runtime. Every function signature, prop, and return type is declared explicitly. | [typescriptlang.org](https://www.typescriptlang.org) |
| **Tailwind CSS** | Utility-first CSS framework. Styles are applied via class names rather than separate stylesheet files. | [tailwindcss.com](https://tailwindcss.com) |

### Backend (Next.js API Routes)

Next.js supports writing server-side code directly inside the same project as the frontend. Files in `web/app/api/` become HTTP endpoints. This eliminates the need for a separate backend server.

```
POST /api/short-form/upload      → saves the video to disk
POST /api/short-form/analyze     → runs FFprobe + FFmpeg on the video
POST /api/short-form/transcribe  → calls OpenAI Whisper API
POST /api/short-form/enhance     → sends transcript + video frames to Claude
POST /api/short-form/render      → runs Remotion CLI, returns MP4 URL
```

### Video Rendering

| Technology | Purpose |
|---|---|
| **Remotion** | A framework for building videos with React. You write React components; Remotion renders each "frame" of the component tree as a video frame. Used for all three video output features. |
| **FFmpeg** | The industry standard command-line tool for video and audio processing. Used to extract audio from videos, normalize loudness, scale images, and mix audio tracks. |
| **FFprobe** | The companion tool to FFmpeg that reads video metadata — duration, frame rate, dimensions, codec — without re-encoding anything. |

### AI Services

| Service | API | Used For |
|---|---|---|
| **Claude (Anthropic)** | REST + Anthropic SDK | Creative direction, transcript analysis, Ken Burns focal point selection from video frames, copy generation, quote style design |
| **OpenAI Whisper** | OpenAI SDK | Speech-to-text transcription with word-level timestamps |
| **ElevenLabs** | REST | Text-to-speech voiceover generation |
| **Suno** | REST | AI instrumental music generation |
| **Kie.ai** | REST | AI image generation for video backgrounds |

### Infrastructure

| Technology | Purpose |
|---|---|
| **Railway** | Cloud platform-as-a-service. Hosts the Next.js app and Remotion project together in a single Docker container. |
| **Docker** | Packages the entire application — Node.js, FFmpeg, all dependencies — into a portable container that runs identically on any server. |
| **GitHub** | Source control. Railway watches the `main` branch and automatically redeploys on every push. |

---

## 3. System Architecture

```
Browser (React / Next.js)
        │
        │  HTTP requests (fetch API)
        ▼
Next.js API Routes  ──────────────────────────────────────────┐
        │                                                       │
        ├── /api/short-form/*   ── FFmpeg / FFprobe            │
        │                       ── OpenAI Whisper API          │
        │                       ── Claude Vision API           │
        │                       ── Remotion CLI (subprocess)   │
        │                                                       │
        ├── /api/promo/*        ── Claude API                  │
        │                       ── ElevenLabs API              │
        │                       ── Kie.ai API                  │
        │                       ── Suno API                    │
        │                       ── FFmpeg (audio mix)          │
        │                       ── Remotion CLI (subprocess)   │
        │                                                       │
        ├── /api/quotes/*       ── Claude API                  │
        │                       ── Suno API                    │
        │                       ── Remotion CLI (subprocess)   │
        │                                                       │
        └── /api/uploads/*      ── Disk I/O (serve files)      │
            /api/renders/*      ── Disk I/O (serve files)      │
                                                                │
                        All rendered MP4s stored in            │
                        web/public/renders/ on the server ─────┘
```

### How the Short-Form Pipeline Works (Step by Step)

This is the most complex pipeline and demonstrates the most SWE concepts:

```
1. Browser uploads video file via FormData (multipart POST)
         ↓
2. /api/short-form/upload saves it to public/uploads/<jobId>.mp4
         ↓
3. /api/short-form/analyze
   - FFprobe reads duration, fps, width, height
   - FFmpeg extracts audio as 16kHz mono WAV
   - FFmpeg normalizes audio to -16 LUFS (loudness standard)
         ↓
4. /api/short-form/transcribe
   - OpenAI Whisper API returns JSON with word + start/end timestamps
   - Example: { word: "hello", start: 0.3, end: 0.6 }
         ↓
5. /api/short-form/enhance
   - FFmpeg extracts ~10 JPEG keyframes from the video
   - Claude receives: transcript + keyframe images (Vision API)
   - Claude returns JSON: title, palette, kineticPhrases[], kenBurnsZones[], lowerThirds[]
         ↓
6. /api/short-form/render
   - Serializes all data as JSON, passes via --props flag to Remotion CLI
   - Remotion renders 1080×1920 MP4 frame by frame using React components
   - Output saved to public/renders/short-form/<jobId>_enhanced.mp4
         ↓
7. Browser receives URL, displays <video> player + download button
```

---

## 4. Key SWE Concepts Demonstrated

This section maps the project features to the computer science concepts they implement. This is the "why" behind the code — useful for understanding the project as a learning artifact.

### Asynchronous Programming

Nearly every operation in this project is asynchronous — it takes time and must not block other work while waiting. The project uses `async/await` throughout.

```typescript
// Every pipeline step is async because it calls an external API or reads/writes files.
// 'await' pauses THIS function until the operation completes,
// but does NOT freeze the entire server — other requests can still be handled.
async function runPipeline(file: File) {
  const uploadResult = await fetch("/api/short-form/upload", { ... });
  const analyzeResult = await fetch("/api/short-form/analyze", { ... });
  // ...each step waits for the previous one before proceeding
}
```

🔗 Learn more: [https://www.w3schools.com/js/js_async.asp](https://www.w3schools.com/js/js_async.asp)

### REST API Design

Every backend feature is exposed as a REST endpoint — a URL that accepts a specific HTTP method (GET, POST) and returns JSON.

```
POST /api/quotes/generate    → accepts { quote, author, stylePreference }
                             → returns { style: { gradientFrom, gradientTo, ... } }

POST /api/quotes/music       → accepts { musicPrompt, jobId }
                             → returns { audioSrc: "http://..." }

POST /api/quotes/render      → accepts { quote, author, style, jobId, audioSrc }
                             → returns { url: "/api/renders/quotes/quote-xxx.mp4" }
```

Each route is a single responsibility — one job, one endpoint. This is the **Single Responsibility Principle** from SOLID design.

### TypeScript Type Safety

Every data structure passed between the frontend and backend is defined as a TypeScript type. This means TypeScript will catch at compile time if you pass the wrong data to the wrong function.

```typescript
// This type describes exactly what shape the Ken Burns zone data must have.
// If the Remotion component expects these fields and Claude doesn't return them,
// TypeScript catches it before the code runs.
type KenBurnsZone = {
  startFrame: number;
  endFrame: number;
  scale: number;    // between 1.05 and 1.2
  x: number;        // 0.0 = left, 0.5 = center, 1.0 = right
  y: number;        // 0.0 = top, 0.5 = center, 1.0 = bottom
};
```

🔗 Learn more: [https://www.w3schools.com/typescript/typescript_object_types.php](https://www.w3schools.com/typescript/typescript_object_types.php)

### State Management in React

The frontend manages complex state across a multi-step pipeline. React's `useState` hook stores the result of each step so it can be passed to the next.

```typescript
// Local variables — NOT React state — are used to pass data between async steps.
// React state updates are asynchronous: setJobId() schedules a re-render,
// but the variable 'jobId' inside this function is still the old value.
// Local variables update immediately and are safe to read in the next line.
let currentJobId = "";
let currentFilePath = "";
// ...
currentJobId = data.jobId;   // ← safe to use right away
setJobId(data.jobId);        // ← updates the UI on next render
```

🔗 Learn more: [https://www.w3schools.com/react/react_usestate.asp](https://www.w3schools.com/react/react_usestate.asp)

### File I/O and the Server Filesystem

The backend reads and writes files directly to the server's disk using Node.js's `fs` module. Uploaded videos, extracted audio, rendered MP4s — all are stored as real files.

```typescript
// fs.mkdirSync creates a directory — like mkdir in the terminal.
// { recursive: true } means it won't throw an error if the folder already exists.
fs.mkdirSync(outputDir, { recursive: true });

// fs.writeFileSync writes raw bytes to a file path.
// Buffer.from(bytes) converts an ArrayBuffer (raw binary data) into a Node.js Buffer.
fs.writeFileSync(filePath, Buffer.from(bytes));
```

🔗 Learn more: [https://www.w3schools.com/nodejs/nodejs_filesystem.asp](https://www.w3schools.com/nodejs/nodejs_filesystem.asp)

### Process Spawning (Child Processes)

Remotion and FFmpeg are both external command-line programs. The Node.js server runs them as subprocesses using `child_process.exec`.

```typescript
// execAsync() runs a shell command and waits for it to finish.
// This is how the Node.js server tells FFmpeg or Remotion to do work.
// The timeout prevents a hung process from blocking the server indefinitely.
await execAsync(command, { timeout: 600000 }); // 10 minutes
```

### Prompt Engineering

Claude is given a precisely crafted system prompt that defines its role, the exact JSON schema it must return, and rules for each field. Reliable AI output requires treating the prompt like an API contract.

```
Rules:
- title: 3–5 words MAX, ALL CAPS, hook-first (e.g. "BIRTHDAY NIGHT OUT")
- palette.from: a vivid, saturated hex colour that matches the video's mood
- Ken Burns x/y: use actual subject/face position visible in the nearest frame
```

### Multimodal AI (Vision + Text)

The short-form pipeline extracts video frames and sends them to Claude alongside the transcript. Claude's Vision API can analyze the images and use what it literally sees — where subjects stand, what's in frame — to make decisions the transcript alone could never support.

```typescript
// Build a content array that interleaves image blocks and text labels.
// Claude receives both the transcript and the visual keyframes in a single message.
frameBlocks.push({
  type: "image",
  source: { type: "base64", media_type: "image/jpeg", data: base64String },
});
frameBlocks.push({
  type: "text",
  text: `↑ t=${frameTimeSeconds}s (frame ${frameNumber})`,
});
```

### Cloud Deployment with Docker

The app is containerized with Docker, which means it runs in an identical environment on the developer's Mac, the CI build server, and Railway's cloud infrastructure. The `Dockerfile` specifies exactly which OS, Node.js version, FFmpeg binary, and dependencies the app needs.

---

## 5. Feature Deep Dives

### Short-Form Enhancement — The Remotion Composition

Remotion renders video by calling a React component once per frame. The component uses `useCurrentFrame()` to know which frame is currently being rendered, then calculates the visual state for that exact moment.

```typescript
// Remotion calls this function ~1800 times for a 60-second video at 30fps.
// Each call gets a different 'frame' number.
// The component calculates: "at frame 450, the Ken Burns zoom is at scale 1.08,
// the current word is 'incredible', and lower third #2 is sliding in."
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

// spring() simulates physical bounce — it starts fast and settles naturally.
const slideProgress = spring({ frame: frame - startFrame, fps, config: { damping: 14 } });
```

### Short-Form Enhancement — Timed Caption Rendering

Each word from the Whisper transcript has a `start` and `end` time in seconds. The caption system converts these to frame numbers and renders only the words that should be visible at the current frame.

```typescript
// Convert timestamp to frame number: seconds × fps = frame
const wordStartFrame = Math.round(word.start * fps);
const wordEndFrame = Math.round(word.end * fps);

// The word is "active" (highlighted yellow) only when the current frame
// falls inside its time window.
const isActive = frame >= wordStartFrame && frame <= wordEndFrame;
```

### Animated Quotes — Physics Animation

Each word in the quote has its own spring animation with a staggered start time. The spring function produces values between 0 and 1 that simulate a physical spring snapping into place.

```typescript
words.map((word, i) => {
  // Each word starts 7 frames after the previous one (stagger effect).
  const wordStartFrame = i * 7;

  // spring() goes from 0 to 1. When progress=0: word is invisible and below position.
  // When progress=1: word is fully visible at its final position.
  const progress = spring({ frame: frame - wordStartFrame, fps, config: { damping: 14, stiffness: 180 } });

  return (
    <span style={{
      opacity: interpolate(progress, [0, 0.3], [0, 1]),
      transform: `scale(${interpolate(progress, [0, 1], [0.7, 1])})
                  translateY(${interpolate(progress, [0, 1], [30, 0])}px)`
    }}>
      {word}
    </span>
  );
})
```

---

## 6. Project Structure

```
Creators_Toolkit 2/
├── web/                          ← Next.js web application
│   ├── app/
│   │   ├── page.tsx              ← Dashboard (home page)
│   │   ├── short-form/
│   │   │   └── page.tsx          ← Short-Form Enhancement UI
│   │   ├── quotes/
│   │   │   └── page.tsx          ← Animated Quotes UI
│   │   ├── promo/
│   │   │   └── page.tsx          ← Promo Video UI (chat + pipeline)
│   │   └── api/
│   │       ├── short-form/
│   │       │   ├── upload/       ← Save uploaded video to disk
│   │       │   ├── analyze/      ← FFprobe metadata + FFmpeg audio extraction
│   │       │   ├── transcribe/   ← OpenAI Whisper API
│   │       │   ├── enhance/      ← Claude Vision + transcript analysis
│   │       │   └── render/       ← Remotion CLI render
│   │       ├── quotes/
│   │       │   ├── generate/     ← Claude style + musicPrompt selection
│   │       │   ├── music/        ← Suno music generation + MP3 download
│   │       │   └── render/       ← Remotion CLI render
│   │       ├── promo/
│   │       │   ├── brief/        ← Claude creative brief generation
│   │       │   ├── voiceover/    ← ElevenLabs TTS
│   │       │   ├── image/        ← Kie.ai image generation
│   │       │   ├── music/        ← Suno music generation
│   │       │   └── render/       ← Remotion CLI render
│   │       ├── uploads/          ← File server for uploaded assets (CORS-enabled)
│   │       └── renders/          ← File server for rendered MP4s
│   ├── lib/
│   │   ├── claude.ts             ← Anthropic SDK wrapper (sendMessage)
│   │   ├── ffmpeg.ts             ← FFmpeg subprocess wrapper (reads FFMPEG_PATH env var)
│   │   ├── ffprobe.ts            ← FFprobe metadata reader + audio extractor
│   │   ├── whisper.ts            ← OpenAI Whisper API client
│   │   ├── elevenlabs.ts         ← ElevenLabs voiceover client
│   │   ├── suno.ts               ← Suno music generation client (submit + poll)
│   │   └── kieai.ts              ← Kie.ai image generation client (submit + poll)
│   ├── components/
│   │   ├── ProgressTracker.tsx   ← Reusable step-by-step progress UI
│   │   └── FileUpload.tsx        ← Drag-and-drop video upload component
│   └── public/
│       ├── uploads/              ← Runtime: uploaded videos + extracted audio
│       └── renders/              ← Runtime: finished MP4 files
│           ├── short-form/
│           ├── quotes/
│           └── promo/
│
├── project/                      ← Remotion video project
│   └── src/
│       ├── index.ts              ← Remotion entry point (calls registerRoot)
│       ├── Root.tsx              ← Registers all three compositions
│       ├── CaptionedVideo.tsx    ← Short-form video composition (Series + layers)
│       ├── AnimatedQuote.tsx     ← Animated quote composition
│       └── PromoVideo.tsx        ← Brand promo video composition
│
├── Dockerfile                    ← Container build instructions for Railway
├── railway.toml                  ← Railway deployment configuration
├── INSTRUCTIONS.md               ← User guide (how to use each tool)
└── README.md                     ← This file
```

### Key Design Decisions

**Why is `project/` separate from `web/`?**
Remotion is a command-line renderer that runs as a subprocess. The `web/` server calls `npx remotion render` as a shell command, passing props as JSON via the `--props` flag. Keeping them as separate Node projects prevents their dependency trees from conflicting and matches how Remotion is designed to be used.

**Why serve files via `/api/renders/` and `/api/uploads/` instead of directly?**
Next.js standalone mode caches the static `public/` directory at build time. Any file added to `public/` after the build (like a rendered MP4) returns a cached 404 from the static file server. The API route handlers bypass this by reading files directly from disk at request time, with proper `Content-Type`, `Content-Length`, and HTTP range request support for video seeking.

**Why does every lib function read `process.env` inside the function body, not at module level?**
Next.js evaluates module-level code at build time when collecting page data. Environment variables like `ANTHROPIC_API_KEY` are only injected at runtime (when the server actually starts). Checking inside the function means the error fires when a request is made — not during the build — which would break deployment even though the key exists in production.

---

## 7. Running Locally

### Prerequisites

- Node.js 18 or later
- FFmpeg: `brew install ffmpeg`

### Setup

```bash
# 1. Install web app dependencies
cd "Creators_Toolkit 2/web"
npm install

# 2. Install Remotion project dependencies
cd "../project"
npm install

# 3. Create environment variables file
cd "../web"
cp .env.example .env.local
# Edit .env.local and add your API keys
```

### Required environment variables (`web/.env.local`)

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
ELEVEN_LABS_API_KEY=...
KIE_API_KEY=...
SUNO_API_KEY=...
FFMPEG_PATH=/opt/homebrew/bin/ffmpeg
FFPROBE_PATH=/opt/homebrew/bin/ffprobe
REMOTION_PROJECT_PATH=/absolute/path/to/Creators_Toolkit 2/project
```

### Start the dev server

```bash
cd "Creators_Toolkit 2/web"
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 8. Deployment

The app is deployed on Railway using Docker. The `Dockerfile` at the project root:

1. Starts from a Node.js 20 base image
2. Installs FFmpeg via apt-get
3. Copies both `web/` and `project/` into the container
4. Runs `npm install` in both
5. Runs `npm run build` in `web/`
6. Starts the Next.js server with `npm start`

Railway monitors the GitHub `main` branch. Every `git push origin main` triggers a new build and deploys automatically.

```bash
# Deploy a change
git add .
git commit -m "describe what changed"
git push origin main
# Railway builds and deploys automatically (~2-3 minutes)
```

---

## 9. API Integrations

### Claude (Anthropic)

Used for all AI reasoning tasks. The `web/lib/claude.ts` wrapper exposes a single `sendMessage()` function that all routes use. Supports both plain text and multimodal (text + images) messages.

- Model: `claude-sonnet-4-6`
- Used in: Short-form enhance, promo brief generation, quote style selection, copywriting, content repurposing, thumbnail concept generation

### OpenAI Whisper

Used exclusively for speech-to-text transcription in the short-form pipeline. Returns word-level timestamps that drive the animated caption system.

- Model: `whisper-1`
- Response format: `verbose_json` with `timestamp_granularities: ["word"]`

### ElevenLabs

Text-to-speech for promo video voiceovers. Accepts a script and voice ID, returns an MP3 file.

### Suno

AI music generation. The API is asynchronous — you submit a prompt and get a `taskId`, then poll every 5 seconds until status is `SUCCESS`. Used for promo video background music and animated quote background tracks.

### Kie.ai

AI image generation for promo video backgrounds. Also asynchronous — submit a prompt, poll for completion, receive an image CDN URL. Supports 1:1, 3:2, and 2:3 aspect ratios.

---

## Built With

- [Next.js](https://nextjs.org) — React framework with built-in API routes
- [Remotion](https://remotion.dev) — Video rendering with React
- [Anthropic Claude](https://anthropic.com) — AI reasoning and vision
- [OpenAI Whisper](https://openai.com/research/whisper) — Speech recognition
- [ElevenLabs](https://elevenlabs.io) — AI voice generation
- [Suno](https://suno.com) — AI music generation
- [Kie.ai](https://kie.ai) — AI image generation
- [FFmpeg](https://ffmpeg.org) — Video and audio processing
- [Railway](https://railway.app) — Cloud deployment
- [TypeScript](https://typescriptlang.org) — Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com) — Utility-first CSS

---

---

## 10. Development History

This section documents the full arc of the project — from initial deployment on Railway to every feature and bug-fix phase. It serves as a record of engineering decisions, problems encountered, and how they were solved.

---

### Phase 0 — Cloud Deployment & CI/CD Pipeline

**Goal:** Move the app from local development to a publicly accessible URL with automatic deploys.

**What was built:**

A `Dockerfile` at the project root packages the entire application into a single Docker container. Because the app requires both the Next.js web server and the Remotion CLI (which must be installed as a subprocess runner), both `web/` and `project/` are included in the same image.

```dockerfile
# Simplified view of what the Dockerfile does:
FROM node:20-slim
RUN apt-get install -y ffmpeg        # install FFmpeg inside the container
COPY web/ ./web/
COPY project/ ./project/
RUN cd web && npm install && npm run build
RUN cd project && npm install
CMD ["node", "web/.next/standalone/server.js"]
```

A `railway.toml` file tells Railway:
- Which port to expose (`$PORT`, dynamically assigned)
- Which environment variables to inject at startup (all API keys, `FFMPEG_PATH`, `REMOTION_PROJECT_PATH`)

**The CI/CD Pipeline:**

Railway watches the GitHub `main` branch. The pipeline is:

```
Developer runs: git push origin main
        ↓
GitHub notifies Railway via webhook
        ↓
Railway pulls the latest commit
        ↓
Railway builds the Docker image (runs Dockerfile)
        ↓
Railway runs health check on the new container
        ↓
Railway swaps the live container with the new one (zero-downtime deploy)
        ↓
Live URL updated in ~2–3 minutes
```

This is a **continuous deployment** (CD) pipeline — every merge to `main` is automatically deployed to production. No manual deploy steps, no FTP uploads, no SSH into a server. The discipline this enforces: every push to `main` must be deployable. Broken code must be fixed before pushing, not after.

**Key problems solved during deployment:**

| Problem | Root Cause | Fix |
|---|---|---|
| Runtime-created files (rendered MP4s) returned 404 | Next.js standalone caches `public/` at build time | Added `/api/renders/[...slug]/` and `/api/uploads/[...slug]/` API routes that read files directly from disk, bypassing the build-time cache |
| FFmpeg not found on Railway | The `ffmpeg` binary path on Railway is not `/usr/bin/ffmpeg` | All FFmpeg calls go through `lib/ffmpeg.ts` → `runFFmpeg()` which reads `FFMPEG_PATH` from environment variables |
| `ANTHROPIC_API_KEY` not available during `npm run build` | Railway only injects secrets at runtime, not during the Docker build step | All API key reads moved inside function bodies — never at module level |

---

### Phase 1 — Core Short-Form Pipeline

**Feature:** Upload a video → get back a 1080×1920 MP4 with word-highlighted captions, kinetic text pops, and Ken Burns zoom.

**What was built:**
- `/api/short-form/upload` — multipart file upload, saves to `public/uploads/`
- `/api/short-form/analyze` — FFprobe reads video metadata; FFmpeg extracts and normalizes audio to −16 LUFS
- `/api/short-form/transcribe` — calls OpenAI Whisper API; returns JSON with per-word timestamps
- `/api/short-form/enhance` — Claude reads the transcript; returns `kineticPhrases[]`, `kenBurnsZones[]`, title, palette
- `/api/short-form/render` — serializes all data as `--props` JSON, runs `npx remotion render CaptionedVideo`
- `project/src/CaptionedVideo.tsx` — the Remotion composition that composites all layers frame by frame

**Key concepts introduced:**
- **Remotion's `Series` component** — each section of the video (intro card, main footage) runs in its own time context, resetting `useCurrentFrame()` to 0. This means all frame numbers in `kineticPhrases` and `kenBurnsZones` are relative to the start of the main footage, not the whole video.
- **Word-level caption rendering** — Whisper returns `{ word, start, end }` tuples; multiplying by `fps` converts to frame numbers; `interpolate()` drives the highlight animation
- **JSON props over CLI** — Remotion receives all dynamic data (transcript, zones, phrases) as a JSON string via `--props`. Shell quoting is critical here — quotes and apostrophes in user content can break the shell command.

---

### Phase 2 — Audio Reactivity (AudioVisualizer)

**Feature:** A real-time frequency bar graph at the bottom of the frame, animated from the audio waveform.

**What was built:**
- `AudioVisualizer` component inside `CaptionedVideo.tsx` using `@remotion/media-utils`
- `useAudioData(audioSrc)` loads the WAV file's waveform data
- `visualizeAudio({ numberOfSamples: 32 })` returns frequency magnitude per bar per frame
- 32 bars rendered with a purple gradient and glow effect; bar height up to 400px; magnitude boosted with `Math.pow(m, 0.5)` for visual emphasis

**Bugs encountered and fixed:**

| Bug | Symptom | Fix |
|---|---|---|
| `useAudioData` failed with CORS error | Browser blocked the audio fetch because Remotion's bundler (port 3000) and Next.js (port 8080) are different origins | Added `Access-Control-Allow-Origin: *` to all responses in `/api/uploads/` route |
| `visualizeAudio` crashed with power-of-two error | `numberOfSamples: 48` was used; internally doubled to 96, which is not a power of two | Changed to 32 (valid power of two) |

---

### Phase 3 — Director Lower Thirds & Dynamic Intro Card

**Feature:** Animated location/name banners (lower thirds) slide in during key moments. A 3-second dynamic intro title card plays before the footage with a per-video color palette chosen by Claude.

**What was built:**

**Intro card:**
- `IntroCard` component inside `CaptionedVideo.tsx`
- Claude returns `{ title, palette: { from, to } }` — a 3–5 word ALL CAPS hook and a mood-matched hex gradient
- Radial gradient background using `palette.from` (vivid center) → `palette.to` (near-black edge)
- Title springs in with `spring({ config: { damping: 12, stiffness: 80 } })`
- Text shadow echoes `palette.from` for a glow effect

**Lower thirds:**
- Claude returns `lowerThirds[]` — each has `label`, `sublabel`, `startFrame`, `durationFrames`
- `LowerThirdOverlay` component: slides in from `x: -780px` using `spring()`, holds, then interpolates out
- Positioned at `bottom: 450px` (above the 400px audio bars), width 68% (clears the watermark)
- Captions suppressed while a lower third is visible to prevent overlap
- Kinetic phrases take full priority over both

**Layer order in `MainFootage`:**
```
Video + Ken Burns  (bottom)
Vignette overlay
Branding watermark
AudioVisualizer
LowerThird (when active — hides captions)
Captions (when no phrase or lower third)
Kinetic phrase  (top — full screen)
```

---

### Phase 4 — Smart Ken Burns via Claude Vision

**Feature:** Instead of guessing x/y focal points from the transcript text, Claude sees actual video frames and sets Ken Burns coordinates based on where subjects actually appear.

**What was built:**
- In `/api/short-form/enhance/route.ts`: extract ~10 JPEG keyframes using FFmpeg (`fps=1/N, scale=480:-1, -frames:v 10`)
- Each frame read from disk as base64, wrapped in `ImageBlock` for Claude's Vision API
- Frames and transcript sent together as a `ContentBlock[]` message — Claude receives both visual and textual context
- System prompt instructs Claude: "use the actual subject/face position visible in the nearest frame to set x/y — do NOT guess"

**Bug introduced and fixed:** The initial implementation called `execAsync("ffmpeg ...")` directly — bypassing `runFFmpeg()` from `lib/ffmpeg.ts`, which is the only function that reads `FFMPEG_PATH` from the environment. This worked locally (FFmpeg at `/usr/bin/ffmpeg`) but would silently fail on Railway. Fixed to use `runFFmpeg()`.

---

### Code Quality Audit

After Phase 4, a full audit was run across all lib files and API routes to find silent errors, hidden fallbacks, and patterns that could cause failures without clear error messages.

**Bugs found and fixed:**

| File | Bug | Fix |
|---|---|---|
| `web/lib/ffprobe.ts` | FPS parsed as `num/den` with no guard if `fpsDen` is NaN or 0, producing `Infinity` | Validate both parts before dividing; throw a descriptive error |
| `web/lib/claude.ts` | `apiKey: process.env.ANTHROPIC_API_KEY!` — the `!` is a TypeScript assertion only; no runtime check | Lazy-initialize `Anthropic` client inside `getClient()`; validate key at call time, not module load |
| `web/app/api/short-form/upload/route.ts` | Error handler returned generic `"Upload failed."` string | Changed to `String(error)` so the real error reaches the UI |
| `web/app/api/short-form/enhance/route.ts` | `Date.now()` used for temp dir name — two simultaneous requests produce the same path | Changed to `crypto.randomUUID()` |
| `web/app/api/short-form/enhance/route.ts` | `finally { try { fs.rmSync(...) } catch {} }` — cleanup failures silently swallowed | Added `console.error()` in the catch so disk problems surface in Railway logs |
| `web/app/api/short-form/enhance/route.ts` | Claude JSON response not validated after `JSON.parse()` — missing fields silently produced broken videos | Added field-by-field validation; returns a 500 with `{ error, raw }` if any required field is absent |
| `web/app/api/quotes/render/route.ts` | `--props='${props}'` — single-quote wrapping breaks on apostrophes (e.g., "Don't Worry Be Happy") | Switched to double-quote wrapping with escaped inner quotes: `.replace(/"/g, '\\"')` |
| `web/app/api/promo/render/route.ts` | Same shell quoting bug | Same fix |
| `web/lib/remotion.ts` | Dead code — `renderComposition()` function never imported by any actual render route | Deleted |

**Rule established:** All environment variable reads and API key validations must be inside function bodies — never at module level. Next.js evaluates module-level code at build time; secrets are only available at runtime.

---

### Animated Quotes — Script Font & AI Music

**Feature:** Author name rendered in Great Vibes calligraphic script. Optional mood-matched background music generated by Suno.

**What was built:**

**Script font:**
- `loadFont()` from `@remotion/google-fonts/GreatVibes` — registers the font before the first frame renders
- Applied only to the author attribution `<p>` element; quote body remains in Georgia serif
- Font size increased from 34px to 52px to suit the script style

**Background music pipeline (opt-in):**
- New toggle in the quotes UI — adds a `Generate background music` step when enabled
- `generate/route.ts` updated: Claude now returns `musicPrompt` alongside the visual style — a Suno-style description of the mood, tempo, and instrumentation
- New `/api/quotes/music/route.ts`: calls `generateMusic(musicPrompt)` → downloads the MP3 from Suno's CDN → saves to `public/uploads/<jobId>_music.mp3` → returns an HTTP URL
- `AnimatedQuote.tsx` receives optional `audioSrc` prop; renders `<Audio src={audioSrc} volume={0.35} />` when set

---

*Built by [Julius Moore](https://linkedin.com/in/julius-moore-18519b16a) · SWE Major, Western Governors University*
