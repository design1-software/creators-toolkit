"use client";
// 📘 WHAT THIS FILE DOES: The chat UI for the promo video discovery phase.
// The user and Claude have a conversation here. When Claude has gathered enough info,
// it signals readiness and a "Generate Brief" button appears.
// Files (images, video, docs) can be attached and sent alongside messages.
// 🔗 React components: https://www.w3schools.com/react/react_components.asp

// 📘 React hooks let you add features to function components.
// useState — stores values that can change (like typed text or the message list)
// useEffect — runs code when something changes (like scrolling to the latest message)
// useRef — gets a direct reference to a DOM element (like the chat container or file input)
import { useState, useEffect, useRef } from "react";

// 📘 We import the Message and ContentBlock types from lib/claude.ts so both files
// agree on exactly what shape a message object has.
// 'type' imports are erased at runtime — they only exist for TypeScript's type checks.
// 🔗 TypeScript imports: https://www.w3schools.com/typescript/typescript_modules.php
import type { Message, ContentBlock } from "@/lib/claude";

// 📘 These are the props this component accepts from its parent.
// 'onBriefReady' is a callback — a function the parent passes in.
// When Claude signals the brief is ready, we call this function to notify the parent.
type ChatInterfaceProps = {
  onBriefReady: (messages: Message[]) => void;
};

// 📘 Helper: detects the true image format by reading the file's "magic bytes" —
// the first few bytes of every image file that identify its format.
// We can't trust file.type alone because browsers sometimes report the wrong MIME type
// (e.g. a WebP file saved as .jpg gets reported as "image/jpeg").
// Anthropic's API validates the actual bytes against the declared media_type and rejects mismatches.
// 🔗 Magic bytes / file signatures: https://en.wikipedia.org/wiki/List_of_file_signatures
async function detectImageMimeType(file: File): Promise<string> {
  // 📘 file.slice(0, 12) reads just the first 12 bytes — enough to identify any image format.
  // arrayBuffer() converts those bytes into raw binary data we can inspect.
  // Uint8Array lets us read individual byte values (0–255) as numbers.
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  // WebP: starts with "RIFF" (bytes 0–3) and "WEBP" (bytes 8–11)
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";

  // JPEG: starts with FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "image/jpeg";

  // PNG: starts with the 8-byte PNG signature 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return "image/png";

  // GIF: starts with "GIF8"
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";

  // Fall back to whatever the browser reported (or a safe default)
  return file.type || "image/jpeg";
}

// 📘 Helper: converts a browser File object into a base64-encoded string.
// The Anthropic API needs image data as base64 — it can't accept raw file bytes.
// FileReader is a built-in browser API for reading file contents.
// 🔗 FileReader API: https://www.w3schools.com/jsref/dom_obj_fileupload.asp
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // 'onload' fires when the file has been fully read.
    // reader.result looks like: "data:image/jpeg;base64,/9j/4AAQ..." — we strip the prefix.
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file); // read the file as a data URL (base64 encoded)
  });
}

// 📘 Helper: builds a ContentBlock array from the user's text + attached files.
// Images become image blocks that Claude can actually see and analyze.
// Non-image files (video, PDF, docs) appear as text notes since Claude can't play video.
async function buildContentBlocks(
  text: string,
  files: File[]
): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = [];

  // 📘 'for...of' loops over each item in an array.
  // We use 'await' inside because the helpers are async (they take time to read each file).
  // 🔗 for...of loop: https://www.w3schools.com/js/js_loop_forof.asp
  for (const file of files) {
    // 📘 'startsWith' checks if a string begins with a given prefix.
    // We skip SVG files because the Anthropic API doesn't support them as vision inputs.
    if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
      // 📘 Detect the real format from magic bytes, then read the file as base64.
      // Using detectImageMimeType() instead of file.type avoids the "claimed jpeg is actually webp" error.
      const [mediaType, data] = await Promise.all([
        detectImageMimeType(file),
        fileToBase64(file),
      ]);
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data },
      });
    } else {
      // Non-image file — tell Claude its name and type in a text block
      blocks.push({
        type: "text",
        text: `[Attached file: ${file.name} (${file.type || "unknown type"})]`,
      });
    }
  }

  // Add the user's typed text at the end (after the files for context)
  if (text.trim()) {
    blocks.push({ type: "text", text: text.trim() });
  }

  return blocks;
}

// 📘 This is the ChatInterface component — it renders a full chat UI.
// It manages the conversation state, sends messages to /api/chat, and detects when
// Claude says it has enough info to generate the creative brief.
export default function ChatInterface({ onBriefReady }: ChatInterfaceProps) {
  // 📘 useState() creates a "state variable" — a value React tracks and re-renders when it changes.
  // Format: const [value, setValue] = useState(initialValue)
  // 🔗 React useState: https://www.w3schools.com/react/react_usestate.asp
  //
  // 📘 IMPORTANT: This array is sent directly to the Anthropic API, which requires the first
  // message to have role "user". We display the opening greeting as a static element below
  // (not in state) so the API always receives a user-first messages array.
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");        // tracks what the user is typing
  const [loading, setLoading] = useState(false); // true while waiting for Claude's reply
  const [briefSignaled, setBriefSignaled] = useState(false); // true once Claude says it's ready

  // 📘 Each attached file is stored alongside a preview URL (for showing image thumbnails).
  // 'previewUrl' is created by URL.createObjectURL() — a browser API that generates
  // a temporary URL pointing to the file in memory so we can display it in an <img> tag.
  // We store this so we can revoke it later to free up memory.
  const [attachedFiles, setAttachedFiles] = useState<
    Array<{ file: File; previewUrl: string | null }>
  >([]);

  // 📘 useRef() gives us a reference to a DOM element so we can call methods on it directly.
  // bottomRef — used to scroll the chat to the latest message.
  // fileInputRef — used to trigger the hidden file input when the attachment button is clicked.
  // 🔗 useRef: https://www.w3schools.com/react/react_useref.asp
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 📘 useEffect() runs after every render where 'messages' changed.
  // We use it to auto-scroll the chat window to show the latest message.
  // 🔗 React useEffect: https://www.w3schools.com/react/react_useeffect.asp
  useEffect(() => {
    // 'scrollIntoView' is a browser API that scrolls an element into the visible area.
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]); // [messages] = only run this effect when 'messages' changes

  // 📘 Cleanup effect — revokes all object URLs when the component unmounts.
  // Object URLs are temporary memory allocations; revoking them prevents memory leaks.
  useEffect(() => {
    return () => {
      attachedFiles.forEach(({ previewUrl }) => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 📘 Called when the user picks files from the file picker.
  // 'React.ChangeEvent<HTMLInputElement>' is the TypeScript type for change events on inputs.
  // 🔗 HTML file input: https://www.w3schools.com/tags/att_input_type_file.asp
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files || []);

    // 📘 .map() transforms each File into our { file, previewUrl } shape.
    // URL.createObjectURL creates a local URL like "blob:http://localhost/abc123".
    const newEntries = newFiles.map((file) => ({
      file,
      // Only create image previews for types Claude's vision API actually supports
      previewUrl:
        file.type.startsWith("image/") && file.type !== "image/svg+xml"
          ? URL.createObjectURL(file)
          : null,
    }));

    // '...' spreads the existing array and adds the new entries after it
    setAttachedFiles((prev) => [...prev, ...newEntries]);

    // Reset the input so the same file can be selected again
    e.target.value = "";
  }

  // 📘 Removes one file from the attached list and frees its preview URL from memory.
  function removeFile(index: number) {
    setAttachedFiles((prev) => {
      const entry = prev[index];
      if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl); // free memory
      return prev.filter((_, i) => i !== index); // keep everything except index
    });
  }

  // 📘 This function sends the user's message (and any attached files) to /api/chat
  // and handles Claude's reply. It's 'async' because fetching takes time.
  async function sendMessage() {
    const hasText = input.trim().length > 0;
    const hasFiles = attachedFiles.length > 0;
    if ((!hasText && !hasFiles) || loading) return; // nothing to send

    // 📘 Build the message content:
    // - If files are attached: build a ContentBlock array (images + text)
    // - If only text: send a plain string (simpler, no unnecessary wrapping)
    let content: string | ContentBlock[];
    if (hasFiles) {
      content = await buildContentBlocks(
        input,
        attachedFiles.map((e) => e.file)
      );
    } else {
      content = input.trim();
    }

    const userMessage: Message = { role: "user", content };

    // 📘 Use the "functional update" form of setState — it always has the latest value.
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");  // clear the text box

    // Revoke all preview URLs and clear the file list
    attachedFiles.forEach(({ previewUrl }) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    });
    setAttachedFiles([]);

    setLoading(true); // show the loading indicator

    // 📘 'try/catch/finally' — try sends the request, catch handles errors,
    // finally always runs (we use it to stop the loading indicator).
    try {
      // 📘 fetch() sends an HTTP request from the browser to our Next.js API route.
      // 'POST' means we're sending data. JSON.stringify() converts our JS object to a JSON string.
      // 🔗 fetch API: https://www.w3schools.com/js/js_api_fetch.asp
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      // 📘 res.ok is true when the HTTP status is 200–299 (success).
      // Always check this before reading the body — a 500 error also returns JSON,
      // but it has an 'error' key instead of 'reply'.
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `Server error ${res.status}`);
      }

      const data = await res.json();
      const reply: string = data.reply || "Sorry, something went wrong.";

      // 📘 Add Claude's reply to the conversation.
      const newMessages: Message[] = [
        ...updatedMessages,
        { role: "assistant", content: reply },
      ];
      setMessages(newMessages);

      // 📘 Check if Claude's reply contains the "brief ready" signal.
      // We look for the specific phrase the SYSTEM_PROMPT tells Claude to use.
      if (reply.toLowerCase().includes("ready to build your brief")) {
        setBriefSignaled(true);
      }
    } catch (err) {
      console.error("Chat error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Connection error — try again.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${errorMessage}` },
      ]);
    } finally {
      setLoading(false); // always stop loading, whether it succeeded or failed
    }
  }

  // 📘 This handles the Enter key in the text input.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Send on Enter (but not Shift+Enter, which adds a newline)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // 📘 Renders a message's content — handles both plain strings and ContentBlock arrays.
  // When the user attaches images, their message has ContentBlock[] content with image blocks.
  // Assistant messages always arrive as plain strings.
  function renderMessageContent(content: string | ContentBlock[]) {
    // Plain string — split on newlines to preserve Claude's formatting
    if (typeof content === "string") {
      return content.split("\n").map((line, i) => (
        <p key={i} className={i > 0 ? "mt-2" : ""}>
          {line}
        </p>
      ));
    }

    // 📘 ContentBlock array — render each block in order.
    // Image blocks become <img> tags; text blocks render as paragraphs.
    return content.map((block, i) => {
      if (block.type === "image") {
        // Reconstruct the data URL from the base64 data so the browser can display it
        return (
          <img
            key={i}
            src={`data:${block.source.media_type};base64,${block.source.data}`}
            alt="Attached image"
            className="max-w-full rounded-lg mt-1"
            style={{ maxHeight: "200px", objectFit: "contain" }}
          />
        );
      }
      // Text block
      return block.text.split("\n").map((line, j) => (
        <p key={`${i}-${j}`} className={j > 0 ? "mt-2" : ""}>
          {line}
        </p>
      ));
    });
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Message List ── */}
      {/* 📘 'overflow-y-auto' adds a scrollbar when content overflows the container.
          'flex-1' makes this section grow to fill available space. */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* 📘 Static opening greeting — rendered separately so it is never sent to the
            Anthropic API. The API requires messages to start with role "user", so we
            keep this welcome message out of the messages state array. */}
        <div className="flex justify-start">
          <div
            className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
            style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)" }}
          >
            <p>
              Hey! Let&apos;s build your promo video. To start — what is this
              promo for, and who&apos;s the audience? Don&apos;t overthink it,
              just describe it like you&apos;d tell a friend.
            </p>
          </div>
        </div>

        {/* 📘 .map() renders one bubble per message in the conversation. */}
        {messages.map((msg, index) => (
          <div
            key={index}
            // 📘 'justify-end' aligns user messages to the right; default is left.
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
              style={{
                backgroundColor:
                  msg.role === "user"
                    ? "var(--color-accent)"   // purple for user
                    : "var(--color-surface)", // dark panel for Claude
                color: "var(--color-text)",
              }}
            >
              {renderMessageContent(msg.content)}
            </div>
          </div>
        ))}

        {/* Loading indicator — shows while waiting for Claude */}
        {loading && (
          <div className="flex justify-start">
            <div
              className="rounded-2xl px-4 py-3 text-sm"
              style={{
                backgroundColor: "var(--color-surface)",
                color: "var(--color-muted)",
              }}
            >
              Claude is thinking...
            </div>
          </div>
        )}

        {/* 📘 This invisible div at the bottom is what we scroll into view. */}
        <div ref={bottomRef} />
      </div>

      {/* ── "Generate Brief" button (appears when Claude signals readiness) ── */}
      {briefSignaled && (
        <div className="px-4 pb-2">
          <button
            onClick={() => onBriefReady(messages)}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--color-accent)", color: "white" }}
          >
            Generate Creative Brief →
          </button>
        </div>
      )}

      {/* ── Attached file previews (shown above the input when files are queued) ── */}
      {/* 📘 'flex-wrap' lets the preview chips wrap onto a second line if there are many. */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {attachedFiles.map(({ file, previewUrl }, i) => (
            <div key={i} className="relative group">

              {/* Image files get a thumbnail preview; others get a filename chip */}
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="w-16 h-16 rounded-lg object-cover"
                  style={{ border: "1px solid var(--color-border)" }}
                />
              ) : (
                <div
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs max-w-[160px] truncate"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-muted)",
                  }}
                >
                  📎 {file.name}
                </div>
              )}

              {/* Remove button — appears on hover */}
              <button
                onClick={() => removeFile(i)}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold"
                style={{ backgroundColor: "#ef4444" }}
                title={`Remove ${file.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Input Area ── */}
      <div
        className="p-4 border-t flex gap-3 items-end"
        style={{ borderColor: "var(--color-border)" }}
      >
        {/* 📘 Hidden file input — triggered by the attachment button below.
            'multiple' allows selecting more than one file at once.
            'accept' restricts the file picker to useful types for a video brief.
            🔗 HTML file input: https://www.w3schools.com/tags/att_input_type_file.asp */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        {/* 📘 The attachment button opens the hidden file picker when clicked.
            'flex-shrink-0' prevents it from being squished when the textarea is wide. */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="flex-shrink-0 p-3 rounded-xl transition-opacity disabled:opacity-40"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-muted)",
            fontSize: "16px",
          }}
          title="Attach files (images, video, PDF)"
        >
          📎
        </button>

        {/* 📘 <textarea> is a multi-line text input — better than <input> for chat.
            'rows={1}' starts it small; it grows as the user types more.
            🔗 HTML forms: https://www.w3schools.com/html/html_forms.asp */}
        {/* 📘 suppressHydrationWarning tells React to ignore attribute differences on this element.
            Browser extensions (e.g. password managers) inject attributes like data-last-active-input
            before React loads, causing a server/client mismatch. This prop silences that warning.
            🔗 React hydration: https://react.dev/link/hydration-mismatch */}
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)} // update state as user types
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          autoFocus
          suppressHydrationWarning
          className="flex-1 resize-none rounded-xl px-4 py-3 text-sm outline-none"
          style={{
            backgroundColor: "var(--color-surface)",
            border: `1px solid var(--color-border)`,
            color: "var(--color-text)",
          }}
        />

        {/* 📘 The send button — disabled while loading or when there's nothing to send. */}
        <button
          onClick={sendMessage}
          disabled={loading || (!input.trim() && attachedFiles.length === 0)}
          className="px-5 py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-40"
          style={{ backgroundColor: "var(--color-accent)", color: "white" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
