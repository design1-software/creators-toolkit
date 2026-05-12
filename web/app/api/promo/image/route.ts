// 📘 WHAT THIS FILE DOES: Generates a background image for the promo video using Kie.ai.
// It takes the AI-crafted image prompt from the brief-parse step, calls Kie.ai,
// waits for the image to be ready, downloads it, and saves it into the Remotion
// project's public/ folder so Remotion can use it during rendering.
// 🔗 Next.js API routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { generateImage } from "@/lib/kieai";

export async function POST(req: NextRequest) {
  try {
    const { jobId, imagePrompt } = await req.json();

    if (!jobId || !imagePrompt) {
      return NextResponse.json(
        { error: "jobId and imagePrompt are required" },
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

    // 📘 Step 1: Call Kie.ai to generate the image.
    // generateImage polls internally and returns only when the image CDN URL is ready.
    // "3:2" is the closest aspect ratio to 16:9 widescreen that Kie.ai supports.
    const imageUrl = await generateImage(imagePrompt, "3:2");

    // 📘 Step 2: Download the image from the CDN to local disk.
    // We fetch the raw bytes, then write them to a file.
    // 🔗 Node.js file system: https://www.w3schools.com/nodejs/nodejs_filesystem.asp
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to download image from Kie.ai: ${imageRes.status}`);
    }

    const imageBuffer = await imageRes.arrayBuffer();

    // 📘 Save into the Remotion project's public/ folder.
    // Remotion's staticFile() helper resolves paths relative to this folder at render time.
    const imageDir = path.join(remotionProjectPath, "public", "renders", "promo");
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    const fileName = `${jobId}-bg.jpg`;
    const outputPath = path.join(imageDir, fileName);
    fs.writeFileSync(outputPath, Buffer.from(imageBuffer));

    // 📘 Return the path relative to Remotion's public/ folder.
    // PromoVideo passes this to staticFile() which resolves it at render time.
    const imageSrc = `renders/promo/${fileName}`;
    return NextResponse.json({ imageSrc });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
