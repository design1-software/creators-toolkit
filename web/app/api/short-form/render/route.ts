// 📘 WHAT THIS FILE DOES: Triggers the Remotion CLI to render the final enhanced video.
// It copies the video and captions to the Remotion project's public folder,
// then runs 'npx remotion render CaptionedVideo' with all the props.
// URL: POST /api/short-form/render
// Returns: { outputPath } path to the finished MP4

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
    }: {
      jobId: string;
      filePath: string;
      words: WordTimestamp[];
      kenBurnsZones: KenBurnsZone[];
      kineticPhrases: KineticPhrase[];
      videoInfo: { durationFrames: number; fps: number };
    } = await req.json();

    const remotionPath = process.env.REMOTION_PROJECT_PATH;
    if (!remotionPath) {
      throw new Error("REMOTION_PROJECT_PATH is not set in .env.local");
    }

    // 📘 Copy the uploaded video into the Remotion project's public/ folder.
    // Remotion can only serve files from its own public/ directory.
    const remotionPublic = path.join(remotionPath, "public");
    fs.mkdirSync(remotionPublic, { recursive: true });

    const videoExt = path.extname(filePath);
    const remotionVideoName = `${jobId}${videoExt}`;
    const remotionVideoPath = path.join(remotionPublic, remotionVideoName);
    fs.copyFileSync(filePath, remotionVideoPath);

    // 📘 Save the rendered MP4 directly into the web app's public/ folder
    // so the browser can stream or download it via a normal URL.
    // path.join combines directory segments safely for any OS.
    // 🔗 Node.js path: https://www.w3schools.com/nodejs/nodejs_filesystem.asp
    const outputDir = path.join(process.cwd(), "public", "renders", "short-form");
    fs.mkdirSync(outputDir, { recursive: true });
    const outputFileName = `${jobId}_enhanced.mp4`;
    const outputPath = path.join(outputDir, outputFileName);

    // 📘 Build the props object. This gets passed to CaptionedVideo as JSON.
    // '/' prefix because Remotion serves from its public/ folder at runtime.
    const props = {
      videoSrc: `/${remotionVideoName}`,
      words,
      kenBurnsZones,
      kineticPhrases,
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
    const command = [
      `cd "${remotionPath}"`,
      `&&`,
      `npx remotion render CaptionedVideo "${outputPath}"`,
      `--props="${propsJson}"`,
      `--duration-in-frames=${videoInfo.durationFrames}`,
      `--fps=${videoInfo.fps}`,
      `--gl=swiftshader`,
      `--concurrency=1`,
    ].join(" ");

    // 📘 Run the render — this is the longest step, can take 30–120 seconds.
    await execAsync(command, { timeout: 600000 }); // 10 minute timeout

    // 📘 Return a public web URL — /renders/short-form/... — so the browser can play it.
    const publicUrl = `/renders/short-form/${outputFileName}`;
    return NextResponse.json({ url: publicUrl, fileName: outputFileName });

  } catch (error) {
    console.error("[/api/short-form/render]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
