// 📘 WHAT THIS FILE DOES: Triggers the Remotion CLI to render a React component to MP4.
// Remotion is a framework for making videos with React code.
// This file runs the Remotion render command from our web app's backend.
// 🔗 Node.js exec reference: https://www.w3schools.com/nodejs/nodejs_filesystem.asp

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

// 📘 Convert exec to async/await style (same pattern as ffmpeg.ts)
const execAsync = promisify(exec);

// 📘 This function renders a Remotion composition to an MP4 file.
// It shells out to the Remotion CLI — the same command you'd type in the terminal.
// Parameters:
//   compositionId — the name of the composition in the Remotion project (e.g. "PromoVideo")
//   outputFileName — what to name the finished MP4 (e.g. "my-promo.mp4")
//   props         — data to pass into the React component (like scene content, colors, etc.)
// Returns: the absolute path to the rendered MP4 file
export async function renderComposition(
  compositionId: string,
  outputFileName: string,
  props: Record<string, unknown> = {}  // 'Record<string, unknown>' = an object with any keys
): Promise<string> {
  // 📘 Read the Remotion project path from environment variables.
  // We need to know WHERE the Remotion project is so we can run commands in it.
  const remotionPath = process.env.REMOTION_PROJECT_PATH;
  if (!remotionPath) throw new Error("REMOTION_PROJECT_PATH is not set in .env.local");

  // 📘 path.join() builds a file path correctly for the current OS.
  // On Mac/Linux it uses forward slashes; on Windows it uses backslashes.
  const outputPath = path.join(remotionPath, "output", outputFileName);

  // 📘 JSON.stringify() converts a JavaScript object to a JSON string.
  // We pass the props as JSON so Remotion can read them from the command line.
  const propsJson = JSON.stringify(props).replace(/"/g, '\\"'); // escape quotes for shell

  // 📘 This is the Remotion render command — same as typing it in your terminal.
  // 'npx remotion render' finds the Remotion CLI in node_modules automatically.
  const command = `cd "${remotionPath}" && npx remotion render ${compositionId} "${outputPath}" --props="${propsJson}"`;

  // 📘 Run the command and wait for it to finish. This can take 30–120 seconds.
  await execAsync(command, { timeout: 300000 }); // 5 minute timeout

  return outputPath; // return the path to the finished video
}
