# Creators Toolkit — User Guide

A complete AI-powered content production suite. Six tools, one dashboard.
Run everything locally on your Mac — no cloud uploads, no subscriptions beyond the API keys already configured.

---

## Table of Contents

1. [First-Time Setup](#1-first-time-setup)
2. [Starting the App](#2-starting-the-app)
3. [Promo Video](#3-promo-video)
4. [Short-Form Enhancement](#4-short-form-enhancement)
5. [Animated Quotes](#5-animated-quotes)
6. [Copywriting](#6-copywriting)
7. [Content Repurposer](#7-content-repurposer)
8. [Thumbnail A/B](#8-thumbnail-ab)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. First-Time Setup

### Prerequisites

All of these must be installed before the app will run.

| Tool | Install Command | What It Does |
|---|---|---|
| Node.js 18+ | [nodejs.org](https://nodejs.org) | Runs the web app |
| FFmpeg | `brew install ffmpeg` | Video/audio processing |
| Whisper.cpp | `brew install whisper-cpp` | Speech-to-text transcription |
| Whisper model | See below | The AI model file Whisper uses |

**Download the Whisper model** (one-time, ~150MB):
```bash
mkdir -p ~/.whisper-models
cd ~/.whisper-models
whisper-cpp-download-ggml-model base.en
```

### API Keys

All keys live in `web/.env.local`. They are already configured for this project. For reference:

| Variable | Service | Used By |
|---|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | All AI chat, briefs, and copy generation |
| `ELEVEN_LABS_API_KEY` | [elevenlabs.io](https://elevenlabs.io) | Promo video voiceover |
| `KIE_API_KEY` | [kie.ai](https://kie.ai) | Background image generation |
| `SUNO_API_KEY` | [sunoapi.org](https://sunoapi.org) | Background music generation |

### Install Dependencies

Run this once from the project root:
```bash
cd "Creators_Toolkit 2/web" && npm install
cd "../project" && npm install
```

---

## 2. Starting the App

```bash
cd "Creators_Toolkit 2/web"
npm run dev
```

Then open **http://localhost:3000** in your browser.

The dashboard shows all six skills. Click any card to open that tool.

> **Memory tip:** Restart the dev server if it has been running for several hours — Next.js can accumulate memory over time. `Ctrl+C` to stop, then `npm run dev` again.

---

## 3. Promo Video

**What it produces:** A finished brand video MP4 with AI voiceover, background image, and background music — rendered by Remotion.

**Time to complete:** 8–15 minutes (most of that is AI generation and rendering).

### Phase 1 — Discovery Chat

Claude acts as a creative director and interviews you about your brand.

1. Click **Promo Video** on the dashboard.
2. Answer Claude's questions naturally in the chat — brand name, product, audience, tone, goals, what makes you different.
3. Keep answering until Claude says it has enough to write your brief. It will offer to generate it.
4. Click **Generate Creative Brief** when prompted.

**Tips:**
- The more specific your answers, the better the brief. "We sell organic coffee to remote workers who care about sustainability" beats "we sell coffee."
- You can ask Claude to focus on a specific angle — it will adjust.
- If you want to change a direction mid-conversation, just say so.

### Phase 2 — Creative Brief Review

Claude compiles everything from the chat into a structured brief.

1. Read the full brief carefully — brand name, tagline, voiceover script, key messages, call to action, and visual direction.
2. If something is wrong or missing, click **Revise** to go back to the chat and clarify.
3. When the brief is correct, click **Approve** to start production.

### Phase 3 — Production

The pipeline runs automatically in 6 steps. Each one updates in real time.

| Step | What Happens | Typical Duration |
|---|---|---|
| Parse brief | Claude extracts structured production data from the brief | 5–10 seconds |
| Generate voiceover | ElevenLabs converts the script to an MP3 | 10–30 seconds |
| Generate background image | Kie.ai generates a cinematic background image | 1–3 minutes |
| Generate & mix music | Suno creates background music, FFmpeg mixes it with the voiceover | 2–4 minutes |
| Render video | Remotion composes and renders the final MP4 | 2–5 minutes |
| Ready | Video player appears with Download button | — |

**If image or music generation fails:** The video still renders — it uses a CSS gradient background and voiceover-only audio as fallbacks. The failed step shows in orange but does not stop production.

**Output:** A 1920×1080 MP4 saved in `web/public/renders/promo/`.

---

## 4. Short-Form Enhancement

**What it produces:** Your uploaded video with word-highlighted captions, Ken Burns zoom effects, kinetic text pops, and normalized audio — rendered as a 1080×1920 vertical MP4.

**Time to complete:** 3–10 minutes depending on video length.

### How to Use

1. Click **Short-Form Enhancement** on the dashboard.
2. Drag and drop a video file onto the upload zone, or click to browse. Supported formats: MP4, MOV, WebM.
3. The pipeline starts automatically — no further input needed.

### Pipeline Steps

| Step | What Happens |
|---|---|
| Upload video | Video saved to the server with a unique job ID |
| Analyze video + normalize audio | FFprobe reads metadata (duration, fps, dimensions). FFmpeg extracts audio as 16kHz WAV and normalizes to −16 LUFS |
| Transcribe speech with Whisper | Whisper.cpp transcribes every spoken word with millisecond-accurate timestamps |
| Claude identifies key moments | Claude reads the transcript and picks the strongest phrases for kinetic text pops, and the best visual moments for Ken Burns zoom |
| Remotion renders enhanced MP4 | All layers composited: base video + animated captions + kinetic text + Ken Burns zoom |

### What the Enhancements Look Like

- **Word-highlighted captions** — A sliding window of words appears near the bottom. The word currently being spoken is highlighted in yellow and slightly enlarged.
- **Kinetic text pops** — Claude selects 2–5 impactful phrases. Each one springs onto the full screen in large bold text at the moment it's spoken, then exits.
- **Ken Burns zoom** — Slow, subtle zoom-into-frame movements applied at moments Claude identifies as visually strong.
- **Audio normalization** — Peaks and quiet sections are balanced to −16 LUFS, the standard loudness for TikTok, Reels, and YouTube Shorts.

**Output:** A 1080×1920 vertical MP4 saved in `web/public/renders/short-form/`.

> **Requirement:** The Whisper model must be downloaded before this feature works. See [First-Time Setup](#1-first-time-setup).

---

## 5. Animated Quotes

**What it produces:** A 15–30 second square (1080×1080) MP4 with spring-animated text on an AI-designed gradient background — ready to post on Instagram, LinkedIn, or Twitter.

**Time to complete:** 2–5 minutes.

### How to Use

1. Click **Animated Quotes** on the dashboard.
2. Enter the **quote** text in the large text area.
3. Enter the **author** name.
4. Select a **visual style** — or leave it on "Let the quote's mood guide you" and Claude will choose.
5. Click **Generate & Render Video**.

### Style Options

| Style | Best For |
|---|---|
| Let the quote's mood guide you | Default — Claude matches colors to the quote's emotional tone |
| Cinematic — dark and epic | Powerful, serious, or motivational quotes |
| Minimalist — clean and spacious | Short, precise, philosophical quotes |
| Bold — high energy, bright colors | Energetic, entrepreneurial, call-to-action quotes |
| Elegant — refined, serif, muted tones | Literary, artistic, or reflective quotes |

### Animation Styles

Claude automatically picks the right one based on word count:
- **Word-by-word** — Each word springs in individually with a bounce. Best for quotes under 20 words.
- **Full-text** — The entire quote fades in at once. Used for longer quotes where word-by-word would be too rapid.

**Output:** A 1080×1080 MP4 saved in `web/public/renders/quotes/`.

---

## 6. Copywriting

**What it produces:** A full set of platform-optimized copy — caption, hook, hashtags, CTA, bio line, and title options — generated in one click.

**Time to complete:** 10–20 seconds.

### How to Use

1. Click **Copywriting** on the dashboard.
2. Select your **Platform** (Instagram, TikTok, Twitter / X, LinkedIn, YouTube, or General).
3. Select your **Tone** (Professional, Casual, Humorous, Inspirational, Educational, or Bold).
4. Describe your content in the text area — the more specific, the better.
5. Click **Generate Copy**.

### What You Get

| Output | Description |
|---|---|
| Caption | Full post caption, length and style optimized for the platform |
| Hook / Opening Line | The first 1–2 sentences designed to stop the scroll |
| Hashtags | 10–15 relevant hashtags without the `#` symbol |
| Call to Action | A single clear action for your audience to take |
| Bio Line | A one-line authority statement for your profile |
| Title Options | Three alternate headline/title variants |

Each block has a **Copy** button. Click it and the text goes straight to your clipboard.

---

## 7. Content Repurposer

**What it produces:** Your original content rewritten for each platform you select — correct length, tone, and format for each.

**Time to complete:** 15–30 seconds.

### How to Use

1. Click **Content Repurposer** on the dashboard.
2. Paste your original content into the text area — blog post, video script, podcast transcript, newsletter, or any other long-form content.
3. Check the boxes for the **platforms** you want to post on.
4. Click **Repurpose**.

### Platform Formats

| Platform | What Claude Produces |
|---|---|
| Instagram | Long caption with line breaks, storytelling tone, 5–10 emojis, engagement question at the end |
| TikTok | 150-character punchy caption with a hook in the first 3 words |
| Twitter / X | 280-character hard limit, thread-ready, hashtags at the end |
| LinkedIn | 1,200–1,600 character professional insight piece with a clear lesson or takeaway |
| YouTube | SEO-optimized description with timestamp placeholders and subscribe CTA |
| Email Newsletter | Subject line + 200–300 word body with one clear CTA |

Results appear in **tabs** — one tab per platform. Click the tab to view and copy that version.

---

## 8. Thumbnail A/B

**What it produces:** Four dramatically different thumbnail design concepts, rendered live as CSS mockups you can compare side-by-side. Select your winner.

**Time to complete:** 10–20 seconds.

### How to Use

1. Click **Thumbnail A/B** on the dashboard.
2. Enter your **video topic or full title** in the input field.
3. Select a **style preference**, or leave it on "No preference" for full creative latitude.
4. Click **Generate 4 Concepts**.

### Reading the Concepts

Each concept card shows:
- A **live CSS preview** of how the thumbnail would look — your headline text rendered in the colors Claude chose, at the correct proportions
- The **concept name** and design style
- A **color swatch row** showing background, text, and accent colors
- A **design description** explaining the visual approach
- A **photography/illustration note** describing the image that would go behind the text

### Style Options

| Style | What It Produces |
|---|---|
| Bold & Shocking | High-contrast, large type, striking color combinations |
| Clean & Minimal | Lots of white/dark space, refined typography, one focal element |
| Cinematic & Dark | Dark moody tones, dramatic lighting notes, film-like feel |
| Bright & Energetic | Saturated colors, excitement, high visual energy |
| Text-Dominant | The headline is the visual — minimal or no background imagery needed |

Click **Select as Winner** on the concept you want to develop. The card highlights in green and a winner badge appears at the top of the page.

---

## 9. Troubleshooting

### "WHISPER_MODEL_DIR contains no model files"
The Whisper model has not been downloaded yet. Run:
```bash
mkdir -p ~/.whisper-models
cd ~/.whisper-models
whisper-cpp-download-ggml-model base.en
```
This downloads `ggml-base.en.bin` (~150MB). The short-form pipeline will work after this.

### "FFMPEG_PATH env var" or FFmpeg errors
Confirm FFmpeg is installed and the path is correct:
```bash
which ffmpeg   # should print /opt/homebrew/bin/ffmpeg
which ffprobe  # should print /opt/homebrew/bin/ffprobe
```
If the paths differ, update `FFMPEG_PATH` and `FFPROBE_PATH` in `web/.env.local`.

### ElevenLabs / Kie.ai / Suno API errors
- Check that your API key is valid and has remaining credits on the provider's dashboard.
- These are external paid services — usage costs credits.
- If a Promo Video production step fails for image or music, the video still renders with a gradient background and voiceover-only audio.

### Remotion render times out or fails
- The Remotion project must have its dependencies installed: `cd project && npm install`
- Renders can take 1–5 minutes depending on video length and machine speed.
- If a render fails with a `Cannot find module` error, re-run `npm install` in the `project/` folder.

### The dev server feels slow or crashes
- Restart it: `Ctrl+C` then `npm run dev`
- The TypeScript language server accumulates memory over long sessions. In VS Code, open the Command Palette (`Cmd+Shift+P`) and run **TypeScript: Restart TS Server** to clear it without restarting the editor.

### Where are my output files?
| Skill | Output Location |
|---|---|
| Promo Video | `web/public/renders/promo/` |
| Short-Form Enhancement | `web/public/renders/short-form/` |
| Animated Quotes | `web/public/renders/quotes/` |
| Uploads (short-form) | `web/public/uploads/` |

All output files are served directly by the Next.js dev server and accessible at `http://localhost:3000/renders/...`.

---

*Built with Next.js, Remotion, Claude (Anthropic), ElevenLabs, Kie.ai, Suno, FFmpeg, and Whisper.cpp.*
