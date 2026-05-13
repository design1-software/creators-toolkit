// 📘 WHAT THIS FILE DOES: Serves rendered MP4 files to the browser for playback and download.
// Next.js standalone pre-renders and caches 404 responses for paths not present at Docker
// build time. Since public/renders/ is created at runtime (after a render job completes),
// the static layer never serves these files — it returns a cached 404 HTML page instead.
// This API route reads the file directly from disk, bypassing that layer entirely.
// URL: GET /api/renders/[...path]  →  e.g. /api/renders/short-form/abc123_enhanced.mp4
// 🔗 HTTP range requests: https://www.w3schools.com/js/js_api_fetch.asp

import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

// 📘 GET handler — Next.js App Router calls this for every GET on /api/renders/*.
// '[...slug]' is a catch-all segment: /api/renders/short-form/a.mp4 → slug = ["short-form","a.mp4"]
// In Next.js 15+, params are a Promise and must be awaited before use.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;

  // 📘 path.resolve() builds an absolute path and collapses any '..' segments.
  // This prevents directory traversal — a URL like /api/renders/../../etc/passwd
  // would resolve outside rendersDir and be rejected by the check below.
  const rendersDir = path.join(process.cwd(), "public", "renders");
  const filePath   = path.resolve(rendersDir, ...slug);

  // 📘 Security: only serve files that live inside the renders directory.
  if (!filePath.startsWith(rendersDir + path.sep)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return new Response("File not found", { status: 404 });
  }

  const stat        = fs.statSync(filePath);
  const fileSize    = stat.size;
  const ext         = path.extname(filePath).toLowerCase();
  // 📘 MP4 is the only format Remotion renders to, but we handle the others for safety.
  const contentType = ext === ".mp4" ? "video/mp4"
                    : ext === ".webm" ? "video/webm"
                    : "application/octet-stream";

  // 📘 Range requests let the browser fetch a slice of the file (e.g. "bytes=0-1048575").
  // The HTML5 <video> player uses this to seek to a timestamp without re-downloading
  // the whole file. We must handle it, otherwise scrubbing won't work in the player.
  const rangeHeader = req.headers.get("range");

  if (rangeHeader) {
    const [, rangeStr] = rangeHeader.split("=");
    const [startStr, endStr] = rangeStr.split("-");
    const start     = parseInt(startStr, 10);
    const end       = endStr ? parseInt(endStr, 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    // 📘 createReadStream with { start, end } reads only the requested byte range,
    // keeping memory usage low even for large video files.
    // Readable.toWeb() converts the Node.js stream into a Web-standard ReadableStream
    // that Next.js Response can accept.
    const nodeStream = fs.createReadStream(filePath, { start, end });
    const webStream  = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      status: 206, // 📘 206 Partial Content is required for range request responses
      headers: {
        "Content-Range":        `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges":        "bytes",
        "Content-Length":       chunkSize.toString(),
        "Content-Type":         contentType,
        "Cache-Control":        "no-cache",
        "Content-Disposition":  `inline; filename="${path.basename(filePath)}"`,
      },
    });
  }

  // 📘 Full file response — stream the entire MP4 to the browser.
  // 'Accept-Ranges: bytes' tells the browser it can send range requests next time.
  // 'Content-Disposition: inline' lets the browser play the video in the page;
  // the <a download> tag on the frontend still triggers a Save dialog when clicked.
  const nodeStream = fs.createReadStream(filePath);
  const webStream  = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type":         contentType,
      "Content-Length":       fileSize.toString(),
      "Accept-Ranges":        "bytes",
      "Cache-Control":        "no-cache",
      "Content-Disposition":  `inline; filename="${path.basename(filePath)}"`,
    },
  });
}
