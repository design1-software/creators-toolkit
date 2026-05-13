// 📘 WHAT THIS FILE DOES: Generates mood-matched background music for a quote video.
// It calls the Suno API with a music prompt chosen by Claude, waits for the track
// to generate, downloads the MP3, saves it to disk, and returns a URL Remotion can fetch.
// URL: POST /api/quotes/music
// Returns: { audioSrc } — an HTTP URL pointing to the saved MP3

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// 📘 generateMusic() handles the full Suno API flow: submit → poll → return CDN URL.
// We import it from the shared lib so this route doesn't duplicate that logic.
import { generateMusic } from "@/lib/suno";

export async function POST(req: NextRequest) {
  try {
    const { musicPrompt, jobId }: { musicPrompt: string; jobId: string } = await req.json();

    if (!musicPrompt || !jobId) {
      return NextResponse.json(
        { error: "musicPrompt and jobId are required" },
        { status: 400 }
      );
    }

    // 📘 Call Suno — this can take 30–90 seconds while Suno generates the track.
    // generateMusic() polls until the audio is ready and returns a CDN URL.
    const cdnUrl = await generateMusic(musicPrompt);

    // 📘 Download the MP3 from Suno's CDN and save it to our public/uploads/ folder.
    // We serve it via /api/uploads/ so Remotion's Chromium renderer can fetch it
    // with the correct CORS headers — the same way we serve video and WAV files.
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    fs.mkdirSync(uploadsDir, { recursive: true });

    const fileName = `${jobId}_music.mp3`;
    const filePath = path.join(uploadsDir, fileName);

    // 📘 fetch() the MP3 bytes from the CDN URL, then write them to disk.
    // arrayBuffer() reads the entire response body as raw bytes.
    // Buffer.from() converts those bytes into a Node.js Buffer we can write with fs.
    // 🔗 fetch API: https://www.w3schools.com/js/js_api_fetch.asp
    const audioRes = await fetch(cdnUrl);
    if (!audioRes.ok) {
      throw new Error(`Failed to download music from Suno CDN: ${audioRes.status} ${audioRes.statusText}`);
    }
    const audioBytes = await audioRes.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(audioBytes));

    // 📘 Return the /api/uploads/ URL — not /uploads/ (static path).
    // Next.js standalone caches 404 for runtime-created files in public/;
    // the API route reads directly from disk and always returns the latest file.
    const port = process.env.PORT || "8080";
    const audioSrc = `http://localhost:${port}/api/uploads/${fileName}`;

    return NextResponse.json({ audioSrc });

  } catch (error) {
    console.error("[/api/quotes/music]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
