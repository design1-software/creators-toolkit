// 📘 WHAT THIS FILE DOES: Runs Whisper.cpp to transcribe audio to word-level timestamps.
// Whisper is an AI speech recognition model from OpenAI.
// Whisper.cpp is a fast C++ port that runs locally on your Mac — no API calls needed.
// It outputs per-word timestamps we use to sync captions to the video.
// 🔗 Whisper.cpp: https://github.com/ggerganov/whisper.cpp

import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

// 📘 A WordTimestamp is one word from the transcription with its start/end time.
// This matches the shape used in CaptionedVideo.tsx (both must stay in sync).
export type WordTimestamp = {
  word: string;  // the transcribed word
  start: number; // start time in seconds
  end: number;   // end time in seconds
};

// 📘 Runs Whisper.cpp on a WAV audio file and returns word-level timestamps.
// Parameters:
//   audioPath — path to a 16kHz mono WAV file (extracted by ffprobe.ts)
//   modelPath — path to the Whisper model file (e.g. ggml-base.en.bin)
// Returns: array of WordTimestamp objects sorted by start time
export async function transcribeAudio(
  audioPath: string,
  modelPath: string
): Promise<WordTimestamp[]> {
  const whisperPath = process.env.WHISPER_PATH || "whisper-cpp";

  // 📘 Build the output path for Whisper's JSON output.
  // Whisper creates a file named <input>.json next to the audio file.
  const outputBase = audioPath.replace(/\.wav$/, "");
  const jsonOutput = `${outputBase}.json`;

  // 📘 The Whisper.cpp CLI command:
  // -m model    = which AI model to use
  // -f audio    = input audio file
  // --output-json = save output as JSON (word-level timestamps)
  // --word-thold 0.01 = minimum confidence threshold for a word
  const command = `"${whisperPath}" -m "${modelPath}" -f "${audioPath}" --output-json --word-thold 0.01`;

  // 📘 Run the command and wait for it to finish.
  // Whisper can take 10–60 seconds depending on audio length and model size.
  await execAsync(command, { timeout: 120000 }); // 2 minute timeout

  // 📘 Read and parse the JSON output file Whisper created.
  if (!fs.existsSync(jsonOutput)) {
    throw new Error(`Whisper did not create output file at: ${jsonOutput}`);
  }

  const raw = JSON.parse(fs.readFileSync(jsonOutput, "utf-8"));

  // 📘 Whisper's JSON structure has a 'transcription' array.
  // Each item has 'offsets' (timestamps in milliseconds) and 'text'.
  // We map this into our simpler WordTimestamp format.
  // 🔗 Array.map: https://www.w3schools.com/jsref/jsref_map.asp
  const words: WordTimestamp[] = (raw.transcription ?? []).map(
    (item: { offsets: { from: number; to: number }; text: string }) => ({
      word: item.text.trim(),
      start: item.offsets.from / 1000, // convert ms → seconds
      end: item.offsets.to / 1000,
    })
  );

  // 📘 Clean up the temporary JSON file — we don't need it anymore.
  try { fs.unlinkSync(jsonOutput); } catch { /* ignore cleanup errors */ }

  // 📘 Filter out empty words (Whisper sometimes outputs blank entries).
  return words.filter((w) => w.word.length > 0);
}

// 📘 Checks if the Whisper model file exists and returns its path.
// If the model isn't downloaded yet, it throws a helpful error message.
// Parameters:
//   modelDir — directory where Whisper model files are stored
// Returns: path to the model file
export function getModelPath(modelDir: string): string {
  // 📘 We prefer the English-only base model — fastest and accurate enough for short videos.
  const candidates = [
    path.join(modelDir, "ggml-base.en.bin"),
    path.join(modelDir, "ggml-base.bin"),
    path.join(modelDir, "ggml-small.en.bin"),
  ];

  // 📘 Array.find() returns the first item that passes the test.
  // fs.existsSync() returns true if a file exists at that path.
  const found = candidates.find((p) => fs.existsSync(p));

  if (!found) {
    throw new Error(
      `No Whisper model found in ${modelDir}. Download one with:\n` +
      `  cd "${modelDir}" && bash ./models/download-ggml-model.sh base.en`
    );
  }

  return found;
}
