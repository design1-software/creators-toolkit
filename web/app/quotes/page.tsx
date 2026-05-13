// 📘 WHAT THIS FILE DOES: The Animated Quotes skill page at /quotes.
// Users enter a quote and author. Claude picks colors and animation style based on the
// quote's emotional tone. Remotion then renders a 15–30s animated video.
// 🔗 Next.js pages: https://nextjs.org/docs/app/building-your-application/routing/pages

"use client";

import { useState } from "react";
// 📘 ProgressTracker is a reusable component from Phase 2 that shows step-by-step progress.
// We import it here to reuse the same UI pattern for the render pipeline.
import ProgressTracker, { type Step } from "@/components/ProgressTracker";
import { v4 as uuidv4 } from "uuid";

// 📘 TypeScript type for the style parameters Claude returns.
type QuoteStyle = {
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  textColor: string;
  animationStyle: "word-by-word" | "full-text";
  fontSize: "small" | "medium" | "large";
  durationSeconds: number;
  musicPrompt?: string;
};

const STYLE_PRESETS = [
  "Let the quote's mood guide you",
  "Cinematic — dark and epic",
  "Minimalist — clean and spacious",
  "Bold — high energy, bright colors",
  "Elegant — refined, serif, muted tones",
];

// 📘 Steps when music is disabled — the shorter pipeline.
const STEPS_NO_MUSIC: Step[] = [
  { id: "analyze", label: "Analyze quote mood", status: "pending" },
  { id: "style",   label: "Choose visual style", status: "pending" },
  { id: "render",  label: "Render video", status: "pending" },
  { id: "done",    label: "Ready to download", status: "pending" },
];

// 📘 Steps when music is enabled — adds a Suno generation step before render.
const STEPS_WITH_MUSIC: Step[] = [
  { id: "analyze", label: "Analyze quote mood", status: "pending" },
  { id: "style",   label: "Choose visual style", status: "pending" },
  { id: "music",   label: "Generate background music", status: "pending" },
  { id: "render",  label: "Render video", status: "pending" },
  { id: "done",    label: "Ready to download", status: "pending" },
];

export default function QuotesPage() {
  const [quote, setQuote] = useState("");
  const [author, setAuthor] = useState("");
  const [stylePreference, setStylePreference] = useState(STYLE_PRESETS[0]);
  const [addMusic, setAddMusic] = useState(false);
  const [phase, setPhase] = useState<"input" | "processing" | "done">("input");
  const [steps, setSteps] = useState<Step[]>(STEPS_NO_MUSIC);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [quoteStyle, setQuoteStyle] = useState<QuoteStyle | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 📘 'updateStep' is a helper function that updates one step in the array
  // without changing the others. We find the step by its 'id' and replace it.
  function updateStep(id: string, update: Partial<Step>) {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...update } : s))
    );
  }

  async function handleRender() {
    if (!quote.trim() || !author.trim()) return;
    setPhase("processing");
    // 📘 Choose the right step list based on whether music is enabled.
    // We must set this before the pipeline starts so the tracker shows the correct steps.
    setSteps(addMusic ? STEPS_WITH_MUSIC : STEPS_NO_MUSIC);
    setError(null);
    setVideoUrl(null);

    try {
      // ── Step 1: Analyze quote and choose style ──
      updateStep("analyze", { status: "running" });
      await new Promise((r) => setTimeout(r, 400)); // small pause for visual feedback

      updateStep("style", { status: "running" });

      const styleRes = await fetch("/api/quotes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote, author, stylePreference }),
      });

      const styleData = await styleRes.json();
      if (!styleRes.ok) throw new Error(styleData.error ?? "Style generation failed");

      const style = styleData.style as QuoteStyle;
      setQuoteStyle(style);

      updateStep("analyze", { status: "done" });
      updateStep("style", { status: "done", detail: `${style.animationStyle} · ${style.durationSeconds}s` });

      // ── Step 2 (optional): Generate background music via Suno ──
      // 📘 We use a local variable so the audioSrc is available immediately in step 3
      // without waiting for React's async state update to propagate.
      let audioSrc = "";
      if (addMusic) {
        updateStep("music", { status: "running", detail: "Composing with Suno…" });
        const jobId = uuidv4();
        const musicRes = await fetch("/api/quotes/music", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ musicPrompt: style.musicPrompt, jobId }),
        });
        const musicData = await musicRes.json();
        if (!musicRes.ok) throw new Error(musicData.error ?? "Music generation failed");
        audioSrc = musicData.audioSrc;
        updateStep("music", { status: "done", detail: "Track ready" });
      }

      // ── Step 3: Render video ──
      updateStep("render", { status: "running", detail: "Calling Remotion…" });

      const jobId = uuidv4();

      const renderRes = await fetch("/api/quotes/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote, author, style, jobId, audioSrc }),
      });

      const renderData = await renderRes.json();
      if (!renderRes.ok) throw new Error(renderData.error ?? "Render failed");

      updateStep("render", { status: "done", detail: "MP4 ready" });
      updateStep("done", { status: "done" });

      setVideoUrl(renderData.url);
      setPhase("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      // Mark the currently-running step as errored.
      setSteps((prev) =>
        prev.map((s) => (s.status === "running" ? { ...s, status: "error", detail: message } : s))
      );
    }
  }

  function handleReset() {
    setPhase("input");
    setSteps(addMusic ? STEPS_WITH_MUSIC : STEPS_NO_MUSIC);
    setVideoUrl(null);
    setQuoteStyle(null);
    setError(null);
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-10">
        <a href="/" className="text-sm mb-4 inline-block hover:underline" style={{ color: "var(--color-muted)" }}>
          ← Back to Dashboard
        </a>
        <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
          💬 Animated Quotes
        </h1>
        <p style={{ color: "var(--color-muted)" }}>
          Enter a quote. Claude chooses the perfect color palette and animation. Remotion renders a 15–30s shareable video.
        </p>
      </div>

      {/* ── Input Phase ── */}
      {phase === "input" && (
        <div
          className="rounded-xl p-6 space-y-5"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          {/* Quote text */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-muted)" }}>
              Quote
            </label>
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder={`"The only way to do great work is to love what you do."`}
              rows={4}
              className="w-full rounded-lg px-4 py-3 text-sm resize-none"
              style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                outline: "none",
              }}
            />
            <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
              {quote.split(" ").filter(Boolean).length} words ·{" "}
              {quote.split(" ").filter(Boolean).length <= 15
                ? "Ideal for word-by-word animation"
                : "Will use full-text animation"}
            </p>
          </div>

          {/* Author */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-muted)" }}>
              Author
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Steve Jobs"
              className="w-full rounded-lg px-4 py-3 text-sm"
              style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                outline: "none",
              }}
            />
          </div>

          {/* Style preference */}
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: "var(--color-muted)" }}>
              Visual Style
            </label>
            <div className="flex flex-col gap-2">
              {STYLE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setStylePreference(preset)}
                  className="text-left px-4 py-3 rounded-lg text-sm transition-all"
                  style={{
                    background: stylePreference === preset ? "rgba(124,58,237,0.15)" : "var(--color-bg)",
                    color: stylePreference === preset ? "var(--color-text)" : "var(--color-muted)",
                    border: `1px solid ${stylePreference === preset ? "var(--color-accent)" : "var(--color-border)"}`,
                  }}
                >
                  {stylePreference === preset && "● "}{preset}
                </button>
              ))}
            </div>
          </div>

          {/* ── Music toggle ── */}
          {/* 📘 A toggle lets the user opt into Suno music generation.
              It adds ~60-90s to the pipeline, so we make it opt-in rather than always-on. */}
          <button
            onClick={() => setAddMusic((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-all"
            style={{
              background: addMusic ? "rgba(124,58,237,0.15)" : "var(--color-bg)",
              border: `1px solid ${addMusic ? "var(--color-accent)" : "var(--color-border)"}`,
              color: addMusic ? "var(--color-text)" : "var(--color-muted)",
            }}
          >
            <span>🎵 Add background music</span>
            <span
              className="text-xs px-2 py-1 rounded-full font-medium"
              style={{
                background: addMusic ? "var(--color-accent)" : "var(--color-border)",
                color: "white",
              }}
            >
              {addMusic ? "ON" : "OFF"}
            </span>
          </button>
          {addMusic && (
            <p className="text-xs -mt-3" style={{ color: "var(--color-muted)" }}>
              Claude picks a music prompt · Suno generates a matching instrumental · adds ~60–90s
            </p>
          )}

          <button
            onClick={handleRender}
            disabled={!quote.trim() || !author.trim()}
            className="w-full py-3 rounded-lg font-semibold text-white transition-all"
            style={{
              background: !quote.trim() || !author.trim() ? "var(--color-border)" : "var(--color-accent)",
              cursor: !quote.trim() || !author.trim() ? "not-allowed" : "pointer",
            }}
          >
            Generate & Render Video
          </button>
        </div>
      )}

      {/* ── Processing Phase ── */}
      {phase === "processing" && (
        <div className="space-y-6">
          {/* Live style preview — shown once Claude returns the colors */}
          {quoteStyle && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--color-border)" }}
            >
              {/* 📘 paddingTop: "100%" creates a square aspect ratio box.
                  The gradient preview lets the user see Claude's color choices immediately. */}
              <div
                style={{
                  position: "relative",
                  paddingTop: "100%",
                  background: `linear-gradient(135deg, ${quoteStyle.gradientFrom}, ${quoteStyle.gradientTo})`,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "40px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: "60px",
                      height: "3px",
                      background: quoteStyle.accentColor,
                      borderRadius: "2px",
                      marginBottom: "24px",
                    }}
                  />
                  <p
                    style={{
                      color: quoteStyle.textColor,
                      fontSize: "clamp(16px, 3vw, 24px)",
                      fontWeight: 700,
                      fontFamily: "Georgia, serif",
                      lineHeight: 1.4,
                      maxWidth: "80%",
                    }}
                  >
                    "{quote}"
                  </p>
                  <p
                    style={{
                      color: quoteStyle.accentColor,
                      fontSize: "clamp(12px, 2vw, 16px)",
                      fontStyle: "italic",
                      marginTop: "20px",
                      fontFamily: "Georgia, serif",
                    }}
                  >
                    — {author}
                  </p>
                </div>
              </div>
              <div
                className="px-4 py-2 text-xs text-center"
                style={{ background: "var(--color-surface)", color: "var(--color-muted)" }}
              >
                Color preview · {quoteStyle.animationStyle} · {quoteStyle.durationSeconds}s
              </div>
            </div>
          )}

          <ProgressTracker steps={steps} />
        </div>
      )}

      {/* ── Done Phase ── */}
      {phase === "done" && videoUrl && (
        <div className="space-y-6">
          {/* Video player */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--color-border)" }}
          >
            {/* 📘 <video> is an HTML element that lets the browser play a video file.
                'controls' shows play/pause/volume. 'playsInline' prevents fullscreen on iOS.
                🔗 HTML video element: https://www.w3schools.com/html/html5_video.asp */}
            <video
              src={videoUrl}
              controls
              playsInline
              className="w-full"
              style={{ display: "block" }}
            />
          </div>

          <div className="flex gap-3">
            <a
              href={videoUrl}
              download
              className="flex-1 py-3 rounded-lg font-semibold text-white text-center transition-all"
              style={{ background: "var(--color-accent)" }}
            >
              Download MP4
            </a>
            <button
              onClick={handleReset}
              className="flex-1 py-3 rounded-lg font-semibold transition-all"
              style={{
                background: "var(--color-surface)",
                color: "var(--color-text)",
                border: "1px solid var(--color-border)",
              }}
            >
              Make Another
            </button>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && phase !== "processing" && (
        <div
          className="rounded-lg px-4 py-3 mt-6 text-sm"
          style={{ background: "#2d1515", color: "#f87171", border: "1px solid #7f1d1d" }}
        >
          <p>{error}</p>
          <button onClick={handleReset} className="underline mt-2">
            Try again
          </button>
        </div>
      )}
    </main>
  );
}
