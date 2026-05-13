// 📘 WHAT THIS FILE DOES: Sends the transcript to Claude for creative analysis.
// Claude reads the transcription and identifies:
//   - 4–8 kinetic phrases (high-impact moments for full-screen text pops)
//   - 4–8 Ken Burns zones (which moments to zoom into and where)
// URL: POST /api/short-form/enhance
// Returns: { kineticPhrases, kenBurnsZones } ready to pass to Remotion

import { NextRequest, NextResponse } from "next/server";
import { sendMessage } from "@/lib/claude";
import type { WordTimestamp } from "@/lib/whisper";
import type { KenBurnsZone, KineticPhrase } from "@/lib/types";

// 📘 The system prompt tells Claude exactly what role to play and what to output.
// We ask for JSON so we can parse it reliably — no guessing at the format.
const ENHANCE_SYSTEM = `You are a social media video editor.
Given a video transcript with word-level timestamps, you identify the most impactful moments.

You must respond with ONLY valid JSON matching this exact structure:
{
  "title": "3–5 WORD PUNCHY TITLE",
  "kineticPhrases": [
    { "text": "THE PHRASE", "startFrame": 45, "durationFrames": 45 }
  ],
  "kenBurnsZones": [
    { "startFrame": 0, "endFrame": 90, "scale": 1.12, "x": 0.5, "y": 0.5 }
  ],
  "hookStrength": "strong|medium|weak",
  "summary": "One sentence describing what this video is about."
}

Rules:
- title: 3–5 words MAX, ALL CAPS, hook-first (e.g. "BIRTHDAY NIGHT OUT", "WE'RE GOING IN"). This appears as a full-screen title card — it must be short and punchy, NOT a sentence.
- Pick 4–8 kinetic phrases: short, punchy, high-energy words or phrases
- Pick 4–8 Ken Burns zones: spread throughout the video, scale between 1.05–1.2
- Ken Burns x/y: 0.0=left/top, 0.5=center, 1.0=right/bottom
- Frames are at 30fps — multiply seconds by 30 to get frames
- Do NOT overlap kinetic phrases with each other
- Respond with ONLY the JSON object — no explanation, no markdown code blocks`;

export async function POST(req: NextRequest) {
  try {
    const {
      words,
      videoInfo,
    }: {
      words: WordTimestamp[];
      videoInfo: { duration: number; fps: number; durationFrames: number };
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

    const userMessage = `Video transcript with timestamps (${videoInfo.duration.toFixed(1)}s, ${videoInfo.fps}fps, ${videoInfo.durationFrames} frames total):\n\n${transcriptText}`;

    // 📘 Send the transcript to Claude and get the kinetic/Ken Burns analysis back.
    const response = await sendMessage(
      [{ role: "user", content: userMessage }],
      ENHANCE_SYSTEM
    );

    // 📘 Parse Claude's JSON response. We use try/catch because if Claude's output
    // is malformed, JSON.parse() will throw — we catch it and return a helpful error.
    let parsed: { title: string; kineticPhrases: KineticPhrase[]; kenBurnsZones: KenBurnsZone[]; hookStrength: string; summary: string };
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
  }
}
