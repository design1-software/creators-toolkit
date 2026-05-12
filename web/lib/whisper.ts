// 📘 WHAT THIS FILE DOES: Transcribes audio to word-level timestamps using OpenAI's Whisper API.
// Previously this ran a local whisper-cpp binary on your Mac.
// Now it sends the audio file to OpenAI's cloud API — no binary or model files needed.
// The function names and return types stay the same so the rest of the app doesn't change.
// 🔗 OpenAI Whisper API: https://platform.openai.com/docs/guides/speech-to-text
// 🔗 JavaScript fetch API: https://www.w3schools.com/js/js_api_fetch.asp

import fs from "fs";
import OpenAI from "openai";

// 📘 A WordTimestamp is one word from the transcription with its start/end time in seconds.
// This matches the shape used in CaptionedVideo.tsx — both must stay in sync.
export type WordTimestamp = {
  word: string;  // the transcribed word
  start: number; // start time in seconds
  end: number;   // end time in seconds
};

// 📘 Create one OpenAI client to reuse across calls — the "singleton pattern".
// It reads OPENAI_API_KEY from environment variables automatically.
// 🔗 Environment variables: https://www.w3schools.com/nodejs/nodejs_environment.asp
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 📘 Sends an audio file to OpenAI Whisper and returns word-level timestamps.
// Parameters:
//   audioPath — path to a WAV or MP3 audio file (extracted by ffprobe.ts)
//   _modelPath — ignored (kept for API compatibility with the old local version)
// Returns: array of WordTimestamp objects sorted by start time
// 🔗 OpenAI transcription docs: https://platform.openai.com/docs/api-reference/audio/createTranscription
export async function transcribeAudio(
  audioPath: string,
  _modelPath: string  // 📘 Prefixed with _ to signal "intentionally unused parameter"
): Promise<WordTimestamp[]> {

  // 📘 fs.createReadStream() reads a file as a stream — efficient for large audio files
  // because it doesn't load the whole file into memory at once.
  // 🔗 Node.js file streams: https://www.w3schools.com/nodejs/nodejs_filesystem.asp
  const audioStream = fs.createReadStream(audioPath);

  // 📘 Call the OpenAI Whisper API with 'verbose_json' format.
  // This returns word-level timestamps — more detail than the default plain text response.
  // 'timestamp_granularities' tells Whisper we want per-word timing, not just per-segment.
  const response = await openai.audio.transcriptions.create({
    file:                     audioStream,
    model:                    "whisper-1",      // the only Whisper model available via API
    response_format:          "verbose_json",   // returns segments + words with timestamps
    timestamp_granularities:  ["word"],         // request word-level timestamps specifically
  });

  // 📘 The API returns a 'words' array when timestamp_granularities includes "word".
  // Each entry has { word, start, end } — exactly our WordTimestamp shape.
  // We use the nullish coalescing operator (??) to fall back to an empty array if missing.
  const words: WordTimestamp[] = (response.words ?? []).map((w) => ({
    word:  w.word.trim(),
    start: w.start,
    end:   w.end,
  }));

  // 📘 Filter out any empty words Whisper may return (rare but possible).
  return words.filter((w) => w.word.length > 0);
}

// 📘 This function previously found the local model .bin file.
// It's kept here so the transcribe route doesn't need to change —
// we just return an empty string since the API doesn't need a model path.
export function getModelPath(_modelDir: string): string {
  return ""; // 📘 OpenAI hosts the model — no local file needed
}
