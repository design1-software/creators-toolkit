// 📘 WHAT THIS FILE DOES: Calls ElevenLabs to generate the voiceover MP3 for the promo video.
// It receives the script extracted from the brief, sends it to ElevenLabs,
// and saves the resulting audio file directly into the Remotion project's public/ folder
// so Remotion can reference it during rendering.
// 🔗 Next.js API routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { generateVoiceover } from "@/lib/elevenlabs";

// 📘 ElevenLabs assigns a unique ID to each available voice.
// "Adam" is a clear, professional male voice available on all ElevenLabs plans.
// To use a different voice: log into elevenlabs.io → Voices → copy the Voice ID.
// 🔗 ElevenLabs voices: https://elevenlabs.io/docs/voices/overview
const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam

export async function POST(req: NextRequest) {
  try {
    const { script, jobId } = await req.json();

    if (!script || !jobId) {
      return NextResponse.json(
        { error: "script and jobId are required" },
        { status: 400 }
      );
    }

    // 📘 Read the Remotion project path from the environment variable.
    // We save the audio file directly into Remotion's public/ folder so it can
    // reference the file by a simple relative path during the render.
    const remotionProjectPath = process.env.REMOTION_PROJECT_PATH;
    if (!remotionProjectPath) {
      return NextResponse.json(
        { error: "REMOTION_PROJECT_PATH env var is not set" },
        { status: 500 }
      );
    }

    // 📘 Build the output path for the MP3 file.
    // 'path.join' safely combines directory parts — handles slashes on any OS.
    // 🔗 Node.js path module: https://www.w3schools.com/nodejs/nodejs_filesystem.asp
    const audioDir = path.join(remotionProjectPath, "public", "renders", "promo");
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const fileName = `${jobId}-vo.mp3`;
    const outputPath = path.join(audioDir, fileName);

    // 📘 Call the ElevenLabs wrapper from lib/elevenlabs.ts.
    // It handles the fetch request and saves the binary audio data to disk.
    await generateVoiceover(script, DEFAULT_VOICE_ID, outputPath);

    // 📘 The voiceSrc is the path relative to Remotion's public/ folder.
    // Remotion's staticFile() helper will resolve this at render time.
    // e.g. "renders/promo/abc123-vo.mp3" → {remotionProject}/public/renders/promo/abc123-vo.mp3
    const voiceSrc = `renders/promo/${fileName}`;

    return NextResponse.json({ voiceSrc });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
