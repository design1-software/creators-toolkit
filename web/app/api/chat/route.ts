// 📘 WHAT THIS FILE DOES: API route for the promo discovery chat.
// When a user pastes a URL, this route fetches the page server-side and injects
// the real content into Claude's context — so Claude can genuinely analyze it.
// Claude the model has no internet access; our server fetches on its behalf.
// 🔗 Next.js API routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

import { NextRequest, NextResponse } from "next/server";
import { sendMessage, type Message } from "@/lib/claude";

const SYSTEM_PROMPT = `You are a creative director and video producer running a guided discovery session for a promo video project.

Your job is to help the user build a complete creative brief through friendly, focused conversation.

## Discovery phases (follow in order):
1. Ask what the promo is for and who it's for (business, event, personal brand, etc.)
2. Ask for their website or brand URL — you'll analyze it for colors, messaging, and tone
3. Ask about uploaded assets they have (logo, photos, screenshots)
4. Recommend: duration (30s or 60s), visual style (cinematic/minimal/bold/energetic), aspect ratio
5. Ask about their desired vibe / emotional tone
6. Recommend an ElevenLabs voice and Suno music style that matches
7. Present a scene-by-scene structure for their approval

## Rules:
- Ask only 1–2 questions at a time. Never dump everything at once.
- Be warm, encouraging, and decisive — this is a creative session, not a form.
- When you have enough information, say "I have everything I need. Ready to build your brief?" and wait for confirmation.
- Use concrete creative language: "punchy and fast-cut," "warm cinematic glow," "calm and authoritative voice."
- Format your final brief between <BRIEF_START> and <BRIEF_END> tags when the user approves.

## Handling social media URLs and failed fetches:
Social media platforms (Instagram, TikTok, Twitter/X, Facebook, LinkedIn) block all server-side access — fetching them returns nothing useful. When the user shares a social media URL or handle, or when fetched content shows "Fetch failed" or "no readable text content", NEVER say you cannot access it. Instead, immediately ask them to share the following directly in chat:
- Their profile bio or about text (copy-paste it)
- 2-3 of their best-performing post captions or hooks
- The hashtags they typically use
- How they'd describe their visual style (colours, vibe, energy)
This gives you richer, more relevant context than any scrape would. Treat it as a positive — you're getting the curated highlights directly from the creator.`;

// ─────────────────────────────────────────────
// 📘 URL FETCHING HELPERS
// These functions fetch real content from URLs so Claude can analyze them.
// The Anthropic model itself cannot browse the web — we do it here server-side.
// ─────────────────────────────────────────────

// 📘 extractMeta() reads a single <meta> tag value from raw HTML.
// Meta tags hold key info like page title, description, and OG (Open Graph) data.
// Open Graph tags are what social media sites use to generate link previews.
// 🔗 HTML meta tags: https://www.w3schools.com/tags/tag_meta.asp
function extractMeta(html: string, nameOrProp: string): string {
  // 📘 A regex (regular expression) is a pattern for finding text inside a string.
  // We try two orderings because browsers allow either order for the attributes.
  // 🔗 JavaScript regex: https://www.w3schools.com/js/js_regexp.asp
  const patterns = [
    new RegExp(
      `<meta[^>]*(?:name|property)=["']${nameOrProp}["'][^>]*content=["']([^"']{1,500})["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]*content=["']([^"']{1,500})["'][^>]*(?:name|property)=["']${nameOrProp}["']`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

// 📘 extractBodyText() strips all HTML tags from a page and returns plain readable text.
// This lets Claude see the actual words on the page, not the markup around them.
function extractBodyText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")  // remove JS code blocks
    .replace(/<style[\s\S]*?<\/style>/gi, " ")    // remove CSS blocks
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")        // remove nav menus (not content)
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")  // remove footers
    .replace(/<[^>]+>/g, " ")                      // strip all remaining tags
    .replace(/&amp;/g, "&")                        // decode HTML entities
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")                          // collapse whitespace
    .trim()
    .slice(0, 3500);                               // cap to limit token usage
}

// 📘 tryOEmbed() fetches structured data from platforms that support the oEmbed standard.
// oEmbed is an open format for embedding content — YouTube, TikTok, and Twitter all support it.
// It returns metadata like title and author even when the page HTML can't be scraped.
// 🔗 oEmbed spec: https://oembed.com/
async function tryOEmbed(url: string, hostname: string): Promise<string> {
  // 📘 A Record<string, string> is an object where every key and value is a string.
  // This maps each hostname to its oEmbed API endpoint.
  // 🔗 TypeScript Record type: https://www.w3schools.com/typescript/typescript_utility_types.php
  const endpoints: Record<string, string> = {
    "youtube.com": `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    "youtu.be":    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    "tiktok.com":  `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
    "twitter.com": `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`,
    "x.com":       `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`,
    "vimeo.com":   `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
  };

  const endpoint = endpoints[hostname];
  if (!endpoint) return "";

  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return "";
    // 📘 res.json() parses the response body as JSON into a JavaScript object.
    const data = await res.json() as Record<string, string>;
    return [
      `Platform: ${hostname}`,
      data.title        && `Title: ${data.title}`,
      data.author_name  && `Creator / Channel: ${data.author_name}`,
      data.description  && `Description: ${data.description}`,
    ].filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

// 📘 Social media platforms that block all server-side access.
// Profile pages on these hosts require JavaScript rendering and login — fetching
// them server-side always returns either an empty shell or a login wall.
// We skip the fetch entirely and return a signal for Claude to ask manually instead.
const SOCIAL_MEDIA_HOSTS = new Set([
  "instagram.com", "tiktok.com", "facebook.com", "fb.com",
  "linkedin.com", "threads.net", "snapchat.com", "pinterest.com",
]);

// 📘 fetchUrlContent() is the main URL fetching function.
// It tries multiple strategies in order and always returns something useful:
//   1. Skip social media profiles immediately (they block all server-side access)
//   2. oEmbed API (YouTube, TikTok, Twitter/X, Vimeo — for specific content URLs)
//   3. Full HTML fetch with meta tag extraction + body text
//   4. Descriptive fallback message when the site blocks access
async function fetchUrlContent(url: string): Promise<string> {
  let hostname = "";
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return ""; // not a valid URL
  }

  // ── Strategy 0: Social media profile pages — skip the fetch, ask manually ──
  // 📘 These platforms require JavaScript + login — no server-side fetch will work.
  // We return a clear signal so Claude knows to ask the user directly.
  if (SOCIAL_MEDIA_HOSTS.has(hostname)) {
    return (
      `[Social media URL: ${url}]\n` +
      `Server-side fetch is blocked by ${hostname} (requires JavaScript and login). ` +
      `Ask the user to paste their bio, best post captions, hashtags, and visual style description directly in chat.`
    );
  }

  // ── Strategy 1: oEmbed (structured API data for supported platforms) ──
  const oembedResult = await tryOEmbed(url, hostname);
  if (oembedResult) return oembedResult;

  // ── Strategy 2: Full HTML fetch ──
  // 📘 We send realistic browser headers so the server doesn't block our request.
  // Many sites check the User-Agent header to filter out bots.
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control":   "no-cache",
      },
      signal: AbortSignal.timeout(8000), // 8-second timeout
    });

    if (!res.ok) {
      return `[URL: ${url}]\nHTTP ${res.status} ${res.statusText}`;
    }

    const html = await res.text();

    // ── Extract meta/OG tags (reliable even on JavaScript-heavy sites) ──
    const title      = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() || "";
    const siteName   = extractMeta(html, "og:site_name");
    const ogTitle    = extractMeta(html, "og:title");
    const ogDesc     = extractMeta(html, "og:description");
    const metaDesc   = extractMeta(html, "description");
    const twTitle    = extractMeta(html, "twitter:title");
    const twDesc     = extractMeta(html, "twitter:description");
    const themeColor = extractMeta(html, "theme-color"); // brand color hint

    const bestTitle = ogTitle || twTitle || title;
    const bestDesc  = ogDesc  || twDesc  || metaDesc;

    const metaSection = [
      `URL: ${url}`,
      (siteName || hostname) && `Site name: ${siteName || hostname}`,
      bestTitle              && `Page title: ${bestTitle}`,
      bestDesc               && `Description: ${bestDesc}`,
      themeColor             && `Brand theme color (from HTML): ${themeColor}`,
    ].filter(Boolean).join("\n");

    // ── Extract body text ──
    const bodyText = extractBodyText(html);

    if (!bestTitle && !bestDesc && !bodyText) {
      return `[URL: ${url}]\nPage loaded (HTTP ${res.status}) but returned no readable text content.`;
    }

    return metaSection + (bodyText ? `\n\n--- Page text ---\n${bodyText}` : "");

  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return `[URL: ${url}]\nFetch failed: ${reason}`;
  }
}

// 📘 getTextFromMessage() extracts the plain text from a message.
// Messages can be a plain string OR an array of content blocks (text + images).
// We only need the text to scan for URLs.
function getTextFromMessage(msg: Message): string {
  if (typeof msg.content === "string") return msg.content;
  return msg.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join(" ");
}

// ─────────────────────────────────────────────
// 📘 POST HANDLER
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: Message[] = body.messages;

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages must be an array" },
        { status: 400 }
      );
    }

    // ── Scan the latest user message for URLs and fetch their content ──
    // 📘 [...messages].reverse().find() searches the array from the end.
    // We want the most recent user message, not the first one.
    // 🔗 Array methods: https://www.w3schools.com/js/js_array_methods.asp
    let systemPrompt = SYSTEM_PROMPT;

    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      const text = getTextFromMessage(lastUserMsg);

      // 📘 .match() returns an array of all matches, or null if none found.
      // We then strip trailing punctuation so URLs like "visit https://brand.com." work.
      const rawUrls = text.match(/https?:\/\/[^\s]+/g) || [];
      const urls = rawUrls
        .map((u) => u.replace(/[.,;:!?'")\]>]+$/, "")) // strip trailing punctuation
        .filter((u) => { try { new URL(u); return true; } catch { return false; } })
        .slice(0, 3); // cap at 3 URLs per message

      if (urls.length > 0) {
        // 📘 Promise.all() runs all fetches in parallel — faster than one-by-one.
        // 🔗 Promise.all: https://www.w3schools.com/js/js_promise.asp
        const fetchedContents = await Promise.all(urls.map(fetchUrlContent));

        const urlContext = fetchedContents
          .filter(Boolean)
          .join("\n\n---\n\n");

        if (urlContext) {
          // 📘 We append fetched content to the system prompt so Claude treats it
          // as background knowledge it already has — not something the user told it.
          // This is called "context injection" or "retrieval-augmented generation" (RAG).
          systemPrompt +=
            `\n\n## Live Web Content (fetched server-side)\n` +
            `Use the following content to analyze the brand's visual style, tone, messaging, ` +
            `and key themes. Extract brand colors, voice, and selling points from it:\n\n` +
            urlContext;
        }
      }
    }

    // 📘 sendMessage() calls the Anthropic API and returns Claude's reply as a string.
    const reply = await sendMessage(messages, systemPrompt);
    return NextResponse.json({ reply });

  } catch (error) {
    console.error("[/api/chat] Error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Claude API error: ${detail}` },
      { status: 500 }
    );
  }
}
