// 📘 WHAT THIS FILE DOES: API route that extracts and returns the creative brief
// from a completed discovery conversation. Lives at POST /api/brief.
// The brief is marked in Claude's messages with <BRIEF_START> and <BRIEF_END> tags.
// 🔗 Next.js route handlers: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

import { NextRequest, NextResponse } from "next/server";
import { sendMessage, type Message } from "@/lib/claude";

// 📘 This system prompt tells Claude to compile everything into a structured brief.
// It's different from the chat prompt — we're now asking for a specific formatted output.
const BRIEF_SYSTEM = `You are a creative director compiling a final production brief.

Given a discovery conversation, produce a complete creative brief in this exact format:

<BRIEF_START>
# Creative Brief: [Project Name]

## Project Overview
- **Type:** [Creator/Event/Business]
- **Duration:** [30s or 60s]
- **Aspect Ratio:** [9:16 / 16:9 / 1:1]
- **Visual Style:** [e.g. Cinematic/Minimal/Bold]

## Brand
- **Colors:** [hex codes or descriptions]
- **Tone:** [e.g. warm, authoritative, energetic]
- **Tagline:** [if known]

## Audio Plan
- **Voiceover Voice:** [ElevenLabs voice name and ID]
- **Music Style:** [Suno prompt, e.g. "upbeat lo-fi hip hop, 80 BPM"]
- **VO Script:** [full voiceover script, ~75 words for 30s / ~150 for 60s]

## Scene Breakdown
### Scene 1 — [Name] ([duration]s)
- Visual: [what's on screen]
- Text overlay: [copy]
- Motion: [animation style]

### Scene 2 — [Name] ([duration]s)
...

## Asset Requirements
- [ ] Background images needed: [list]
- [ ] Logo: [yes/no, format]
- [ ] Photo assets: [list or "none"]
<BRIEF_END>

Only output content between the tags. Be specific and production-ready.`;

export async function POST(req: NextRequest) {
  try {
    // 📘 Destructure the request body — pull out 'messages' directly.
    const { messages }: { messages: Message[] } = await req.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "messages must be an array" }, { status: 400 });
    }

    // 📘 Ask Claude to compile the brief from the full conversation history.
    // We append a final "user" message to trigger the compilation.
    const compilationMessages: Message[] = [
      ...messages, // '...' (spread) copies all existing messages into the new array
      {
        role: "user",
        content: "Please compile the final creative brief now based on our conversation.",
      },
    ];

    const briefResponse = await sendMessage(compilationMessages, BRIEF_SYSTEM);

    // 📘 Use a regular expression (regex) to extract just the brief content.
    // The pattern looks for text between <BRIEF_START> and <BRIEF_END>.
    // 🔗 Regex basics: https://www.w3schools.com/js/js_regexp.asp
    const briefMatch = briefResponse.match(/<BRIEF_START>([\s\S]*?)<BRIEF_END>/);
    const brief = briefMatch ? briefMatch[1].trim() : briefResponse;

    return NextResponse.json({ brief });

  } catch (error) {
    console.error("[/api/brief] Error:", error);
    return NextResponse.json({ error: "Failed to compile brief." }, { status: 500 });
  }
}
