// 📘 WHAT THIS FILE DOES: The Copywriting skill page at /copy.
// Users pick a platform and tone, describe their content, and Claude generates
// a full set of platform-optimized copy: caption, hook, hashtags, CTA, and bio line.
// 🔗 Next.js pages: https://nextjs.org/docs/app/building-your-application/routing/pages

// 📘 'use client' marks this as a Client Component — it runs in the browser.
// We need this because the form uses useState (React state) and event handlers.
// 🔗 Client components: https://nextjs.org/docs/app/building-your-application/rendering/client-components
"use client";

// 📘 'useState' lets a component remember values that change over time.
// Each call to useState gives us a value and a function to update it.
// 🔗 useState hook: https://www.w3schools.com/react/react_hooks.asp
import { useState } from "react";

// 📘 TypeScript type for the copy data Claude returns.
// Having a type means TypeScript will catch typos when we use copy.caption, etc.
// 🔗 TypeScript interfaces: https://www.w3schools.com/typescript/typescript_object_types.php
type CopyResult = {
  caption: string;
  hook: string;
  hashtags: string[];
  cta: string;
  bioLine: string;
  titleOptions: string[];
};

// 📘 Constants — values that never change, defined outside the component.
// Using arrays for the options means we can easily add/remove choices later.
const PLATFORMS = ["Instagram", "TikTok", "Twitter / X", "LinkedIn", "YouTube", "General"];
const TONES = ["Professional", "Casual", "Humorous", "Inspirational", "Educational", "Bold"];

export default function CopyPage() {
  // 📘 'useState<string>("")' creates a state variable starting as an empty string.
  // 'setPlatform' is the setter — calling it replaces the current value and re-renders the UI.
  const [platform, setPlatform] = useState<string>("Instagram");
  const [tone, setTone] = useState<string>("Casual");
  const [topic, setTopic] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CopyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 'copiedKey' tracks which copy block was just copied so we can show a checkmark.
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 📘 This function runs when the user clicks "Generate Copy".
  // 'async' means it can use 'await' to pause and wait for network requests.
  // 🔗 async functions: https://www.w3schools.com/js/js_async.asp
  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // 📘 'fetch' sends an HTTP request to our API route.
      // We send the data as JSON in the request body.
      // 🔗 fetch API: https://www.w3schools.com/js/js_api_fetch.asp
      const res = await fetch("/api/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, tone, topic }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResult(data.copy as CopyResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      // 📘 'finally' always runs — even if an error occurred.
      // We use it to turn off the loading spinner no matter what.
      setLoading(false);
    }
  }

  // 📘 This function copies text to the clipboard and briefly shows a checkmark.
  async function copyToClipboard(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    // 📘 setTimeout runs a function after a delay (in milliseconds).
    // Here we clear the checkmark after 2 seconds.
    // 🔗 setTimeout: https://www.w3schools.com/jsref/met_win_settimeout.asp
    setTimeout(() => setCopiedKey(null), 2000);
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-10">
        <a
          href="/"
          className="text-sm mb-4 inline-block hover:underline"
          style={{ color: "var(--color-muted)" }}
        >
          ← Back to Dashboard
        </a>
        <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
          ✍️ Copywriting
        </h1>
        <p style={{ color: "var(--color-muted)" }}>
          Describe your content. Claude generates captions, hooks, hashtags, CTAs, and bio copy — tailored to your platform and voice.
        </p>
      </div>

      {/* ── Input Form ── */}
      <div
        className="rounded-xl p-6 mb-8 space-y-6"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >

        {/* Platform selector — pill buttons */}
        <div>
          <label className="block text-sm font-medium mb-3" style={{ color: "var(--color-muted)" }}>
            Platform
          </label>
          {/* 📘 'flex-wrap' lets items wrap to the next line when they run out of space. */}
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={{
                  background: platform === p ? "var(--color-accent)" : "var(--color-bg)",
                  color: platform === p ? "#fff" : "var(--color-muted)",
                  border: `1px solid ${platform === p ? "var(--color-accent)" : "var(--color-border)"}`,
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Tone selector — pill buttons */}
        <div>
          <label className="block text-sm font-medium mb-3" style={{ color: "var(--color-muted)" }}>
            Tone
          </label>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={{
                  background: tone === t ? "var(--color-accent)" : "var(--color-bg)",
                  color: tone === t ? "#fff" : "var(--color-muted)",
                  border: `1px solid ${tone === t ? "var(--color-accent)" : "var(--color-border)"}`,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Topic / content description */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-muted)" }}>
            What is your content about?
          </label>
          {/* 📘 <textarea> is a multi-line text input.
              'value' binds it to the state variable; 'onChange' updates state as the user types.
              🔗 HTML textarea: https://www.w3schools.com/tags/tag_textarea.asp */}
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. A tutorial showing how to make sourdough bread from scratch, targeting beginners who want to bake at home..."
            rows={4}
            className="w-full rounded-lg px-4 py-3 text-sm resize-none"
            style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              outline: "none",
            }}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !topic.trim()}
          className="w-full py-3 rounded-lg font-semibold text-white transition-all"
          style={{
            background: loading || !topic.trim() ? "var(--color-border)" : "var(--color-accent)",
            cursor: loading || !topic.trim() ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Generating…" : "Generate Copy"}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          className="rounded-lg px-4 py-3 mb-6 text-sm"
          style={{ background: "#2d1515", color: "#f87171", border: "1px solid #7f1d1d" }}
        >
          {error}
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
            Your Copy — {platform} · {tone}
          </h2>

          {/* 📘 Each copy type gets its own card. We reuse the same card style for all. */}
          {[
            { key: "caption", label: "📝 Caption", content: result.caption },
            { key: "hook", label: "🎣 Hook / Opening Line", content: result.hook },
            { key: "cta", label: "👆 Call to Action", content: result.cta },
            { key: "bioLine", label: "👤 Bio Line", content: result.bioLine },
          ].map(({ key, label, content }) => (
            <CopyCard
              key={key}
              label={label}
              content={content}
              isCopied={copiedKey === key}
              onCopy={() => copyToClipboard(content, key)}
            />
          ))}

          {/* Hashtags — displayed as individual pills */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
                #️⃣ Hashtags
              </span>
              <button
                onClick={() => copyToClipboard(result.hashtags.map((h) => `#${h}`).join(" "), "hashtags")}
                className="text-xs px-3 py-1 rounded-full"
                style={{
                  background: copiedKey === "hashtags" ? "#16a34a" : "var(--color-bg)",
                  color: copiedKey === "hashtags" ? "#fff" : "var(--color-muted)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {copiedKey === "hashtags" ? "✓ Copied!" : "Copy All"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.hashtags.map((tag, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full text-sm"
                  style={{ background: "var(--color-bg)", color: "var(--color-accent)", border: "1px solid var(--color-border)" }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Title options */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-sm font-medium mb-3" style={{ color: "var(--color-muted)" }}>
              🔤 Title Options
            </p>
            <div className="space-y-2">
              {result.titleOptions?.map((title, i) => (
                <div key={i} className="flex justify-between items-center gap-4">
                  <p className="text-sm" style={{ color: "var(--color-text)" }}>{title}</p>
                  <button
                    onClick={() => copyToClipboard(title, `title-${i}`)}
                    className="text-xs px-3 py-1 rounded-full shrink-0"
                    style={{
                      background: copiedKey === `title-${i}` ? "#16a34a" : "var(--color-bg)",
                      color: copiedKey === `title-${i}` ? "#fff" : "var(--color-muted)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {copiedKey === `title-${i}` ? "✓" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// 📘 A reusable sub-component for each copy block card.
// Breaking it out keeps the main component clean and readable.
// 🔗 React components: https://www.w3schools.com/react/react_components.asp
function CopyCard({
  label,
  content,
  isCopied,
  onCopy,
}: {
  label: string;
  content: string;
  isCopied: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
          {label}
        </span>
        <button
          onClick={onCopy}
          className="text-xs px-3 py-1 rounded-full transition-all"
          style={{
            background: isCopied ? "#16a34a" : "var(--color-bg)",
            color: isCopied ? "#fff" : "var(--color-muted)",
            border: "1px solid var(--color-border)",
          }}
        >
          {isCopied ? "✓ Copied!" : "Copy"}
        </button>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-text)" }}>
        {content}
      </p>
    </div>
  );
}
