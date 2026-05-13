// 📘 WHAT THIS FILE DOES: Sends the transcript AND video frames to Claude for creative analysis.
// Claude reads the transcription and sees keyframes from the video, then identifies:
//   - 4–8 kinetic phrases (high-impact moments for full-screen text pops)
//   - 4–8 Ken Burns zones (where to zoom — using visual subject positions from the frames)
//   - 2–4 lower thirds (location/person labels)
//   - A dynamic colour palette for the intro card
// URL: POST /api/short-form/enhance
// Returns: { title, palette, kineticPhrases, kenBurnsZones, lowerThirds, hookStrength, summary }

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { sendMessage } from "@/lib/claude";
import type { ContentBlock } from "@/lib/claude";
import type { WordTimestamp } from "@/lib/whisper";
import type { KenBurnsZone, KineticPhrase, LowerThird } from "@/lib/types";

const execAsync = promisify(exec);

// 📘 The system prompt tells Claude exactly what role to play and what to output.
// We ask for JSON so we can parse it reliably — no guessing at the format.
const ENHANCE_SYSTEM = `You are a social media video editor.
Given a video transcript with word-level timestamps, you identify the most impactful moments.

You must respond with ONLY valid JSON matching this exact structure:
{
  "title": "3–5 WORD PUNCHY TITLE",
  "palette": { "from": "#f97316", "to": "#0a0400" },
  "kineticPhrases": [
    { "text": "THE PHRASE", "startFrame": 45, "durationFrames": 45 }
  ],
  "kenBurnsZones": [
    { "startFrame": 0, "endFrame": 90, "scale": 1.12, "x": 0.5, "y": 0.5 }
  ],
  "lowerThirds": [
    { "label": "LOCATION OR NAME", "sublabel": "Context line", "startFrame": 90, "durationFrames": 90 }
  ],
  "hookStrength": "strong|medium|weak",
  "summary": "One sentence describing what this video is about."
}

Rules:
- title: 3–5 words MAX, ALL CAPS, hook-first (e.g. "BIRTHDAY NIGHT OUT", "WE'RE GOING IN"). This appears as a full-screen title card — it must be short and punchy, NOT a sentence.
- palette.from: a vivid, saturated hex colour that matches the video's mood. This becomes the glowing centre of the intro background. Examples by mood — party/birthday: #f97316 (orange) or #ec4899 (pink); night out/luxury: #a855f7 (purple) or #eab308 (gold); fitness/energy: #22c55e (green) or #06b6d4 (cyan); travel/outdoors: #3b82f6 (blue) or #10b981 (teal). Pick something vivid, NOT grey or muted.
- palette.to: a very dark version of a complementary colour, nearly black (e.g. #0a0400, #000a0f, #0a000a). This is the outer edge of the radial gradient.
- Pick 4–8 kinetic phrases: short, punchy, high-energy words or phrases
- Pick 4–8 Ken Burns zones: spread throughout the video, scale between 1.05–1.2
- Ken Burns x/y: 0.0=left/top, 0.5=center, 1.0=right/bottom. When visual keyframes are provided above the transcript, use the actual subject/face position visible in the nearest frame to set x/y — do NOT guess; look at the image.
- Pick 2–4 lower thirds: label a key location, person, or moment from the transcript. label is ALL CAPS (max 4 words). sublabel is mixed case context (e.g. "Bar · Manhattan" or "Creator · Los Angeles").
- Lower thirds must NOT overlap with kinetic phrases — check startFrame ranges carefully
- Lower thirds durationFrames: 75–120 frames (2.5–4 seconds)
- Frames are at 30fps — multiply seconds by 30 to get frames
- Do NOT overlap kinetic phrases with each other
- Respond with ONLY the JSON object — no explanation, no markdown code blocks`;

export async function POST(req: NextRequest) {
  // 📘 framesDir is declared outside try/catch so the cleanup finally-block can reach it
  // regardless of whether frame extraction succeeded or failed.
  let framesDir: string | null = null;

  try {
    const {
      words,
      videoInfo,
      filePath,
    }: {
      words: WordTimestamp[];
      videoInfo: { duration: number; fps: number; durationFrames: number };
      // 📘 filePath is optional — if absent we fall back to text-only analysis.
      // This keeps the route backward-compatible with any callers that don't send it.
      filePath?: string;
    } = await req.json();

    if (!words?.length) {
      return NextResponse.json({ error: "words array is required." }, { status: 400 });
    }

    // 📘 Build a compact transcript string to send to Claude.
    // Format: "word(start-end) word(start-end)..."
    // We round timestamps to 1 decimal to keep the prompt short.
    const transcriptText = words
      .map((w) => `${w.word}(${w.start.toFixed(1)}-${w.end.toFixed(1)}s)`)
      .join(" ");

    // ── Visual frame extraction ───────────────────────────────────────────────
    // 📘 We extract ~10 evenly-spaced JPEG frames from the video and send them to
    // Claude Vision. Claude can then see where subjects/faces actually appear in each
    // moment and use those positions to set accurate Ken Burns x/y focal points,
    // rather than guessing from the transcript text alone.
    //
    // Frames are written to /tmp/ and deleted in the finally block regardless of
    // whether the Claude call succeeds, so we don't leak disk space.
    const frameBlocks: ContentBlock[] = [];

    if (filePath && fs.existsSync(filePath)) {
      try {
        framesDir = `/tmp/frames_${Date.now()}`;
        fs.mkdirSync(framesDir, { recursive: true });

        // 📘 Calculate frame interval to get ~10 frames spread across the whole video.
        // Math.max(2, ...) ensures at least one frame every 2 seconds on very short clips.
        const interval = Math.max(2, Math.floor(videoInfo.duration / 10));

        // 📘 FFmpeg flags:
        // -vf "fps=1/N" — output 1 frame every N seconds
        // scale=480:-1  — resize to 480px wide (small enough for fast API upload)
        // -frames:v 10  — hard cap at 10 frames
        // -q:v 4        — JPEG quality (lower = better; 4 is a good size/quality trade-off)
        await execAsync(
          `ffmpeg -i "${filePath}" -vf "fps=1/${interval},scale=480:-1" -frames:v 10 -q:v 4 "${framesDir}/frame_%03d.jpg" -y`,
          { timeout: 30000 }
        );

        // 📘 Build one header text block, then alternate image + time-label blocks.
        // Claude processes interleaved text and images well — the label anchors each
        // frame to a position in the video timeline.
        const frameFiles = fs.readdirSync(framesDir)
          .filter((f) => f.endsWith(".jpg"))
          .sort();

        if (frameFiles.length > 0) {
          frameBlocks.push({
            type: "text",
            text: "Visual keyframes from the video (use subject/face positions for Ken Burns x/y):",
          });

          for (let i = 0; i < frameFiles.length; i++) {
            const framePath = path.join(framesDir, frameFiles[i]);
            const frameTimeSeconds = i * interval;
            const frameNumber = Math.round(frameTimeSeconds * videoInfo.fps);

            frameBlocks.push({
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: fs.readFileSync(framePath).toString("base64"),
              },
            });
            frameBlocks.push({
              type: "text",
              text: `↑ t=${frameTimeSeconds}s (frame ${frameNumber})`,
            });
          }
        }
      } catch (frameError) {
        // 📘 Frame extraction is best-effort — if FFmpeg fails for any reason
        // (codec issue, corrupt file, timeout) we log and continue with text-only.
        console.warn("[/api/short-form/enhance] Frame extraction failed, using text-only:", frameError);
      }
    }

    // ── Build Claude message ──────────────────────────────────────────────────
    // 📘 If we have visual frames, the message is a ContentBlock array (images + text).
    // Otherwise it's a plain string. Both are valid for sendMessage().
    const transcriptBlock: ContentBlock = {
      type: "text",
      text: `Video transcript with timestamps (${videoInfo.duration.toFixed(1)}s, ${videoInfo.fps}fps, ${videoInfo.durationFrames} frames total):\n\n${transcriptText}`,
    };

    const messageContent = frameBlocks.length > 0
      ? [...frameBlocks, transcriptBlock]
      : `${transcriptBlock.text}`;

    // 📘 Send to Claude — with frames it can see the video visually;
    // without frames it falls back to pure transcript analysis.
    const response = await sendMessage(
      [{ role: "user", content: messageContent }],
      ENHANCE_SYSTEM
    );

    // 📘 Parse Claude's JSON response. We use try/catch because if Claude's output
    // is malformed, JSON.parse() will throw — we catch it and return a helpful error.
    let parsed: { title: string; palette: { from: string; to: string }; kineticPhrases: KineticPhrase[]; kenBurnsZones: KenBurnsZone[]; lowerThirds: LowerThird[]; hookStrength: string; summary: string };
    try {
      // 📘 Remove any accidental markdown code fences Claude might add
      const cleaned = response.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Claude returned invalid JSON. Try again.", raw: response },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);

  } catch (error) {
    console.error("[/api/short-form/enhance]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  } finally {
    // 📘 Always delete the temp frame directory — runs whether the try block
    // succeeded, threw, or returned early. Prevents disk leaks on Railway.
    if (framesDir) {
      try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch {}
    }
  }
}
