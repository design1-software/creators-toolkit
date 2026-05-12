// 📘 WHAT THIS FILE DOES: The Thumbnail A/B skill page at /thumbnails.
// Users describe their video topic and preferred style. Claude generates 4 distinct
// thumbnail design concepts, each rendered as a live CSS mockup in the browser.
// The user can compare them side-by-side and pick their winner.
// 🔗 Next.js pages: https://nextjs.org/docs/app/building-your-application/routing/pages

"use client";

import { useState } from "react";

// 📘 TypeScript type for a single thumbnail concept returned by Claude.
// Defining this here makes the data shape explicit and prevents typos when reading props.
type ThumbnailConcept = {
  title: string;
  headline: string;
  subtext: string;
  description: string;
  colors: {
    bg: string;
    text: string;
    accent: string;
  };
  style: string;
  emoji: string;
  visualDirection: string;
};

const STYLE_OPTIONS = [
  "Bold & Shocking",
  "Clean & Minimal",
  "Cinematic & Dark",
  "Bright & Energetic",
  "Text-Dominant",
  "No preference",
];

export default function ThumbnailsPage() {
  const [topic, setTopic] = useState("");
  const [stylePreference, setStylePreference] = useState("No preference");
  const [loading, setLoading] = useState(false);
  const [concepts, setConcepts] = useState<ThumbnailConcept[]>([]);
  const [winner, setWinner] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setConcepts([]);
    setWinner(null);
    setError(null);

    try {
      const res = await fetch("/api/thumbnails/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, stylePreference }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setConcepts(data.concepts as ThumbnailConcept[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-10">
        <a href="/" className="text-sm mb-4 inline-block hover:underline" style={{ color: "var(--color-muted)" }}>
          ← Back to Dashboard
        </a>
        <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
          🖼️ Thumbnail A/B
        </h1>
        <p style={{ color: "var(--color-muted)" }}>
          Claude generates 4 dramatically different thumbnail concepts for your topic. Preview them live and pick your winner.
        </p>
      </div>

      {/* ── Input Form ── */}
      <div
        className="rounded-xl p-6 mb-8 space-y-5"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-muted)" }}>
            Video Topic / Title
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. I Tried Every Sourdough Technique For 30 Days — Here's What Actually Works"
            className="w-full rounded-lg px-4 py-3 text-sm"
            style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              outline: "none",
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-3" style={{ color: "var(--color-muted)" }}>
            Style Preference
          </label>
          <div className="flex flex-wrap gap-2">
            {STYLE_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setStylePreference(s)}
                className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={{
                  background: stylePreference === s ? "var(--color-accent)" : "var(--color-bg)",
                  color: stylePreference === s ? "#fff" : "var(--color-muted)",
                  border: `1px solid ${stylePreference === s ? "var(--color-accent)" : "var(--color-border)"}`,
                }}
              >
                {s}
              </button>
            ))}
          </div>
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
          {loading ? "Designing Concepts…" : "Generate 4 Concepts"}
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

      {/* ── Thumbnail Concept Grid ── */}
      {concepts.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
              4 Thumbnail Concepts
            </h2>
            {winner !== null && (
              <span
                className="text-sm px-3 py-1 rounded-full font-medium"
                style={{ background: "#16a34a22", color: "#4ade80", border: "1px solid #16a34a" }}
              >
                ✓ Winner: Concept {winner + 1}
              </span>
            )}
          </div>

          {/* 📘 CSS Grid with 2 columns — each concept card is the same size.
              'gap-6' adds spacing between the cards.
              🔗 CSS Grid: https://www.w3schools.com/css/css_grid.asp */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {concepts.map((concept, index) => (
              <ThumbnailCard
                key={index}
                concept={concept}
                index={index}
                isWinner={winner === index}
                onSelectWinner={() => setWinner(index)}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

// 📘 A sub-component for each thumbnail concept card.
// It renders a live CSS preview of the thumbnail design using the colors Claude chose.
function ThumbnailCard({
  concept,
  index,
  isWinner,
  onSelectWinner,
}: {
  concept: ThumbnailConcept;
  index: number;
  isWinner: boolean;
  onSelectWinner: () => void;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        border: `2px solid ${isWinner ? "#16a34a" : "var(--color-border)"}`,
        boxShadow: isWinner ? "0 0 20px rgba(22,163,74,0.2)" : "none",
      }}
    >
      {/* 📘 The thumbnail preview — a 16:9 ratio box rendered with CSS.
          'paddingTop: 56.25%' is the CSS trick for maintaining 16:9 aspect ratio.
          position: relative on the parent + position: absolute on the child fills it.
          🔗 CSS aspect ratio trick: https://www.w3schools.com/howto/howto_css_aspect_ratio.asp */}
      <div style={{ position: "relative", paddingTop: "56.25%", background: concept.colors.bg }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
          }}
        >
          {/* Decorative emoji in corner */}
          <span
            style={{
              position: "absolute",
              top: "12px",
              right: "16px",
              fontSize: "24px",
              opacity: 0.8,
            }}
          >
            {concept.emoji}
          </span>

          {/* Main headline text */}
          <h3
            style={{
              color: concept.colors.text,
              fontSize: "clamp(20px, 4vw, 36px)",
              fontWeight: 900,
              fontFamily: "system-ui, sans-serif",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              textShadow: `2px 2px 0 rgba(0,0,0,0.5)`,
              marginBottom: "8px",
            }}
          >
            {concept.headline}
          </h3>

          {/* Subtext — only shown if Claude provided it */}
          {concept.subtext && (
            <p
              style={{
                color: concept.colors.accent,
                fontSize: "clamp(12px, 2vw, 18px)",
                fontWeight: 700,
                fontFamily: "system-ui, sans-serif",
                letterSpacing: "0.05em",
              }}
            >
              {concept.subtext}
            </p>
          )}

          {/* Accent bar — a visual style element */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "4px",
              background: concept.colors.accent,
            }}
          />
        </div>
      </div>

      {/* Card footer — concept details */}
      <div
        className="p-4 space-y-3"
        style={{ background: "var(--color-surface)" }}
      >
        <div className="flex justify-between items-start gap-3">
          <div>
            <p className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
              Concept {index + 1}: {concept.title}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
              Style: {concept.style}
            </p>
          </div>
          {/* Color swatches */}
          <div className="flex gap-1 flex-shrink-0">
            {[concept.colors.bg, concept.colors.text, concept.colors.accent].map((color, i) => (
              <div
                key={i}
                title={color}
                className="w-5 h-5 rounded-full border"
                style={{ background: color, borderColor: "var(--color-border)" }}
              />
            ))}
          </div>
        </div>

        <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
          {concept.description}
        </p>

        <p className="text-xs italic" style={{ color: "var(--color-muted)", opacity: 0.7 }}>
          📷 {concept.visualDirection}
        </p>

        <button
          onClick={onSelectWinner}
          className="w-full py-2 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: isWinner ? "#16a34a" : "var(--color-bg)",
            color: isWinner ? "#fff" : "var(--color-text)",
            border: `1px solid ${isWinner ? "#16a34a" : "var(--color-border)"}`,
          }}
        >
          {isWinner ? "✓ Selected as Winner" : "Select as Winner"}
        </button>
      </div>
    </div>
  );
}
