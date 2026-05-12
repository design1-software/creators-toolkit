// 📘 WHAT THIS FILE DOES: Analyzes the uploaded video with FFprobe and FFmpeg.
// Steps:
//   1. Read video metadata (duration, fps, dimensions) with FFprobe
//   2. Extract audio as a 16kHz WAV for Whisper
//   3. Normalize audio to -16 LUFS (social media loudness standard)
// URL: POST /api/short-form/analyze
// 🔗 FFprobe docs: https://ffmpeg.org/ffprobe.html

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getVideoInfo, extractAudio } from "@/lib/ffprobe";
import { normalizeAudio } from "@/lib/ffmpeg";

export async function POST(req: NextRequest) {
  try {
    // 📘 Destructure the request body to get the file path and job ID.
    const { filePath, jobId }: { filePath: string; jobId: string } = await req.json();

    if (!filePath || !jobId) {
      return NextResponse.json({ error: "filePath and jobId required." }, { status: 400 });
    }

    // 📘 Step 1: Read video metadata using FFprobe.
    // This tells us how long the video is and how many frames per second it runs at.
    const videoInfo = await getVideoInfo(filePath);

    // 📘 Step 2: Extract raw audio as 16kHz mono WAV.
    // The WAV lives in the same uploads directory, named by job ID.
    const uploadsDir = path.dirname(filePath);
    const rawAudioPath = path.join(uploadsDir, `${jobId}_raw.wav`);
    await extractAudio(filePath, rawAudioPath);

    // 📘 Step 3: Normalize audio volume to -16 LUFS.
    // LUFS (Loudness Units Full Scale) is how social platforms measure volume.
    // -16 LUFS is the standard for TikTok, Reels, and YouTube Shorts.
    const normalizedAudioPath = path.join(uploadsDir, `${jobId}_normalized.wav`);
    await normalizeAudio(rawAudioPath, normalizedAudioPath);

    // 📘 Return all the info the next step (transcribe) will need.
    return NextResponse.json({
      videoInfo,
      audioPath: normalizedAudioPath,
    });

  } catch (error) {
    console.error("[/api/short-form/analyze]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
