// 📘 WHAT THIS FILE DOES: Triggers the Remotion CLI to render the final enhanced video.
// It passes the uploaded video's HTTP URL directly to the Remotion composition,
// then runs 'npx remotion render src/index.ts CaptionedVideo' with all the props.
// URL: POST /api/short-form/render
// Returns: { url, fileName } public URL of the finished MP4

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import type { KenBurnsZone, KineticPhrase } from "@/lib/types";
import type { WordTimestamp } from "@/lib/whisper";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const {
      jobId,
      filePath,
      words,
      kenBurnsZones,
      kineticPhrases,
      videoInfo,
      summary,
      hookStrength,
    }: {
      jobId: string;
      filePath: string;
      words: WordTimestamp[];
      kenBurnsZones: KenBurnsZone[];
      kineticPhrases: KineticPhrase[];
      videoInfo: { durationFrames: number; fps: number };
      summary: string;
      hookStrength: string;
    } = await req.json();

    // 📘 The intro title card runs for 3 seconds at 30fps before the main footage begins.
    // We add this to the total duration so Remotion allocates enough frames for both.
    // Remotion's Series component resets useCurrentFrame() to 0 for each sequence,
    // so all existing kenBurnsZones and kineticPhrases frame numbers stay correct.
    const INTRO_FRAMES = 90;

    const remotionPath = process.env.REMOTION_PROJECT_PATH;
    if (!remotionPath) {
      throw new Error("REMOTION_PROJECT_PATH is not set in .env.local");
    }

    // 📘 Save the rendered MP4 directly into the web app's public/ folder
    // so the browser can stream or download it via a normal URL.
    // path.join combines directory segments safely for any OS.
    // 🔗 Node.js path: https://www.w3schools.com/nodejs/nodejs_filesystem.asp
    const outputDir = path.join(process.cwd(), "public", "renders", "short-form");
    fs.mkdirSync(outputDir, { recursive: true });
    const outputFileName = `${jobId}_enhanced.mp4`;
    const outputPath = path.join(outputDir, outputFileName);

    // 📘 Build the full URL for the uploaded video so Remotion's Chromium renderer
    // can fetch it directly from the Next.js server.
    //
    // WHY NOT copy to Remotion's public/ folder?
    // Remotion caches its bundle in a temp directory after the first render.
    // Files added to project/public/ AFTER the bundle was created are invisible —
    // the bundle's copy of public/ is frozen at bundle time. Fetching via HTTP
    // bypasses the bundle entirely and always hits the live Next.js file server.
    //
    // PORT is the port Next.js is listening on (Railway sets this via $PORT).
    const videoFileName = path.basename(filePath); // e.g. "abc123.mp4"
    const port = process.env.PORT || "8080";
    const props = {
      // 📘 Full HTTP URL pointing to our /api/uploads/ route handler.
      // We cannot use /uploads/ (static) because Next.js standalone caches a 404
      // for any path not present at build time, and public/uploads/ is runtime-created.
      // The API route reads directly from disk with the correct Content-Type + range support.
      videoSrc: `http://localhost:${port}/api/uploads/${videoFileName}`,
      words,
      kenBurnsZones,
      kineticPhrases,
      // 📘 Claude's creative analysis — drives the 3-second intro title card.
      summary: summary ?? "",
      hookStrength: hookStrength ?? "medium",
      // 📘 How many frames the intro occupies — lets CaptionedVideo split its Series sequences.
      introFrames: INTRO_FRAMES,
    };

    // 📘 JSON.stringify the props, then escape double-quotes for shell safety.
    // The shell will strip one layer of quotes — we need to escape so they survive.
    const propsJson = JSON.stringify(props).replace(/"/g, '\\"');

    // 📘 Build the full Remotion render command.
    // --duration-in-frames overrides the composition's default with the real video length.
    // --fps sets the frame rate to match the source video.
    // 📘 --gl=swiftshader uses software rendering — required on cloud servers with no GPU.
    // --concurrency=1 renders one frame at a time to stay within Railway's memory limits.
    // These replace remotion.config.ts which was causing a crash on load.
    // 📘 'src/index.ts' is the entry point — the file that calls registerRoot().
    // Remotion 4.x requires it explicitly; without it the CLI exits with
    // "No entry point specified."
    const command = [
      `cd "${remotionPath}"`,
      `&&`,
      `npx remotion render src/index.ts CaptionedVideo "${outputPath}"`,
      `--props="${propsJson}"`,
      // 📘 Total frames = intro card + actual video footage.
      // Series resets useCurrentFrame() to 0 inside each sequence, so all existing
      // kenBurnsZones and kineticPhrases frame numbers stay correct without any changes.
      `--duration-in-frames=${videoInfo.durationFrames + INTRO_FRAMES}`,
      `--fps=${videoInfo.fps}`,
      `--gl=swiftshader`,
      `--concurrency=1`,
    ].join(" ");

    // 📘 Run the render — this is the longest step, can take 30–120 seconds.
    await execAsync(command, { timeout: 600000 }); // 10 minute timeout

    // 📘 Return via the /api/renders/ route handler — not the /renders/ static path.
    // Next.js standalone caches 404 for runtime-created directories; the API route
    // bypasses that by reading directly from disk with the correct Content-Type.
    const publicUrl = `/api/renders/short-form/${outputFileName}`;
    return NextResponse.json({ url: publicUrl, fileName: outputFileName });

  } catch (error) {
    console.error("[/api/short-form/render]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
