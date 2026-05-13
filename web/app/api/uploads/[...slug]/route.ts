// 📘 WHAT THIS FILE DOES: Serves uploaded video files to the Remotion renderer.
// Next.js standalone mode doesn't serve runtime-created files from public/ reliably —
// the standalone server pre-renders 404 responses for unknown paths and caches them.
// This API route reads files directly from disk, bypassing that layer entirely.
// It returns the correct Content-Type header and supports HTTP range requests,
// which Chromium requires to seek through video files during rendering.
// URL: GET /api/uploads/[...filename]
// 🔗 HTTP range requests: https://www.w3schools.com/js/js_api_fetch.asp

import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

// 📘 A MIME type tells the browser what kind of data it's receiving.
// Without the right MIME type, Chromium blocks video responses (ERR_BLOCKED_BY_ORB).
// 🔗 MIME types: https://www.w3schools.com/html/html_media.asp
const MIME_TYPES: Record<string, string> = {
  ".mp4":  "video/mp4",
  ".mov":  "video/quicktime",
  ".webm": "video/webm",
  ".avi":  "video/x-msvideo",
  ".mkv":  "video/x-matroska",
  ".m4v":  "video/mp4",
  ".3gp":  "video/3gpp",
};

// 📘 GET handler — Next.js App Router calls this when a GET request arrives.
// 'slug' is a catch-all segment: /api/uploads/abc.mp4 → slug = ["abc.mp4"]
// In Next.js 15+, params are returned as a Promise and must be awaited.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;

  // 📘 path.resolve() builds the absolute path AND collapses any '..' segments.
  // This prevents directory traversal attacks where a crafted URL like
  // /api/uploads/../../etc/passwd could read files outside the uploads folder.
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  const filePath = path.resolve(uploadsDir, ...slug);

  // 📘 Security check: the resolved path must stay inside the uploads directory.
  if (!filePath.startsWith(uploadsDir + path.sep)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return new Response("File not found", { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  // 📘 Fall back to 'application/octet-stream' for unknown extensions —
  // that tells the browser "treat this as raw binary data."
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  // 📘 HTTP range requests: the browser sends a 'Range: bytes=start-end' header
  // to fetch only part of a file. This is how video players seek to a timestamp
  // without downloading the entire file. We must support this for Remotion's
  // Chromium renderer to determine video duration and render at the right frame.
  // 🔗 Range requests: https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests
  const rangeHeader = req.headers.get("range");

  if (rangeHeader) {
    // 📘 Parse "bytes=<start>-<end>" — both values are inclusive byte offsets.
    // If 'end' is omitted (e.g. "bytes=0-"), serve from start to end of file.
    const [, rangeStr] = rangeHeader.split("=");
    const [startStr, endStr] = rangeStr.split("-");
    const start = parseInt(startStr, 10);
    const end   = endStr ? parseInt(endStr, 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    // 📘 createReadStream with { start, end } reads only the requested byte range.
    // Readable.toWeb() converts the Node.js stream to a Web-standard ReadableStream
    // that Next.js App Router's Response can accept.
    const nodeStream = fs.createReadStream(filePath, { start, end });
    const webStream  = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      status: 206, // 📘 206 = Partial Content — the standard response for range requests
      headers: {
        "Content-Range":  `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges":  "bytes",
        "Content-Length": chunkSize.toString(),
        "Content-Type":   contentType,
        "Cache-Control":  "no-cache",
      },
    });
  }

  // 📘 Full file request (no Range header) — stream the entire file.
  // Streaming avoids loading the whole video into memory at once.
  const nodeStream = fs.createReadStream(filePath);
  const webStream  = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type":   contentType,
      "Content-Length": fileSize.toString(),
      "Accept-Ranges":  "bytes",  // 📘 advertise range support so Chromium uses it
      "Cache-Control":  "no-cache",
    },
  });
}
