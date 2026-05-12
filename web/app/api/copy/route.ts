// 📘 WHAT THIS FILE DOES: API route that sends copywriting requests to Claude.
// It receives platform, tone, and topic, then asks Claude to generate
// a full set of social media copy variants as structured JSON.
// 🔗 Next.js API routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
// 🔗 JSON: https://www.w3schools.com/js/js_json_intro.asp

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// 📘 The Anthropic client reads ANTHROPIC_API_KEY from the environment automatically.
const anthropic = new Anthropic();

// 📘 This tells Claude exactly what to produce — a JSON object with specific keys.
// System prompts are like instructions given to a human assistant before the task.
// 🔗 Claude system prompts: https://docs.anthropic.com/en/docs/system-prompt
const COPYWRITING_SYSTEM_PROMPT = `You are an expert social media copywriter with 10+ years of experience crafting viral content.

When given a platform, tone, and topic, generate a complete set of copy variants.

CRITICAL: Respond with ONLY a valid JSON object — no markdown, no code fences, no explanation.
The JSON must have exactly these keys:
{
  "caption": "Main post caption optimized for the platform (proper length for platform)",
  "hook": "Attention-grabbing opening line that stops the scroll (1-2 sentences)",
  "hashtags": ["array", "of", "10-15", "relevant", "hashtags", "without", "the", "hash", "symbol"],
  "cta": "Clear call-to-action text (1 sentence)",
  "bioLine": "One-line profile bio description that establishes authority/voice",
  "titleOptions": ["Option A: video/post title", "Option B: alternate title", "Option C: third variant"]
}

Adapt length and tone strictly to the specified platform. Instagram captions can be long.
Twitter/X must stay under 280 characters. LinkedIn is professional. TikTok is punchy and casual.`;

// 📘 POST is an HTTP method used to SEND data to the server.
// The client sends platform/tone/topic; the server sends back generated copy.
// 🔗 HTTP methods: https://www.w3schools.com/tags/ref_httpmethods.asp
export async function POST(req: NextRequest) {
  try {
    // 📘 req.json() reads the body of the request as a JavaScript object.
    const { platform, tone, topic } = await req.json();

    // 📘 Basic validation — make sure the required fields were sent.
    if (!platform || !tone || !topic) {
      return NextResponse.json(
        { error: "platform, tone, and topic are required" },
        { status: 400 }
      );
    }

    // 📘 Build a user message describing exactly what copy to generate.
    const userMessage = `Platform: ${platform}
Tone: ${tone}
Topic / Content Description: ${topic}

Generate all copy variants for this content now.`;

    // 📘 Send the request to Claude using the Anthropic SDK.
    // max_tokens controls the maximum length of Claude's response.
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: COPYWRITING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // 📘 Extract the text from Claude's response.
    // response.content is an array of content blocks — we want the first text block.
    const raw = response.content[0].type === "text" ? response.content[0].text : "";

    // 📘 JSON.parse() converts a JSON string into a JavaScript object.
    // The try/catch below handles cases where Claude's response isn't valid JSON.
    // 🔗 JSON.parse: https://www.w3schools.com/js/js_json_parse.asp
    // 📘 Claude is instructed to return only JSON, but sometimes it wraps the response
    // in markdown code fences like ```json ... ```. We strip those before parsing
    // so the JSON.parse call doesn't fail. This is the same cleanup pattern used
    // throughout the app's API routes.
    const cleanedRaw = raw.replace(/```json|```/g, "").trim();

    let copy: Record<string, unknown>;
    try {
      copy = JSON.parse(cleanedRaw);
    } catch {
      return NextResponse.json(
        { error: "Claude returned invalid JSON", raw },
        { status: 500 }
      );
    }

    // 📘 Return the parsed copy object to the browser.
    return NextResponse.json({ copy });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
