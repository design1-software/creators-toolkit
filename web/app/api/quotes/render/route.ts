// 📘 WHAT THIS FILE DOES: API route that triggers the Remotion CLI to render a quote video.
// It receives the quote, author, and style parameters chosen by Claude, then shells out
// to the Remotion project to render the AnimatedQuote composition as an MP4.
// 🔗 Remotion rendering: https://www.remotion.dev/docs/render

import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

// 📘 'promisify' wraps a callback-based function so it works with async/await.
// exec normally uses callbacks — promisify turns it into a Promise.
// 🔗 async/await: https://www.w3schools.com/js/js_async.asp
const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const { quote, author, style, jobId } = await req.json();

    if (!quote || !author || !style || !jobId) {
      return NextResponse.json(
        { error: "quote, author, style, and jobId are required" },
        { status: 400 }
      );
    }

    // 📘 Read the Remotion project path from the environment variable.
    // This avoids hardcoding machine-specific paths in the code.
    const remotionProjectPath = process.env.REMOTION_PROJECT_PATH;
    if (!remotionProjectPath) {
      return NextResponse.json(
        { error: "REMOTION_PROJECT_PATH env var is not set" },
        { status: 500 }
      );
    }

    // 📘 Build the output path for the rendered video.
    // 'path.join' safely combines path segments regardless of OS.
    // 🔗 Node.js path module: https://www.w3schools.com/nodejs/nodejs_filesystem.asp
    const outputDir = path.join(
      process.cwd(),
      "public",
      "renders",
      "quotes"
    );
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFileName = `quote-${jobId}.mp4`;
    const outputPath = path.join(outputDir, outputFileName);

    // 📘 Calculate duration in frames: durationSeconds × fps (30).
    const durationInFrames = (style.durationSeconds ?? 20) * 30;

    // 📘 Build the props object — this gets passed to the Remotion composition as JSON.
    // JSON.stringify() converts a JavaScript object to a JSON string.
    // 🔗 JSON.stringify: https://www.w3schools.com/js/js_json_stringify.asp
    const props = JSON.stringify({
      quote,
      author,
      gradientFrom: style.gradientFrom ?? "#1a1a2e",
      gradientTo: style.gradientTo ?? "#16213e",
      accentColor: style.accentColor ?? "#7c3aed",
      textColor: style.textColor ?? "#ffffff",
      animationStyle: style.animationStyle ?? "word-by-word",
      fontSize: style.fontSize ?? "large",
    });

    // 📘 Shell out to the Remotion CLI inside the project folder.
    // The --props flag passes our style data to the React component.
    // --duration-in-frames overrides the default composition length.
    // 📘 --gl=swiftshader: software GPU renderer — required on cloud servers with no real GPU.
    // --concurrency=1: render one frame at a time to avoid out-of-memory on Railway free tier.
    const command = `cd "${remotionProjectPath}" && npx remotion render src/index.ts AnimatedQuote "${outputPath}" --props='${props}' --duration-in-frames=${durationInFrames} --fps=30 --gl=swiftshader --concurrency=1`;

    await execAsync(command, { timeout: 300_000 }); // 5-minute timeout

    // 📘 Build a public URL the browser can use to download or play the video.
    const publicUrl = `/renders/quotes/${outputFileName}`;
    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
