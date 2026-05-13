// 📘 WHAT THIS FILE DOES: Wraps the Anthropic (Claude) API so the rest of the app
// can talk to Claude without repeating setup code everywhere.
// Think of it like a phone — this file is the dial tone. Other files make the calls.
// 🔗 JavaScript modules reference: https://www.w3schools.com/js/js_modules.asp

import Anthropic from "@anthropic-ai/sdk";

// 📘 'const' creates a variable that won't be reassigned.
// We create ONE Anthropic client here and reuse it across the whole app.
// This is called the "singleton pattern" — one instance shared everywhere.
// Validate the key at startup so a missing env var produces a clear error immediately
// rather than a confusing "authentication failed" 401 on the first API call.
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the server.");
}

const anthropic = new Anthropic({ apiKey });

// 📘 A TextBlock carries plain text inside a multipart message.
// Used when a message contains both text and images at the same time.
export type TextBlock = {
  type: "text";
  text: string;
};

// 📘 An ImageBlock carries a base64-encoded image for Claude to analyze visually.
// The Anthropic vision API supports: image/jpeg, image/png, image/gif, image/webp.
// 'base64' means the image bytes are encoded as a text string so we can send them in JSON.
// 🔗 Base64 encoding: https://www.w3schools.com/jsref/met_win_btoa.asp
export type ImageBlock = {
  type: "image";
  source: {
    type: "base64";
    media_type: string; // e.g. "image/jpeg" or "image/png"
    data: string;       // the base64-encoded image bytes (no "data:" prefix)
  };
};

// 📘 A ContentBlock is either a text piece or an image piece inside a multipart message.
// The '|' means "either type is valid here" — this is called a union type in TypeScript.
// 🔗 TypeScript union types: https://www.w3schools.com/typescript/typescript_unions.php
export type ContentBlock = TextBlock | ImageBlock;

// 📘 A 'Message' type describes the shape of one chat message.
// TypeScript uses 'type' to define what data looks like — it's like a label.
// 'role' is either "user" (the human) or "assistant" (Claude).
// 'content' can be a plain string OR an array of blocks (text + images).
export type Message = {
  role: "user" | "assistant"; // the '|' means "either this OR that"
  content: string | ContentBlock[]; // plain text OR a mix of text and image blocks
};

// 📘 This function sends a conversation to Claude and returns its reply.
// It's 'async' because talking to an API takes time — we have to wait for the response.
// 'async/await' lets us write that waiting code in a readable, step-by-step style.
// 🔗 Learn about async/await: https://www.w3schools.com/js/js_async.asp
//
// Parameters:
//   messages  — the full conversation history so far (array of Message objects)
//   system    — the "system prompt" that tells Claude its role and rules
// Returns: Claude's reply text as a string
export async function sendMessage(
  messages: Message[],
  system: string
): Promise<string> {
  // 📘 'await' pauses here until the API responds, then continues.
  // We're calling Claude's messages.create() endpoint — it's like sending a text
  // and waiting for the reply.
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",   // which Claude model to use (latest Sonnet)
    max_tokens: 2048,              // maximum length of Claude's reply
    system,                        // the instructions that define Claude's behavior
    // 📘 We cast 'messages' to Anthropic.MessageParam[] because our Message type
    // matches the SDK's expected shape exactly — but TypeScript needs the explicit cast.
    // The SDK accepts both string content and ContentBlock[] content natively.
    messages: messages as Anthropic.MessageParam[],
  });

  // 📘 The response contains an array of 'content' blocks.
  // We grab the first one (index 0), check it's a text block, and return its text.
  // The 'as' keyword tells TypeScript what type to treat the value as.
  const firstBlock = response.content[0];
  if (firstBlock.type !== "text") return "";  // safety check — should always be text

  return firstBlock.text;  // 'return' sends the value back to whoever called this function
}
