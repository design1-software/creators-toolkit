// 📘 WHAT THIS FILE DOES: API route that repurposes content across multiple platforms.
// The user sends original content + chosen platforms; Claude rewrites it for each one.
// Each platform has different formats, lengths, and norms — Claude handles all of that.
// 🔗 Next.js API routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// 📘 Lazy initialization — defers client creation to first request so ANTHROPIC_API_KEY
// is read at runtime, not at build time when the env var isn't available on Railway.
let _anthropic: Anthropic | null = null;
function getClient(): Anthropic {
  if (_anthropic) return _anthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set. Add it to your environment variables.");
  _anthropic = new Anthropic({ apiKey });
  return _anthropic;
}

// 📘 This system prompt tells Claude to act as a content strategist who understands
// each platform's unique culture, format requirements, and audience expectations.
const REPURPOSE_SYSTEM_PROMPT = `You are an expert content strategist specializing in multi-platform distribution.

Your job is to take original content and repurpose it for each specified platform.

Platform-specific rules:
- instagram: 2200 char max, storytelling tone, line breaks, 5-10 emojis, end with engagement question
- tiktok: 150 char max caption, ultra-casual, trending language, hook in first 3 words
- twitter: 280 char hard limit, punchy, no hashtags in body (add at end), thread-ready
- linkedin: Professional insight framing, 1200-1600 chars, add value/lesson, no exclamation overuse
- youtube: Keyword-rich description (500-700 chars), timestamps placeholder, subscribe CTA
- email: Subject line + body, conversational, one clear CTA, 200-300 words

CRITICAL: Respond with ONLY a valid JSON object — no markdown, no code fences, no explanation.
Keys are the platform names (lowercase) that were requested. Values are the repurposed content strings.
Example format: { "instagram": "...", "twitter": "..." }`;

export async function POST(req: NextRequest) {
  try {
    const { content, platforms } = await req.json();

    // 📘 'Array.isArray()' checks if a value is an array.
    // 🔗 JavaScript arrays: https://www.w3schools.com/js/js_arrays.asp
    if (!content || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: "content and at least one platform are required" },
        { status: 400 }
      );
    }

    const userMessage = `Original content:
${content}

Repurpose this for these platforms: ${platforms.join(", ")}

Generate optimized content for each platform now.`;

    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: REPURPOSE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";

    // 📘 Strip markdown code fences that Claude occasionally adds around JSON output.
    const cleanedRaw = raw.replace(/```json|```/g, "").trim();

    let repurposed: Record<string, string>;
    try {
      repurposed = JSON.parse(cleanedRaw);
    } catch {
      return NextResponse.json(
        { error: "Claude returned invalid JSON", raw },
        { status: 500 }
      );
    }

    return NextResponse.json({ repurposed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
