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
  // 📘 WAV is the normalized audio format produced by FFmpeg in the analyze step.
  // Remotion's useAudioData() fetches this file via HTTP, so the route must serve it.
  ".wav":  "audio/wav",
};

// 📘 Converts a Node.js fs.ReadStream into a Web-standard ReadableStream safely.
//
// WHY NOT use Readable.toWeb()?
// When a browser video player fetches a range of bytes and then closes the
// connection early (normal behaviour — it does this constantly while buffering),
// the underlying Node.js stream is still reading and tries to push data into
// the Web ReadableStream controller that has already been closed by the disconnect.
// Readable.toWeb() doesn't handle this: the enqueue() call throws ERR_INVALID_STATE
// and, because there is no catch, it escapes as an uncaughtException that crashes
// the Next.js process repeatedly.
//
// The fix: wrap every controller operation in try/catch so a closed controller
// is silently ignored, and call nodeStream.destroy() in the cancel() callback so
// the underlying file read is cleaned up when the client disconnects.
function safeReadStream(
  nodeStream: fs.ReadStream
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      // 📘 'data' fires each time a chunk of bytes is ready to send.
      // The chunk can be a Buffer (binary) or string depending on stream encoding.
      // We convert both to Uint8Array — the type ReadableStream controller expects.
      nodeStream.on("data", (chunk: Buffer | string) => {
        try {
          const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
          controller.enqueue(new Uint8Array(bytes));
        } catch {
          // Controller is already closed — client disconnected. Stop reading.
          nodeStream.destroy();
        }
      });

      // 📘 'end' fires when the entire file range has been read.
      nodeStream.on("end", () => {
        try {
          controller.close();
        } catch {
          // Already closed — no action needed.
        }
      });

      // 📘 'error' fires if the file read fails (e.g. disk error).
      nodeStream.on("error", (err) => {
        try {
          controller.error(err);
        } catch {
          // Controller already closed — swallow silently.
        }
      });
    },

    // 📘 cancel() is called by the browser when it closes the connection.
    // Without this, the Node.js stream keeps reading from disk even after
    // nobody is receiving the data — wasting I/O and triggering 'data' events
    // that would throw ERR_INVALID_STATE.
    cancel() {
      nodeStream.destroy();
    },
  });
}

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
  const filePath   = path.resolve(uploadsDir, ...slug);

  // 📘 Security check: the resolved path must stay inside the uploads directory.
  if (!filePath.startsWith(uploadsDir + path.sep)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return new Response("File not found", { status: 404 });
  }

  const stat        = fs.statSync(filePath);
  const fileSize    = stat.size;
  const ext         = path.extname(filePath).toLowerCase();
  // 📘 Fall back to 'application/octet-stream' for unknown extensions —
  // that tells the browser "treat this as raw binary data."
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  // 📘 HTTP range requests: the browser sends a 'Range: bytes=start-end' header
  // to fetch only part of a file. This is how video players seek to a timestamp
  // without downloading the entire file. We must support this for Remotion's
  // Chromium renderer to determine video duration and render at the right frame.
  const rangeHeader = req.headers.get("range");

  if (rangeHeader) {
    // 📘 Parse "bytes=<start>-<end>" — both values are inclusive byte offsets.
    // If 'end' is omitted (e.g. "bytes=0-"), serve from start to end of file.
    const [, rangeStr]  = rangeHeader.split("=");
    const [startStr, endStr] = rangeStr.split("-");
    const start     = parseInt(startStr, 10);
    const end       = endStr ? parseInt(endStr, 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const nodeStream = fs.createReadStream(filePath, { start, end });

    return new Response(safeReadStream(nodeStream), {
      status: 206, // 📘 206 = Partial Content — required for range request responses
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

  return new Response(safeReadStream(nodeStream), {
    headers: {
      "Content-Type":   contentType,
      "Content-Length": fileSize.toString(),
      "Accept-Ranges":  "bytes",  // 📘 advertise range support so Chromium uses it
      "Cache-Control":  "no-cache",
    },
  });
}
