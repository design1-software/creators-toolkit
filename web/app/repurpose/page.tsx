// 📘 WHAT THIS FILE DOES: The Content Repurposer skill page at /repurpose.
// Users paste original content, pick target platforms, and Claude rewrites it
// for each platform's unique format — length, tone, culture, and audience.
// 🔗 Next.js pages: https://nextjs.org/docs/app/building-your-application/routing/pages

"use client";

import { useState } from "react";

// 📘 Platform config — each platform has a name, emoji, and a note about its format.
// Keeping this data separate from the UI logic makes it easy to add new platforms.
const PLATFORMS = [
  { id: "instagram", label: "Instagram", emoji: "📸", note: "Long caption + hashtags" },
  { id: "tiktok", label: "TikTok", emoji: "🎵", note: "150 char caption" },
  { id: "twitter", label: "Twitter / X", emoji: "🐦", note: "Under 280 chars" },
  { id: "linkedin", label: "LinkedIn", emoji: "💼", note: "Professional insight" },
  { id: "youtube", label: "YouTube", emoji: "▶️", note: "SEO description" },
  { id: "email", label: "Email Newsletter", emoji: "📧", note: "Subject + body" },
];

export default function RepurposePage() {
  const [content, setContent] = useState("");
  // 📘 'Set<string>' is a JavaScript Set — a collection where each item appears only once.
  // We use it to track which platform checkboxes are selected.
  // 🔗 JavaScript Sets: https://www.w3schools.com/js/js_object_sets.asp
  const [selected, setSelected] = useState<Set<string>>(new Set(["instagram", "twitter"]));
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // 'activeTab' tracks which platform result the user is currently viewing.
  const [activeTab, setActiveTab] = useState<string>("");

  // 📘 Toggle a platform checkbox — if it's already selected, remove it; otherwise add it.
  function togglePlatform(id: string) {
    setSelected((prev) => {
      // 'new Set(prev)' creates a copy so we don't mutate the original.
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleRepurpose() {
    if (!content.trim() || selected.size === 0) return;
    setLoading(true);
    setResults(null);
    setError(null);

    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 'Array.from(selected)' converts the Set back to a regular array for JSON serialization.
        body: JSON.stringify({ content, platforms: Array.from(selected) }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Repurposing failed");
      setResults(data.repurposed);
      // 📘 After results load, auto-select the first returned platform as the active tab.
      setActiveTab(Object.keys(data.repurposed)[0] ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-10">
        <a href="/" className="text-sm mb-4 inline-block hover:underline" style={{ color: "var(--color-muted)" }}>
          ← Back to Dashboard
        </a>
        <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
          ♻️ Content Repurposer
        </h1>
        <p style={{ color: "var(--color-muted)" }}>
          Paste any piece of content. Claude rewrites it for every platform you choose — right format, right length, right tone.
        </p>
      </div>

      {/* ── Input Form ── */}
      <div
        className="rounded-xl p-6 mb-8 space-y-6"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >

        {/* Original content textarea */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-muted)" }}>
            Original Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste a blog post, video script, podcast transcript, newsletter section, or any other content here…"
            rows={8}
            className="w-full rounded-lg px-4 py-3 text-sm resize-none"
            style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              outline: "none",
            }}
          />
          {/* 📘 Template literals (backticks + ${}) let us embed variables in strings.
              Here we show a live character count as the user types. */}
          <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
            {content.length} characters
          </p>
        </div>

        {/* Platform checkboxes */}
        <div>
          <label className="block text-sm font-medium mb-3" style={{ color: "var(--color-muted)" }}>
            Target Platforms
          </label>
          {/* 📘 CSS Grid with 2 columns on small screens, 3 on medium+ */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {PLATFORMS.map(({ id, label, emoji, note }) => {
              const isChecked = selected.has(id);
              return (
                <button
                  key={id}
                  onClick={() => togglePlatform(id)}
                  className="flex items-start gap-3 p-3 rounded-lg text-left transition-all"
                  style={{
                    background: isChecked ? "rgba(124,58,237,0.15)" : "var(--color-bg)",
                    border: `1px solid ${isChecked ? "var(--color-accent)" : "var(--color-border)"}`,
                  }}
                >
                  {/* 📘 A simple checkbox indicator using a ternary expression.
                      condition ? valueIfTrue : valueIfFalse
                      🔗 Ternary operator: https://www.w3schools.com/js/js_comparisons.asp */}
                  <span
                    className="w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center text-xs"
                    style={{
                      background: isChecked ? "var(--color-accent)" : "transparent",
                      border: `1px solid ${isChecked ? "var(--color-accent)" : "var(--color-border)"}`,
                    }}
                  >
                    {isChecked && "✓"}
                  </span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                      {emoji} {label}
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-muted)" }}>{note}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleRepurpose}
          disabled={loading || !content.trim() || selected.size === 0}
          className="w-full py-3 rounded-lg font-semibold text-white transition-all"
          style={{
            background: loading || !content.trim() || selected.size === 0
              ? "var(--color-border)"
              : "var(--color-accent)",
            cursor: loading || !content.trim() || selected.size === 0 ? "not-allowed" : "pointer",
          }}
        >
          {loading
            ? `Repurposing for ${selected.size} platform${selected.size !== 1 ? "s" : ""}…`
            : `Repurpose for ${selected.size} Platform${selected.size !== 1 ? "s" : ""}`}
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

      {/* ── Results — tabbed view ── */}
      {results && (
        <div>
          <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--color-text)" }}>
            Repurposed Content
          </h2>

          {/* Tab buttons — one per platform result */}
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.keys(results).map((platformId) => {
              const platformInfo = PLATFORMS.find((p) => p.id === platformId);
              return (
                <button
                  key={platformId}
                  onClick={() => setActiveTab(platformId)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: activeTab === platformId ? "var(--color-accent)" : "var(--color-surface)",
                    color: activeTab === platformId ? "#fff" : "var(--color-muted)",
                    border: `1px solid ${activeTab === platformId ? "var(--color-accent)" : "var(--color-border)"}`,
                  }}
                >
                  {platformInfo?.emoji} {platformInfo?.label ?? platformId}
                </button>
              );
            })}
          </div>

          {/* Active tab content */}
          {activeTab && results[activeTab] && (
            <div
              className="rounded-xl p-6"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
                  {PLATFORMS.find((p) => p.id === activeTab)?.emoji}{" "}
                  {PLATFORMS.find((p) => p.id === activeTab)?.label} Version
                </p>
                <button
                  onClick={() => copyToClipboard(results[activeTab], activeTab)}
                  className="text-xs px-3 py-1 rounded-full transition-all"
                  style={{
                    background: copiedKey === activeTab ? "#16a34a" : "var(--color-bg)",
                    color: copiedKey === activeTab ? "#fff" : "var(--color-muted)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {copiedKey === activeTab ? "✓ Copied!" : "Copy"}
                </button>
              </div>
              {/* 📘 'whitespace-pre-wrap' preserves line breaks in the text — important
                  because Claude formats content with newlines for readability. */}
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: "var(--color-text)" }}
              >
                {results[activeTab]}
              </p>
              <p className="text-xs mt-3" style={{ color: "var(--color-muted)" }}>
                {results[activeTab].length} characters
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
