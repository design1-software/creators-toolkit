// 📘 WHAT THIS FILE DOES: Calls the Suno API to generate AI background music.
// Like Kie.ai, Suno is async — submit a prompt, get a taskId, poll until the
// music is ready, then return the audio file URL.
// 🔗 Suno API docs: https://docs.sunoapi.org

const SUNO_BASE = "https://api.sunoapi.org";

// 📘 This function generates instrumental background music from a prompt.
// 'instrumental: true' means no vocals — just music, suitable for video backgrounds.
// Parameters:
//   prompt — description of the music style, mood, tempo, and genre
// Returns: the CDN URL of the generated MP3 audio file
export async function generateMusic(prompt: string): Promise<string> {
  const apiKey = process.env.SUNO_API_KEY;
  if (!apiKey) throw new Error("SUNO_API_KEY is not set in .env.local");

  // 📘 Suno requires a callBackUrl — the URL it will POST the result to when done.
  // We create a minimal receiver at /api/suno/callback that just returns 200.
  // We still poll manually rather than relying on the webhook, so the callback
  // endpoint exists only to satisfy the required field.
  const baseUrl = process.env.APP_BASE_URL;
  if (!baseUrl) throw new Error("APP_BASE_URL is not set in .env.local (e.g. http://localhost:3000 or your Railway URL)");
  const callBackUrl = `${baseUrl}/api/suno/callback`;

  // 📘 Step 1: Submit the music generation request.
  // Suno generates 2 variations per request — we take the first one.
  const genRes = await fetch(`${SUNO_BASE}/api/v1/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      customMode: false,  // simple mode — just a prompt, no style tags needed
      instrumental: true, // no vocals — clean background music
      model: "V4",        // Suno V4 — high quality, widely available
      callBackUrl,        // required by the API; we also poll independently
    }),
  });

  if (!genRes.ok) {
    throw new Error(`Suno generate error: ${genRes.status} ${genRes.statusText}`);
  }

  const genData = await genRes.json();
  // 📘 The taskId may be at the top level or nested under data — handle both.
  const taskId: string = genData.taskId ?? genData.data?.taskId;
  if (!taskId) throw new Error(`Suno did not return a taskId: ${JSON.stringify(genData)}`);

  // 📘 Step 2: Poll every 5 seconds until status is SUCCESS.
  // Suno status values: PENDING → TEXT_SUCCESS → FIRST_SUCCESS → SUCCESS.
  // We accept FIRST_SUCCESS or SUCCESS — both have audio ready.
  // Max 36 polls × 5 seconds = 3 minutes.
  for (let attempt = 0; attempt < 36; attempt++) {
    await sleep(5000);

    const pollRes = await fetch(
      `${SUNO_BASE}/api/v1/generate/record-info?taskId=${taskId}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    // 📘 Status is at data.status; audio tracks are at data.response.sunoData.
    const status: string = pollData.data?.status ?? "";
    const songs: Array<{ audioUrl: string }> =
      pollData.data?.response?.sunoData ?? [];

    if (status === "SUCCESS" || status === "FIRST_SUCCESS") {
      if (songs.length === 0) throw new Error("Suno returned success but no audio tracks");
      return songs[0].audioUrl;
    }

    // PENDING or TEXT_SUCCESS → keep waiting
  }

  throw new Error("Suno music generation timed out after 3 minutes");
}

// 📘 Pauses execution for the given number of milliseconds using a Promise.
// This is how you create a non-blocking delay in async JavaScript.
// 🔗 setTimeout: https://www.w3schools.com/jsref/met_win_settimeout.asp
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
