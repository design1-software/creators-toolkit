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

// 📘 Converts a Node.js fs.ReadStream into a Web-standard ReadableStream safely.
//
// WHY NOT use Readable.toWeb()?
// The browser's video player constantly opens and closes range request connections
// as it buffers — fetching a few MB, closing the connection, fetching the next chunk.
// When the connection closes, the Web ReadableStream controller is marked closed,
// but the Node.js stream underneath is still reading from disk. When it tries to
// enqueue the next chunk into the closed controller, it throws ERR_INVALID_STATE.
// Readable.toWeb() doesn't catch that error, so it escapes as an uncaughtException
// that crashes the Next.js process every time a video is played.
//
// The fix: wrap every controller call in try/catch, and call nodeStream.destroy()
// in cancel() so disk reads stop immediately when the client disconnects.
function safeReadStream(
  nodeStream: fs.ReadStream
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      // 📘 'data' fires each time a chunk of bytes is ready to send to the browser.
      // The chunk can be a Buffer (binary) or string depending on stream encoding.
      // We convert both to Uint8Array — the type ReadableStream controller expects.
      nodeStream.on("data", (chunk: Buffer | string) => {
        try {
          const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
          controller.enqueue(new Uint8Array(bytes));
        } catch {
          // Controller already closed — client disconnected mid-stream. Stop reading.
          nodeStream.destroy();
        }
      });

      // 📘 'end' fires once the entire requested byte range has been read.
      nodeStream.on("end", () => {
        try {
          controller.close();
        } catch {
          // Already closed — no action needed.
        }
      });

      // 📘 'error' fires if the file read fails (disk error, file deleted, etc.).
      nodeStream.on("error", (err) => {
        try {
          controller.error(err);
        } catch {
          // Controller already closed — swallow silently.
        }
      });
    },

    // 📘 cancel() is called when the browser closes the connection.
    // Without this, the Node.js stream keeps reading bytes nobody will receive,
    // then tries to enqueue them into the closed controller and throws again.
    cancel() {
      nodeStream.destroy();
    },
  });
}

// 📘 GET handler — called for every GET on /api/renders/*.
// '[...slug]' catches all path segments after /api/renders/:
//   /api/renders/short-form/abc.mp4 → slug = ["short-form", "abc.mp4"]
// In Next.js 15+, params are a Promise and must be awaited before use.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;

  // 📘 path.resolve() normalises the path and collapses any '..' segments.
  // This prevents a crafted URL like /api/renders/../../etc/passwd from
  // reading files outside the renders directory.
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
  // 📘 MP4 is the only format Remotion renders to, but we handle webm for safety.
  const contentType = ext === ".mp4"  ? "video/mp4"
                    : ext === ".webm" ? "video/webm"
                    : "application/octet-stream";

  // 📘 Range requests let the browser fetch a slice of the file (e.g. "bytes=0-1048575").
  // The HTML5 <video> player uses this to seek without re-downloading the whole file.
  // We must handle it so scrubbing works in the player after download.
  const rangeHeader = req.headers.get("range");

  if (rangeHeader) {
    const [, rangeStr]       = rangeHeader.split("=");
    const [startStr, endStr] = rangeStr.split("-");
    const start     = parseInt(startStr, 10);
    const end       = endStr ? parseInt(endStr, 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const nodeStream = fs.createReadStream(filePath, { start, end });

    return new Response(safeReadStream(nodeStream), {
      status: 206, // 📘 206 Partial Content is required for range request responses
      headers: {
        "Content-Range":       `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges":       "bytes",
        "Content-Length":      chunkSize.toString(),
        "Content-Type":        contentType,
        "Cache-Control":       "no-cache",
        "Content-Disposition": `inline; filename="${path.basename(filePath)}"`,
      },
    });
  }

  // 📘 Full file response — stream the entire MP4 to the browser.
  // 'Accept-Ranges: bytes' tells the browser it can use range requests for seeking.
  // 'Content-Disposition: inline' lets the browser play the video in the page;
  // the <a download> attribute on the frontend still triggers a Save dialog.
  const nodeStream = fs.createReadStream(filePath);

  return new Response(safeReadStream(nodeStream), {
    headers: {
      "Content-Type":        contentType,
      "Content-Length":      fileSize.toString(),
      "Accept-Ranges":       "bytes",
      "Cache-Control":       "no-cache",
      "Content-Disposition": `inline; filename="${path.basename(filePath)}"`,
    },
  });
}
