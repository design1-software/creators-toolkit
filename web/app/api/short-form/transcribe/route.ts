// 📘 WHAT THIS FILE DOES: Runs Whisper.cpp on the normalized audio to get
// per-word timestamps. Returns the word array for use in the Remotion composition.
// URL: POST /api/short-form/transcribe

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { transcribeAudio, getModelPath } from "@/lib/whisper";

export async function POST(req: NextRequest) {
  try {
    const { audioPath, jobId }: { audioPath: string; jobId: string } = await req.json();

    if (!audioPath || !jobId) {
      return NextResponse.json({ error: "audioPath and jobId required." }, { status: 400 });
    }

    // 📘 Find the Whisper model file. WHISPER_MODEL_DIR points to wherever
    // you've downloaded the .bin model files (e.g. ~/whisper.cpp/models/).
    const modelDir = process.env.WHISPER_MODEL_DIR || path.join(process.cwd(), "models");
    const modelPath = getModelPath(modelDir);

    // 📘 Run Whisper — this is the slowest step (~15–60s depending on video length).
    // It returns an array of { word, start, end } objects.
    const words = await transcribeAudio(audioPath, modelPath);

    return NextResponse.json({ words, wordCount: words.length });

  } catch (error) {
    console.error("[/api/short-form/transcribe]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
