// 📘 WHAT THIS FILE DOES: Calls the Kie.ai API to generate AI background images.
// Kie.ai image generation is async — you submit a request, get a taskId back,
// then poll a status endpoint until the image is ready.
// 🔗 Kie.ai docs: https://docs.kie.ai/4o-image-api/quickstart

// 📘 The base URL for all Kie.ai API requests.
const KIE_BASE = "https://api.kie.ai";

// 📘 This function generates an image from a text prompt and returns the image URL.
// It handles both the submission and the polling loop internally,
// so callers just await a URL string — they don't need to know about taskIds.
// Parameters:
//   prompt — a detailed description of the image to generate
//   size   — the aspect ratio: "1:1" (square), "3:2" (landscape), "2:3" (portrait)
// Returns: the CDN URL of the generated image
export async function generateImage(
  prompt: string,
  size: "1:1" | "3:2" | "2:3" = "3:2"
): Promise<string> {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error("KIE_API_KEY is not set in .env.local");

  // 📘 Step 1: Submit the image generation request.
  // POST returns immediately with a taskId — the image is not ready yet.
  const genRes = await fetch(`${KIE_BASE}/api/v1/gpt4o-image/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, size }),
  });

  if (!genRes.ok) {
    throw new Error(`Kie.ai generate error: ${genRes.status} ${genRes.statusText}`);
  }

  const genData = await genRes.json();
  // 📘 The taskId lives at data.taskId in the response.
  const taskId: string = genData.data?.taskId;
  if (!taskId) throw new Error(`Kie.ai did not return a taskId: ${JSON.stringify(genData)}`);

  // 📘 Step 2: Poll the status endpoint every 5 seconds until the image is ready.
  // successFlag: 0 = still processing, 1 = done, 2 = failed.
  // Max 24 polls × 5 seconds = 2 minutes before we give up.
  // 🔗 Polling pattern: https://www.w3schools.com/js/js_async.asp
  for (let attempt = 0; attempt < 24; attempt++) {
    await sleep(5000);

    const pollRes = await fetch(`${KIE_BASE}/record-info?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) continue; // transient error — try again next loop

    const pollData = await pollRes.json();
    const flag: number = pollData.data?.successFlag;

    if (flag === 2) {
      throw new Error("Kie.ai image generation failed (successFlag=2)");
    }

    if (flag === 1) {
      // 📘 Image is ready — extract the first URL from the result_urls array.
      const urls: string[] = pollData.data?.response?.result_urls ?? [];
      if (urls.length === 0) {
        throw new Error("Kie.ai returned successFlag=1 but no result_urls");
      }
      return urls[0];
    }
    // flag === 0 → still processing, continue polling
  }

  throw new Error("Kie.ai image generation timed out after 2 minutes");
}

// 📘 'sleep' pauses execution for a given number of milliseconds.
// Returning a Promise lets us use 'await sleep(5000)' cleanly.
// 🔗 Promises: https://www.w3schools.com/js/js_promise.asp
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
