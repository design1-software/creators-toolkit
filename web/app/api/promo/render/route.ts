// 📘 WHAT THIS FILE DOES: Triggers the Remotion CLI to render the PromoVideo composition.
// It receives all production parameters (brand name, tagline, colors, voiceSrc, etc.)
// and shells out to the Remotion project to render the final MP4 brand video.
// 🔗 Remotion CLI rendering: https://www.remotion.dev/docs/render

import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

// 📘 'promisify' converts exec() from callback style to async/await style.
// This lets us use 'await' instead of nested callback functions.
// 🔗 async/await: https://www.w3schools.com/js/js_async.asp
const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const { jobId, production, voiceSrc, backgroundImageSrc, backgroundImageSrcs } = await req.json();

    if (!jobId || !production) {
      return NextResponse.json(
        { error: "jobId and production are required" },
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

    // 📘 The rendered MP4 saves directly into the web app's public/ folder
    // so it's immediately accessible via a browser URL like /renders/promo/abc123.mp4.
    const outputDir = path.join(process.cwd(), "public", "renders", "promo");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFileName = `${jobId}.mp4`;
    const outputPath = path.join(outputDir, outputFileName);

    // 📘 Calculate how many frames the video should be.
    // We measure the actual audio file duration with ffprobe — much more accurate than
    // trusting Claude's word-count estimate, which is often off by 30–50%.
    // ffprobe is part of FFmpeg and reports the exact duration in seconds.
    // Only fall back to Claude's estimate when no audio file is provided.
    // 🔗 JavaScript Math: https://www.w3schools.com/js/js_math.asp
    let durationSeconds: number;
    if (voiceSrc) {
      // 📘 ffprobe reads audio metadata without decoding the whole file — it's very fast.
      // -v quiet suppresses noisy log output. -of csv=p=0 returns just the number.
      const voicePath = path.join(remotionProjectPath, "public", voiceSrc);
      try {
        const { stdout } = await execAsync(
          `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${voicePath}"`
        );
        const measured = parseFloat(stdout.trim());
        durationSeconds = !isNaN(measured) && measured > 0
          ? Math.ceil(measured)                                   // round up so audio never gets cut off
          : Math.max(20, Math.min(60, Number(production.durationSeconds) || 30));
      } catch {
        // ffprobe not available or file unreadable — fall back to Claude's estimate
        durationSeconds = Math.max(20, Math.min(60, Number(production.durationSeconds) || 30));
      }
    } else {
      durationSeconds = Math.max(20, Math.min(60, Number(production.durationSeconds) || 30));
    }
    const durationInFrames = Math.round(durationSeconds * 30);

    // 📘 Build the props object — passed to the PromoVideo React component at render time.
    // JSON.stringify() converts the JS object to a JSON string for the CLI flag.
    // 📘 Escape double-quotes inside the JSON then wrap in double-quotes.
    // Single-quote wrapping ('...') breaks whenever the text contains an apostrophe
    // (e.g. a brand name like "McDonald's") — the shell treats it as the closing quote.
    const propsJson = JSON.stringify({
      brandName: production.brandName ?? "Brand",
      tagline: production.tagline ?? "",
      keyMessages: production.keyMessages ?? [],
      cta: production.cta ?? "",
      gradientFrom: production.gradientFrom ?? "#0a0a0f",
      gradientTo: production.gradientTo ?? "#1a1a2e",
      accentColor: production.accentColor ?? "#7c3aed",
      textColor: production.textColor ?? "#ffffff",
      // 📘 voiceSrc is the mixed audio (voiceover + music) relative to Remotion public/.
      voiceSrc: voiceSrc ?? "",
      // 📘 backgroundImageSrcs is the full array of user-uploaded images (Option B).
      // When provided, PromoVideo crossfades through each image in sequence.
      // Falls back to the single backgroundImageSrc (Kie.ai) or CSS gradient if absent.
      backgroundImageSrcs: Array.isArray(backgroundImageSrcs) && backgroundImageSrcs.length > 0
        ? backgroundImageSrcs
        : undefined,
      backgroundImageSrc: backgroundImageSrc ?? undefined,
    }).replace(/"/g, '\\"');

    // 📘 Build the shell command that tells the Remotion CLI what to render.
    // We 'cd' into the Remotion project folder first so Remotion can find its config.
    // --props passes our data as JSON, --duration-in-frames sets the video length.
    // 📘 --gl=swiftshader: software GPU renderer, required on cloud servers with no GPU.
    // --concurrency=1: one frame at a time to avoid out-of-memory on Railway free tier.
    const command = `cd "${remotionProjectPath}" && npx remotion render src/index.ts PromoVideo "${outputPath}" --props="${propsJson}" --duration-in-frames=${durationInFrames} --fps=30 --gl=swiftshader --concurrency=1`;

    // 📘 The render can take 1–5 minutes depending on video length and machine speed.
    // The timeout is set to 10 minutes (600,000 ms) to handle slower machines.
    await execAsync(command, { timeout: 600_000 });

    // 📘 Return via /api/renders/ route handler — not the static /renders/ path.
    // Next.js standalone caches 404 for runtime-created directories; the API route
    // bypasses that by reading directly from disk with the correct Content-Type.
    const publicUrl = `/api/renders/promo/${outputFileName}`;
    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
