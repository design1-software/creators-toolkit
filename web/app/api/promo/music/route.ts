// 📘 WHAT THIS FILE DOES: Generates background music via Suno and mixes it with the voiceover.
// Steps:
//   1. Call Suno API to generate an instrumental background track
//   2. Download the MP3 from Suno's CDN
//   3. Mix it with the existing voiceover using FFmpeg (music at 15% volume)
//   4. Save the mixed audio where Remotion can find it
// The render step then uses the mixed audio as the video's single audio track.
// 🔗 Next.js API routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { generateMusic } from "@/lib/suno";
import { mixAudio } from "@/lib/ffmpeg";

export async function POST(req: NextRequest) {
  try {
    const { jobId, voiceSrc, musicPrompt } = await req.json();

    if (!jobId || !voiceSrc || !musicPrompt) {
      return NextResponse.json(
        { error: "jobId, voiceSrc, and musicPrompt are required" },
        { status: 400 }
      );
    }

    const remotionProjectPath = process.env.REMOTION_PROJECT_PATH;
    if (!remotionProjectPath) {
      return NextResponse.json(
        { error: "REMOTION_PROJECT_PATH env var is not set" },
        { status: 500 }
      );
    }

    // 📘 Step 1: Generate music via Suno.
    // generateMusic polls internally and returns the CDN URL when ready.
    const musicUrl = await generateMusic(musicPrompt);

    // 📘 Step 2: Download the Suno MP3 to a temporary local file.
    const musicRes = await fetch(musicUrl);
    if (!musicRes.ok) {
      throw new Error(`Failed to download music from Suno: ${musicRes.status}`);
    }
    const musicBuffer = await musicRes.arrayBuffer();

    const audioDir = path.join(remotionProjectPath, "public", "renders", "promo");
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    // 📘 Save the downloaded music to a temp file for FFmpeg to read.
    // We'll delete it after mixing since only the mixed version is needed.
    const musicTempPath = path.join(audioDir, `${jobId}-music-temp.mp3`);
    fs.writeFileSync(musicTempPath, Buffer.from(musicBuffer));

    // 📘 Step 3: Reconstruct the absolute path to the voiceover file.
    // voiceSrc is relative to Remotion's public/ folder (e.g., "renders/promo/abc-vo.mp3").
    // FFmpeg needs the absolute filesystem path to read the file.
    const voiceAbsPath = path.join(remotionProjectPath, "public", voiceSrc);

    // 📘 Step 4: Mix voiceover + music using FFmpeg.
    // The mixAudio function in lib/ffmpeg.ts sets music to 10% volume by default
    // so the voiceover always stays clear and dominant.
    // 🔗 FFmpeg amix filter: https://ffmpeg.org/ffmpeg-filters.html#amix
    const mixedFileName = `${jobId}-mixed.mp3`;
    const mixedAbsPath = path.join(audioDir, mixedFileName);
    await mixAudio(voiceAbsPath, musicTempPath, mixedAbsPath);

    // 📘 Clean up the temp music file — we only need the mixed version.
    fs.unlinkSync(musicTempPath);

    // 📘 Return the mixed audio path relative to Remotion's public/ folder.
    // The render route passes this as voiceSrc to the PromoVideo composition.
    const mixedAudioSrc = `renders/promo/${mixedFileName}`;
    return NextResponse.json({ mixedAudioSrc });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
