// 📘 WHAT THIS FILE DOES: Runs FFprobe to read metadata from a video file.
// FFprobe is part of the FFmpeg toolkit — it reads video/audio info without encoding anything.
// We use it to get the duration, fps, width, and height of an uploaded video.
// 🔗 Node.js child_process: https://www.w3schools.com/nodejs/nodejs_filesystem.asp

import { exec } from "child_process";
import { promisify } from "util";

// 📘 Convert exec to async/await style so we can use it without callbacks.
const execAsync = promisify(exec);

// 📘 This type describes the video metadata we care about.
export type VideoInfo = {
  duration: number;   // total length in seconds
  fps: number;        // frames per second (e.g. 30, 29.97, 60)
  width: number;      // pixel width
  height: number;     // pixel height
  durationFrames: number; // total frames (duration * fps)
};

// 📘 Runs FFprobe on a video file and returns its key metadata.
// Parameters:
//   filePath — absolute path to the video file on disk
// Returns: a VideoInfo object with duration, fps, dimensions
export async function getVideoInfo(filePath: string): Promise<VideoInfo> {
  const ffprobePath = process.env.FFPROBE_PATH || "ffprobe";

  // 📘 This FFprobe command outputs JSON — much easier to parse than the default text format.
  // -v quiet    = suppress extra log output
  // -print_format json = output as JSON
  // -show_streams = include stream info (video/audio tracks)
  const command = `"${ffprobePath}" -v quiet -print_format json -show_streams "${filePath}"`;

  const { stdout } = await execAsync(command);

  // 📘 JSON.parse() converts the JSON string into a JavaScript object.
  // 🔗 JSON: https://www.w3schools.com/js/js_json_parse.asp
  const data = JSON.parse(stdout);

  // 📘 FFprobe returns an array of streams — video, audio, subtitles, etc.
  // We find the video stream specifically using Array.find().
  const videoStream = data.streams?.find(
    (s: { codec_type: string }) => s.codec_type === "video"
  );

  if (!videoStream) {
    throw new Error("No video stream found in file. Is this a valid video file?");
  }

  // 📘 FPS is stored as a fraction string like "30/1" or "2997/100" (for 29.97fps).
  // We split on "/" and divide to get a decimal number.
  // Guard: some containers report a plain number ("30") rather than a fraction.
  // If fpsDen is 0 or NaN the division would produce Infinity or NaN — throw early.
  const fpsParts = videoStream.r_frame_rate.split("/").map(Number);
  if (fpsParts.length !== 2 || isNaN(fpsParts[0]) || isNaN(fpsParts[1]) || fpsParts[1] === 0) {
    throw new Error(`Cannot parse FPS from r_frame_rate: "${videoStream.r_frame_rate}"`);
  }
  const fps = Math.round(fpsParts[0] / fpsParts[1]); // round to nearest whole fps

  const duration = parseFloat(videoStream.duration || "0");
  const durationFrames = Math.floor(duration * fps);

  return {
    duration,
    fps,
    width: videoStream.width,
    height: videoStream.height,
    durationFrames,
  };
}

// 📘 Extracts audio from a video file as a 16kHz WAV — the format Whisper.cpp expects.
// Parameters:
//   inputPath  — path to the source video
//   outputPath — where to save the extracted WAV file
export async function extractAudio(
  inputPath: string,
  outputPath: string
): Promise<void> {
  const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

  // 📘 -vn = no video (audio only)
  // -acodec pcm_s16le = uncompressed 16-bit audio (Whisper requirement)
  // -ar 16000 = 16,000 Hz sample rate (Whisper requirement)
  // -ac 1 = mono audio (one channel — Whisper is faster with mono)
  await execAsync(
    `"${ffmpegPath}" -i "${inputPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 -y "${outputPath}"`
  );
}
