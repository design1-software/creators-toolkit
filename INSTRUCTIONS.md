# Creators Toolkit — User Guide

An AI-powered content production suite. Six tools, one dashboard. Deployed on Railway at [creators-toolkit-production.up.railway.app](https://creators-toolkit-production.up.railway.app).

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

| Tool | Install Command | What It Does |
|---|---|---|
| Node.js 18+ | [nodejs.org](https://nodejs.org) | Runs the web app and Remotion project |
| FFmpeg | `brew install ffmpeg` | Video/audio processing (extract, normalize, mix) |

> **No local Whisper or model files needed.** Transcription is handled by the OpenAI Whisper API — nothing to install or download.

### API Keys

All keys live in `web/.env.local`. For reference:

| Variable | Service | Used By |
|---|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | All AI analysis, briefs, copy, and quote style generation |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) | Whisper API — speech-to-text transcription |
| `ELEVEN_LABS_API_KEY` | [elevenlabs.io](https://elevenlabs.io) | Promo video voiceover |
| `KIE_API_KEY` | [kie.ai](https://kie.ai) | Background image generation (promo videos) |
| `SUNO_API_KEY` | [sunoapi.org](https://sunoapi.org) | Background music generation (promo videos, animated quotes) |

### Install Dependencies

Run once from the project root:

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

Open **http://localhost:3000** in your browser.

The dashboard shows all six tools. Click any card to open it.

> **Memory tip:** Restart the dev server if it has been running for several hours — Next.js can accumulate memory over time. `Ctrl+C` to stop, then `npm run dev` again.

---

## 3. Promo Video

**What it produces:** A finished brand video MP4 with AI voiceover, background image, and background music — rendered by Remotion.

**Time to complete:** 8–15 minutes.

### Phase 1 — Discovery Chat

Claude acts as a creative director and interviews you about your brand.

1. Click **Promo Video** on the dashboard.
2. Answer Claude's questions — brand name, product, audience, tone, goals, differentiators.
3. When Claude has enough information, it will offer to generate your brief.
4. Click **Generate Creative Brief**.

**Tips:**
- Specificity produces better briefs. "Organic coffee for remote workers who care about sustainability" beats "coffee company."
- You can redirect at any point — just tell Claude what to change.

### Phase 2 — Creative Brief Review

1. Read the full brief — brand name, tagline, voiceover script, key messages, CTA, and visual direction.
2. If anything is wrong, click **Revise** to return to the chat.
3. When satisfied, click **Approve** to start production.

### Phase 3 — Production

The pipeline runs automatically. Each step updates in real time.

| Step | What Happens | Typical Duration |
|---|---|---|
| Parse brief | Claude extracts structured production data from the brief | 5–10 seconds |
| Generate voiceover | ElevenLabs converts the script to MP3 | 10–30 seconds |
| Generate background image | Kie.ai generates a cinematic background image | 1–3 minutes |
| Generate & mix music | Suno creates instrumental music; FFmpeg mixes with voiceover | 2–4 minutes |
| Render video | Remotion composes all layers and renders the final MP4 | 2–5 minutes |
| Ready | Video player appears with Download button | — |

> If image or music generation fails, the video still renders using a CSS gradient and voiceover-only audio as fallback.

**Output:** A 1920×1080 MP4 saved in `web/public/renders/promo/`.

---

## 4. Short-Form Enhancement

**What it produces:** Your uploaded video enhanced with a dynamic intro title card, word-highlighted captions, kinetic text pops, Ken Burns zoom effects, director-style lower thirds, an audio frequency visualizer, and normalized audio — rendered as a 1080×1920 vertical MP4.

**Time to complete:** 3–10 minutes depending on video length.

### How to Use

1. Click **Short-Form Enhancement** on the dashboard.
2. Drag and drop a video file, or click to browse. Supported: MP4, MOV, WebM.
3. The pipeline runs automatically — no further input needed.

### Pipeline Steps

| Step | What Happens |
|---|---|
| Upload video | Video saved to the server with a unique job ID |
| Analyze video + normalize audio | FFprobe reads metadata (duration, fps, dimensions). FFmpeg extracts audio as 16kHz WAV and normalizes to −16 LUFS |
| Transcribe speech | OpenAI Whisper API transcribes every word with millisecond-accurate timestamps |
| Claude identifies key moments | Claude reads the transcript AND sees ~10 visual keyframes from the video. It picks kinetic phrases, Ken Burns focal points based on where subjects actually appear in frame, lower third labels, a mood-matched color palette, and a punchy title |
| Remotion renders enhanced MP4 | All layers composited in sequence |

### Visual Enhancements

**Dynamic intro card** — A 3-second full-screen title card before your footage begins. The title (3–5 ALL CAPS words) and a radial gradient background are both chosen by Claude to match the video's mood. Every video gets a unique, vivid color.

**Word-highlighted captions** — A sliding window of words near the bottom of the frame. The word currently being spoken is highlighted in yellow and enlarged.

**Kinetic text pops** — Claude selects 4–8 high-impact phrases. Each springs onto the full screen in large bold text at the exact moment it's spoken, then exits. Timed precisely using word-level timestamps from Whisper.

**Ken Burns zoom** — Slow, subtle zoom movements. Claude analyzes the actual video frames to set focal points where subjects and faces genuinely appear — not guessed from the transcript.

**Lower thirds** — Director-style location or name banners that slide in from the left, hold, and exit smoothly. Positioned above the audio visualizer and below any kinetic phrases to avoid overlapping.

**Audio visualizer** — 32-bar purple frequency graph at the bottom of the frame, animated in real time from the audio waveform. Bars respond to the music or speech energy in each frame.

**Audio normalization** — Peaks and quiet sections balanced to −16 LUFS — the standard loudness for TikTok, Reels, and YouTube Shorts.

**Output:** A 1080×1920 vertical MP4 saved in `web/public/renders/short-form/`.

---

## 5. Animated Quotes

**What it produces:** A 15–30 second square (1080×1080) MP4 with spring-animated text on a Claude-designed gradient background. The author attribution is rendered in a calligraphic script font (Great Vibes). Optionally includes mood-matched AI-generated background music.

**Time to complete:** 2–5 minutes without music · 3–7 minutes with music.

### How to Use

1. Click **Animated Quotes** on the dashboard.
2. Enter the **quote** text.
3. Enter the **author** name.
4. Select a **visual style** — or leave it on "Let the quote's mood guide you."
5. Optionally toggle **Add background music** ON. Claude will choose a music prompt; Suno generates a matching instrumental track.
6. Click **Generate & Render Video**.

### Style Options

| Style | Best For |
|---|---|
| Let the quote's mood guide you | Default — Claude matches colors to the quote's emotional tone |
| Cinematic — dark and epic | Powerful, serious, or motivational quotes |
| Minimalist — clean and spacious | Short, precise, philosophical quotes |
| Bold — high energy, bright colors | Energetic, entrepreneurial, call-to-action quotes |
| Elegant — refined, serif, muted tones | Literary, artistic, or reflective quotes |

### Animation Styles

Claude picks automatically based on word count:
- **Word-by-word** — Each word springs in with a physics bounce. Under 20 words.
- **Full-text** — The entire quote fades in at once. Better for longer quotes.

### Typography

- **Quote body:** Georgia serif — strong, editorial, high legibility
- **Author attribution:** Great Vibes — a calligraphic script that gives the author line an elegant, handwritten quality

### Background Music (optional)

When the music toggle is ON:
1. Claude picks a Suno-style music prompt that matches the quote's emotional tone
2. Suno generates a 30-second instrumental track
3. The track is downloaded and mixed into the rendered video at a subtle volume (35%)

**Output:** A 1080×1080 MP4 saved in `web/public/renders/quotes/`.

---

## 6. Copywriting

**What it produces:** A full set of platform-optimized copy — caption, hook, hashtags, CTA, bio line, and title options — generated in one click.

**Time to complete:** 10–20 seconds.

### How to Use

1. Click **Copywriting** on the dashboard.
2. Select your **Platform** (Instagram, TikTok, Twitter/X, LinkedIn, YouTube, or General).
3. Select your **Tone** (Professional, Casual, Humorous, Inspirational, Educational, or Bold).
4. Describe your content in the text area.
5. Click **Generate Copy**.

### What You Get

| Output | Description |
|---|---|
| Caption | Full post caption, length and style optimized for the platform |
| Hook / Opening Line | First 1–2 sentences designed to stop the scroll |
| Hashtags | 10–15 relevant hashtags |
| Call to Action | One clear action for your audience |
| Bio Line | A one-line authority statement for your profile |
| Title Options | Three alternate headline variants |

Each block has a **Copy** button that copies to your clipboard.

---

## 7. Content Repurposer

**What it produces:** Your original content rewritten for each platform you select — correct length, tone, and format for each.

**Time to complete:** 15–30 seconds.

### How to Use

1. Click **Content Repurposer** on the dashboard.
2. Paste your original content — blog post, script, transcript, newsletter, etc.
3. Check the platforms you want.
4. Click **Repurpose**.

### Platform Formats

| Platform | What Claude Produces |
|---|---|
| Instagram | Long caption with line breaks, storytelling tone, engagement question |
| TikTok | 150-character punchy caption with hook in the first 3 words |
| Twitter / X | 280-character hard limit, thread-ready |
| LinkedIn | 1,200–1,600 character professional insight piece |
| YouTube | SEO-optimized description with timestamp placeholders |
| Email Newsletter | Subject line + 200–300 word body with CTA |

Results appear in tabs — one per platform.

---

## 8. Thumbnail A/B

**What it produces:** Four dramatically different thumbnail design concepts rendered as live CSS mockups you can compare side by side.

**Time to complete:** 10–20 seconds.

### How to Use

1. Click **Thumbnail A/B** on the dashboard.
2. Enter your video topic or full title.
3. Select a style preference, or leave on "No preference."
4. Click **Generate 4 Concepts**.

### Reading the Concepts

Each card shows:
- A live CSS preview at correct proportions
- Concept name and design style
- Color swatch row (background, text, accent)
- Design description and photography/illustration notes

Click **Select as Winner** on your preferred concept.

---

## 9. Troubleshooting

### FFmpeg errors
```bash
which ffmpeg   # should print /opt/homebrew/bin/ffmpeg
which ffprobe  # should print /opt/homebrew/bin/ffprobe
```
If the paths differ, update `FFMPEG_PATH` and `FFPROBE_PATH` in `web/.env.local`.

### OpenAI / ElevenLabs / Kie.ai / Suno API errors
Check that the API key is valid and has remaining credits on the provider's dashboard. These are external paid services.

### Remotion render times out or fails
- Ensure Remotion project dependencies are installed: `cd project && npm install`
- Renders can take 1–5 minutes depending on video length and machine speed.
- If a render fails with `Cannot find module`, re-run `npm install` in `project/`.

### The dev server feels slow or crashes
Restart it: `Ctrl+C` then `npm run dev`. To clear TypeScript memory in VS Code without restarting the editor, open the Command Palette (`Cmd+Shift+P`) and run **TypeScript: Restart TS Server**.

### Where are my output files?

| Skill | Output Location |
|---|---|
| Promo Video | `web/public/renders/promo/` |
| Short-Form Enhancement | `web/public/renders/short-form/` |
| Animated Quotes | `web/public/renders/quotes/` |
| Uploads (video + audio) | `web/public/uploads/` |

---

*Built with Next.js · Remotion · Claude (Anthropic) · OpenAI Whisper · ElevenLabs · Kie.ai · Suno · FFmpeg*
