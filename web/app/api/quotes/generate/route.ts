// 📘 WHAT THIS FILE DOES: API route that analyzes a quote and chooses visual style parameters.
// Claude reads the quote's mood and emotion, then picks gradient colors, animation style,
// and timing that will make the rendered video feel right for that specific quote.
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

// 📘 This prompt asks Claude to be a visual director — matching color psychology
// to the emotional tone of the quote. Different moods deserve different palettes.
const QUOTE_STYLE_SYSTEM_PROMPT = `You are a motion graphics art director. Your job is to analyze the emotional tone of a quote and choose the perfect visual style for a 15-30 second animated social video.

Color psychology rules:
- Inspirational/motivational: deep purples, electric blues, warm golds
- Sad/reflective: muted blues, charcoal, dusty rose
- Energetic/bold: hot reds, vibrant oranges, neon on black
- Peaceful/mindful: soft greens, cream, light blues
- Powerful/serious: deep navy, charcoal black, silver accents
- Romantic/warm: burgundy, rose gold, warm amber

CRITICAL: Respond with ONLY a valid JSON object — no markdown, no code fences, no explanation.
Required keys:
{
  "gradientFrom": "#hexcode — gradient start color (top-left)",
  "gradientTo": "#hexcode — gradient end color (bottom-right)",
  "accentColor": "#hexcode — used for decorative lines and author name",
  "textColor": "#hexcode — quote text color (usually white or near-white)",
  "animationStyle": "word-by-word OR full-text",
  "fontSize": "small OR medium OR large — based on quote length (longer = smaller)",
  "durationSeconds": integer between 15 and 30,
  "musicPrompt": "A short Suno-style music prompt (10-20 words). Describe tempo, instruments, and mood. Examples: 'soft piano ambient reflective slow tempo minimal cinematic', 'energetic hip-hop beats punchy 120bpm urban confident', 'gentle acoustic guitar warm uplifting 80bpm folk'. NO vocals — instrumental only."
}

Choose gradients that are dark enough to ensure white text is readable.
word-by-word animation is dramatic and works for quotes under 20 words.
full-text works better for longer quotes.`;

export async function POST(req: NextRequest) {
  try {
    const { quote, author, stylePreference } = await req.json();

    if (!quote || !author) {
      return NextResponse.json(
        { error: "quote and author are required" },
        { status: 400 }
      );
    }

    const userMessage = `Quote: "${quote}"
Author: ${author}
Style preference: ${stylePreference || "Let the quote's mood guide you"}
Word count: ${quote.split(" ").length} words

Choose the perfect visual style for this quote video.`;

    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: QUOTE_STYLE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";

    // 📘 Strip markdown code fences that Claude occasionally adds around JSON output.
    const cleanedRaw = raw.replace(/```json|```/g, "").trim();

    let style: Record<string, unknown>;
    try {
      style = JSON.parse(cleanedRaw);
    } catch {
      return NextResponse.json(
        { error: "Claude returned invalid JSON", raw },
        { status: 500 }
      );
    }

    return NextResponse.json({ style });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
