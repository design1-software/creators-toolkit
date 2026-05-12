// 📘 WHAT THIS FILE DOES: Talks to the ElevenLabs API to generate AI voiceover audio.
// ElevenLabs takes a text script and returns an audio file (MP3).
// This file hides the API details so other parts of the app just call generateVoiceover().
// 🔗 JavaScript fetch reference: https://www.w3schools.com/js/js_api_fetch.asp

import fs from "fs";     // 'fs' = file system — built into Node.js, lets us save files
import path from "path"; // 'path' helps build file paths that work on any OS

// 📘 The ElevenLabs API lives at this base URL — all requests start here.
const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

// 📘 This function sends a script to ElevenLabs and saves the MP3 to disk.
// Parameters:
//   script      — the text to convert to speech
//   voiceId     — which ElevenLabs voice to use (each voice has a unique ID)
//   outputPath  — where to save the resulting MP3 file on your Mac
// Returns: the file path of the saved MP3
export async function generateVoiceover(
  script: string,
  voiceId: string,
  outputPath: string
): Promise<string> {
  const apiKey = process.env.ELEVEN_LABS_API_KEY;

  // 📘 If the API key isn't set, throw an error right away.
  // 'throw' stops the function and reports the problem to the caller.
  if (!apiKey) throw new Error("ELEVEN_LABS_API_KEY is not set in .env.local");

  // 📘 'fetch' sends an HTTP request — like a browser requesting a webpage, but from code.
  // We're doing a POST request, which means we're sending data TO the server.
  const response = await fetch(
    `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`,
    {
      method: "POST",   // POST = send data to the server
      headers: {
        "xi-api-key": apiKey,         // authentication header
        "Content-Type": "application/json", // tells the server we're sending JSON
      },
      // 'JSON.stringify' converts a JS object to a JSON string for the request body
      body: JSON.stringify({
        text: script,
        model_id: "eleven_monolingual_v1", // ElevenLabs model — good quality, fast
        voice_settings: {
          stability: 0.5,       // how consistent the voice sounds (0–1)
          similarity_boost: 0.8, // how closely it matches the chosen voice
        },
      }),
    }
  );

  // 📘 If the server replied with an error (status not 200-299), throw an error.
  // response.ok is true when the status code is between 200 and 299.
  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
  }

  // 📘 The response body is binary audio data (not text).
  // arrayBuffer() reads the entire response as raw bytes.
  const audioBuffer = await response.arrayBuffer();

  // 📘 Make sure the directory for the output file exists before writing.
  // path.dirname() extracts the folder part of a file path.
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // 📘 Write the audio bytes to a file on disk.
  // Buffer.from() converts the raw bytes into a Node.js Buffer object.
  fs.writeFileSync(outputPath, Buffer.from(audioBuffer));

  return outputPath; // return the path so the caller knows where the file was saved
}
