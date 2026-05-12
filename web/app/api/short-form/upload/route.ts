// 📘 WHAT THIS FILE DOES: Receives an uploaded video file from the browser and
// saves it to the local filesystem so other steps can process it.
// URL: POST /api/short-form/upload
// Returns: { jobId, filePath, fileName }
// 🔗 Next.js route handlers: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid"; // generates unique IDs for each job

// 📘 The uploads directory is inside the web project's public folder.
// Files here are accessible to both the server and (if needed) the browser.
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export async function POST(req: NextRequest) {
  try {
    // 📘 Ensure the uploads directory exists before trying to write to it.
    // { recursive: true } means it won't error if the folder already exists.
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    // 📘 'formData()' reads a multipart form upload — the standard way browsers send files.
    // Unlike JSON, file uploads use multipart encoding to handle binary data.
    const formData = await req.formData();

    // 📘 formData.get() retrieves a field by name. We expect the file under the key "video".
    const file = formData.get("video") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No video file provided." }, { status: 400 });
    }

    // 📘 Validate that the upload is actually a video file.
    // file.type is the MIME type — for videos it starts with "video/"
    if (!file.type.startsWith("video/")) {
      return NextResponse.json(
        { error: "Only video files are accepted." },
        { status: 400 }
      );
    }

    // 📘 Generate a unique job ID for this upload.
    // uuidv4() creates a random ID like "a3f8c2d1-..." — no two will ever collide.
    const jobId = uuidv4();

    // 📘 Build a safe file path using the job ID to avoid conflicts between uploads.
    // path.extname() extracts the file extension (e.g. ".mp4")
    const ext = path.extname(file.name) || ".mp4";
    const savedFileName = `${jobId}${ext}`;
    const filePath = path.join(UPLOADS_DIR, savedFileName);

    // 📘 file.arrayBuffer() reads the entire file into memory as raw bytes.
    // We then convert it to a Node.js Buffer and write it to disk.
    const bytes = await file.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(bytes));

    return NextResponse.json({
      jobId,
      filePath,          // absolute path on server disk
      fileName: savedFileName,
      originalName: file.name,
    });

  } catch (error) {
    console.error("[/api/short-form/upload]", error);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
