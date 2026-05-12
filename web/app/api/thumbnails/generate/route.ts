// 📘 WHAT THIS FILE DOES: API route that generates thumbnail design concepts via Claude.
// Instead of calling an image API, Claude acts as a visual director and outputs
// 4 dramatically different design specifications — colors, headline, layout direction.
// The browser then renders these as live CSS mockups for the user to evaluate.
// 🔗 Next.js API routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const THUMBNAIL_SYSTEM_PROMPT = `You are a senior YouTube thumbnail designer with a proven track record of generating high-CTR thumbnails.

Given a video topic and style preference, generate exactly 4 thumbnail concepts.
Each concept must be DRAMATICALLY different — variety is the whole point.

CRITICAL: Respond with ONLY a valid JSON array of 4 objects — no markdown, no code fences.
Each object must have these exact keys:
{
  "title": "Concept name (e.g. 'High Contrast Shock')",
  "headline": "MAIN TEXT IN ALL CAPS — 2 to 5 words max",
  "subtext": "Optional supporting text, 4 words max, or empty string",
  "description": "One sentence explaining the visual design direction",
  "colors": {
    "bg": "#hexcode for background",
    "text": "#hexcode for headline text",
    "accent": "#hexcode for accent element"
  },
  "style": "one of: bold | minimalist | dramatic | cinematic | clean",
  "emoji": "single emoji that captures the concept's energy",
  "visualDirection": "Photography/illustration note — what the image behind the text shows"
}

Make the color choices bold and high-contrast. Avoid similar color palettes across concepts.
Think like David Ogilvy meets MrBeast's thumbnail team.`;

export async function POST(req: NextRequest) {
  try {
    const { topic, stylePreference } = await req.json();

    if (!topic) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    const userMessage = `Video topic: ${topic}
Style preference: ${stylePreference || "No preference — surprise me"}

Generate 4 distinct thumbnail concepts now.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: THUMBNAIL_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";

    // 📘 The type here says: an array of objects where each value is a string or another object.
    // 'Record<string, unknown>' means "an object with string keys and values of any type."
    // 🔗 TypeScript types: https://www.w3schools.com/typescript/typescript_object_types.php
    // 📘 Strip markdown code fences that Claude occasionally adds around JSON output.
    const cleanedRaw = raw.replace(/```json|```/g, "").trim();

    let concepts: Record<string, unknown>[];
    try {
      concepts = JSON.parse(cleanedRaw);
    } catch {
      return NextResponse.json(
        { error: "Claude returned invalid JSON", raw },
        { status: 500 }
      );
    }

    return NextResponse.json({ concepts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
