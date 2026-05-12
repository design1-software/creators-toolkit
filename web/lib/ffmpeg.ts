// 📘 WHAT THIS FILE DOES: Runs FFmpeg shell commands from Node.js.
// FFmpeg is a command-line video/audio processing tool.
// Instead of running it manually in the terminal, this file lets our app run it automatically.
// 🔗 Node.js child processes: https://www.w3schools.com/nodejs/nodejs_filesystem.asp

import { exec } from "child_process"; // 'child_process' lets Node.js run terminal commands
import { promisify } from "util";      // 'promisify' turns callback-style functions into async ones

// 📘 'promisify' converts exec() from the old callback style to the modern async/await style.
// Without it, we'd have to nest functions inside functions — promisify cleans that up.
const execAsync = promisify(exec);

// 📘 This function runs any FFmpeg command and returns the output.
// Parameters:
//   command — a string like "ffmpeg -i input.mp4 output.mp4"
// Returns: the terminal output (stdout) as a string
export async function runFFmpeg(command: string): Promise<string> {
  const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg"; // fallback to system ffmpeg

  // 📘 We prepend the ffmpegPath to the command string so it uses the right FFmpeg.
  // Template literals (backticks + ${}) let us embed variables inside strings.
  const fullCommand = command.replace(/^ffmpeg/, ffmpegPath);

  // 📘 execAsync runs the command in the terminal and waits for it to finish.
  // It returns { stdout, stderr } — stdout is normal output, stderr is error output.
  const { stdout } = await execAsync(fullCommand);
  return stdout;
}

// 📘 This function normalizes audio volume to -16 LUFS (the platform standard for social media).
// LUFS = Loudness Units Full Scale — a standard measurement of perceived loudness.
// Parameters:
//   inputPath  — path to the source audio/video file
//   outputPath — where to save the normalized file
export async function normalizeAudio(
  inputPath: string,
  outputPath: string
): Promise<void> {
  // 📘 This FFmpeg command uses the 'loudnorm' filter to match platform loudness standards.
  // -i = input file, -af = audio filter, -y = overwrite output without asking
  await runFFmpeg(
    `ffmpeg -i "${inputPath}" -af loudnorm=I=-16:TP=-1.5:LRA=11 -y "${outputPath}"`
  );
}

// 📘 This function mixes voiceover and background music together.
// The music is ducked (lowered) to ~10% volume so the voice stays clear on top.
// Parameters:
//   voicePath  — path to the voiceover audio file
//   musicPath  — path to the background music file
//   outputPath — where to save the mixed audio file
export async function mixAudio(
  voicePath: string,
  musicPath: string,
  outputPath: string
): Promise<void> {
  // 📘 'amix' combines two audio streams. volume=0.1 sets music to 10% of original volume.
  // 'duration=first' means stop when the voiceover ends (not when music ends).
  await runFFmpeg(
    `ffmpeg -i "${voicePath}" -i "${musicPath}" -filter_complex "[1:a]volume=0.1[music];[0:a][music]amix=inputs=2:duration=first" -y "${outputPath}"`
  );
}
