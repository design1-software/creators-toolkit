// 📘 WHAT THIS FILE DOES: Reads the creative brief and extracts structured production data.
// The brief is free-form text written by Claude. This route asks Claude to re-read it
// and pull out exactly the fields the video renderer needs — brand name, script, colors, etc.
// Think of it as "brief → production blueprint."
// 🔗 Next.js API routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// 📘 This system prompt instructs Claude to act as a production coordinator.
// It reads an unstructured creative brief and outputs a precise JSON object
// that the video pipeline can consume directly — no further interpretation needed.
const PARSE_SYSTEM_PROMPT = `You are a video production coordinator. Your job is to read a creative brief and extract the exact data needed to produce a brand video.

CRITICAL: Respond with ONLY a valid JSON object — no markdown, no code fences, no explanation.

Required keys:
{
  "brandName": "The brand or product name (2-4 words max)",
  "tagline": "A punchy one-line tagline or slogan (under 10 words)",
  "script": "A natural-sounding 40-60 second voiceover script. Write complete sentences. Aim for 100-150 words. If the brief has a script section, use it. Otherwise write one based on the brief's key messages.",
  "keyMessages": ["Message 1 (under 8 words)", "Message 2", "Message 3"],
  "cta": "The call to action (under 6 words, e.g. 'Visit us today')",
  "gradientFrom": "#hexcode — background gradient start color that matches the brand feel",
  "gradientTo": "#hexcode — gradient end color (should pair well with gradientFrom)",
  "accentColor": "#hexcode — accent/highlight color (use brand colors if mentioned)",
  "textColor": "#ffffff",
  "durationSeconds": integer — estimated voiceover duration in seconds (word count ÷ 2.5, rounded up, min 20 max 60),
  "imagePrompt": "60-80 word prompt for an AI image generator. Describe a cinematic background scene for this brand video — lighting, mood, environment, visual style, colors, composition. No text, logos, or people's faces. Match the brand's tone exactly.",
  "musicPrompt": "30-50 word description of the background music for this brand video. Include genre, tempo (BPM range), instruments, and emotional feel. Must match the brand's energy and the voiceover's pace."
}

Rules for color choices:
- Tech/modern brands: deep blues, purples, dark grays
- Health/wellness: soft greens, teals, creams
- Luxury/premium: near-black, gold, deep burgundy
- Creative/energetic: vibrant gradients, pops of color
- Always ensure high contrast — textColor must be readable on the gradient`;

export async function POST(req: NextRequest) {
  try {
    const { brief } = await req.json();

    if (!brief) {
      return NextResponse.json({ error: "brief is required" }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: PARSE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is the creative brief to parse:\n\n${brief}`,
        },
      ],
    });

    // 📘 Extract the text block from Claude's response array.
    const raw = response.content[0].type === "text" ? response.content[0].text : "";

    // 📘 'JSON.parse' converts the JSON string Claude returned into a JavaScript object.
    // 🔗 JSON.parse: https://www.w3schools.com/js/js_json_parse.asp
    // 📘 Strip markdown code fences that Claude occasionally adds around JSON output.
    const cleanedRaw = raw.replace(/```json|```/g, "").trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleanedRaw);
    } catch {
      return NextResponse.json(
        { error: "Claude returned invalid JSON", raw },
        { status: 500 }
      );
    }

    return NextResponse.json({ production: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
