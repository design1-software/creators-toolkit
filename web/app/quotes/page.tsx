"use client";
// 📘 WHAT THIS FILE DOES: The Animated Quotes skill page at /quotes.
// Users enter a quote and author. Claude picks colors and animation style based on the
// quote's emotional tone. Remotion then renders a 15–30s animated video.
//
// CHECKPOINT SYSTEM: After each step succeeds the result is saved to localStorage.
// If the pipeline crashes (most likely at Render), the user can resume from the last
// successful step. Checkpoints expire after 1 hour.
// 🔗 localStorage: https://www.w3schools.com/jsref/prop_win_localstorage.asp

import { useState, useEffect } from "react";
import ProgressTracker, { type Step } from "@/components/ProgressTracker";
import { v4 as uuidv4 } from "uuid";

// ── Types ───────────────────────────────────────────────────────────────────

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

// 📘 Checkpoint holds everything accumulated so far in the pipeline.
type QuotesCheckpoint = {
  timestamp: number;
  lastCompletedStep: "style" | "music";
  // User inputs — needed to re-run the render if it failed
  quote: string;
  author: string;
  addMusic: boolean;
  jobId: string;
  style: QuoteStyle;
  audioSrc?: string;   // only present when addMusic was true and music succeeded
};

// ── Checkpoint helpers ──────────────────────────────────────────────────────

const CHECKPOINT_KEY = "creators_toolkit_quotes";
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

function saveCheckpoint(data: QuotesCheckpoint) {
  try { localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(data)); } catch {}
}

function loadCheckpoint(): QuotesCheckpoint | null {
  try {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as QuotesCheckpoint;
    if (Date.now() - data.timestamp > MAX_AGE_MS) {
      localStorage.removeItem(CHECKPOINT_KEY);
      return null;
    }
    return data;
  } catch { return null; }
}

function clearCheckpoint() {
  try { localStorage.removeItem(CHECKPOINT_KEY); } catch {}
}

function timeAgo(timestamp: number): string {
  const mins = Math.floor((Date.now() - timestamp) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  return `${Math.floor(mins / 60)} hour${Math.floor(mins / 60) > 1 ? "s" : ""} ago`;
}

// ── Step definitions ────────────────────────────────────────────────────────

const STYLE_PRESETS = [
  "Let the quote's mood guide you",
  "Cinematic — dark and epic",
  "Minimalist — clean and spacious",
  "Bold — high energy, bright colors",
  "Elegant — refined, serif, muted tones",
];

const STEPS_NO_MUSIC: Step[] = [
  { id: "analyze", label: "Analyze quote mood",  status: "pending" },
  { id: "style",   label: "Choose visual style", status: "pending" },
  { id: "render",  label: "Render video",         status: "pending" },
  { id: "done",    label: "Ready to download",    status: "pending" },
];

const STEPS_WITH_MUSIC: Step[] = [
  { id: "analyze", label: "Analyze quote mood",        status: "pending" },
  { id: "style",   label: "Choose visual style",       status: "pending" },
  { id: "music",   label: "Generate background music", status: "pending" },
  { id: "render",  label: "Render video",               status: "pending" },
  { id: "done",    label: "Ready to download",          status: "pending" },
];

// ── Page component ──────────────────────────────────────────────────────────

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
  const [checkpoint, setCheckpoint] = useState<QuotesCheckpoint | null>(null);

  useEffect(() => {
    setCheckpoint(loadCheckpoint());
  }, []);

  function updateStep(id: string, update: Partial<Step>) {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...update } : s))
    );
  }

  // 📘 Builds initial steps with already-completed steps marked as "done".
  function buildResumeSteps(cp: QuotesCheckpoint): Step[] {
    const base = cp.addMusic ? STEPS_WITH_MUSIC : STEPS_NO_MUSIC;
    return base.map((s) => {
      if (s.id === "analyze" || s.id === "style") return { ...s, status: "done" as const };
      if (s.id === "music" && cp.lastCompletedStep === "music") return { ...s, status: "done" as const };
      return s;
    });
  }

  // ── Main pipeline ──────────────────────────────────────────────────────────
  // 📘 cp is the saved checkpoint when resuming; undefined means start fresh.
  async function handleRender(cp?: QuotesCheckpoint) {
    setPhase("processing");
    setError(null);
    setVideoUrl(null);

    // 📘 Pre-populate inputs from checkpoint when resuming so the user doesn't
    // need to re-type their quote and author.
    const currentQuote  = cp?.quote  ?? quote;
    const currentAuthor = cp?.author ?? author;
    const currentMusic  = cp?.addMusic ?? addMusic;

    setSteps(cp ? buildResumeSteps(cp) : (currentMusic ? STEPS_WITH_MUSIC : STEPS_NO_MUSIC));

    try {
      // ── Step 1: Style generation ─────────────────────────────────────────
      // 📘 Skip if resuming past this step — we already have the style.
      let style = cp?.style!;
      if (!cp?.style) {
        updateStep("analyze", { status: "running" });
        await new Promise((r) => setTimeout(r, 400));
        updateStep("style", { status: "running" });

        const styleRes = await fetch("/api/quotes/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quote: currentQuote, author: currentAuthor, stylePreference }),
        });
        const styleData = await styleRes.json();
        if (!styleRes.ok) throw new Error(styleData.error ?? "Style generation failed");

        style = styleData.style as QuoteStyle;
        setQuoteStyle(style);

        const jobId = uuidv4();
        saveCheckpoint({
          timestamp: Date.now(),
          lastCompletedStep: "style",
          quote: currentQuote,
          author: currentAuthor,
          addMusic: currentMusic,
          jobId,
          style,
        });
        setCheckpoint(loadCheckpoint());
        updateStep("analyze", { status: "done" });
        updateStep("style", { status: "done", detail: `${style.animationStyle} · ${style.durationSeconds}s` });
      } else {
        setQuoteStyle(style);
      }

      const jobId = cp?.jobId ?? loadCheckpoint()?.jobId ?? uuidv4();

      // ── Step 2 (optional): Music ─────────────────────────────────────────
      let audioSrc = cp?.audioSrc ?? "";
      if (currentMusic && !cp?.audioSrc) {
        updateStep("music", { status: "running", detail: "Composing with Suno…" });
        const musicRes = await fetch("/api/quotes/music", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ musicPrompt: style.musicPrompt, jobId }),
        });
        const musicData = await musicRes.json();
        if (!musicRes.ok) throw new Error(musicData.error ?? "Music generation failed");

        audioSrc = musicData.audioSrc;
        saveCheckpoint({
          ...loadCheckpoint()!,
          timestamp: Date.now(),
          lastCompletedStep: "music",
          audioSrc,
        });
        setCheckpoint(loadCheckpoint());
        updateStep("music", { status: "done", detail: "Track ready" });
      }

      // ── Step 3: Render ───────────────────────────────────────────────────
      updateStep("render", { status: "running", detail: "Calling Remotion…" });

      const renderRes = await fetch("/api/quotes/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote: currentQuote, author: currentAuthor, style, jobId, audioSrc }),
      });
      const renderData = await renderRes.json();
      if (!renderRes.ok) throw new Error(renderData.error ?? "Render failed");

      updateStep("render", { status: "done", detail: "MP4 ready" });
      updateStep("done", { status: "done" });
      setVideoUrl(renderData.url);
      setPhase("done");
      clearCheckpoint();
      setCheckpoint(null);

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setSteps((prev) =>
        prev.map((s) => (s.status === "running" ? { ...s, status: "error", detail: message } : s))
      );
    }
  }

  // 📘 Retry a specific failed step by clearing its output from the checkpoint
  // and re-running the pipeline from that point.
  function handleRetry(stepId: string) {
    const cp = loadCheckpoint();
    if (!cp) return;

    const trimmed = { ...cp, timestamp: Date.now() };
    if (stepId === "render") {
      // Everything through music/style is valid — just re-run render.
    } else if (stepId === "music") {
      delete trimmed.audioSrc;
      trimmed.lastCompletedStep = "style";
    }
    saveCheckpoint(trimmed);
    setCheckpoint(trimmed);
    handleRender(trimmed);
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
        <div className="flex flex-col gap-5">

          {/* 📘 Resume card — only shown when a recent checkpoint exists. */}
          {checkpoint && (
            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{
                backgroundColor: "rgba(124,58,237,0.08)",
                border: "1px solid var(--color-accent)",
              }}
            >
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                  Resume in-progress job
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                  &ldquo;{checkpoint.quote.slice(0, 60)}{checkpoint.quote.length > 60 ? "…" : ""}&rdquo; · Stopped after: <strong>{checkpoint.lastCompletedStep}</strong> · {timeAgo(checkpoint.timestamp)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRender(checkpoint)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: "var(--color-accent)" }}
                >
                  Resume from {checkpoint.lastCompletedStep === "music" ? "Render" : "Music / Render"}
                </button>
                <button
                  onClick={() => { clearCheckpoint(); setCheckpoint(null); }}
                  className="py-2 px-4 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-muted)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          )}

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

            {/* Music toggle */}
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
              onClick={() => handleRender()}
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
        </div>
      )}

      {/* ── Processing Phase ── */}
      {phase === "processing" && (
        <div className="space-y-6">
          {quoteStyle && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--color-border)" }}
            >
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
                  <div style={{ width: "60px", height: "3px", background: quoteStyle.accentColor, borderRadius: "2px", marginBottom: "24px" }} />
                  <p style={{ color: quoteStyle.textColor, fontSize: "clamp(16px, 3vw, 24px)", fontWeight: 700, fontFamily: "Georgia, serif", lineHeight: 1.4, maxWidth: "80%" }}>
                    &ldquo;{checkpoint?.quote ?? quote}&rdquo;
                  </p>
                  <p style={{ color: quoteStyle.accentColor, fontSize: "clamp(12px, 2vw, 16px)", fontStyle: "italic", marginTop: "20px", fontFamily: "Georgia, serif" }}>
                    — {checkpoint?.author ?? author}
                  </p>
                </div>
              </div>
              <div className="px-4 py-2 text-xs text-center" style={{ background: "var(--color-surface)", color: "var(--color-muted)" }}>
                Color preview · {quoteStyle.animationStyle} · {quoteStyle.durationSeconds}s
              </div>
            </div>
          )}
          <ProgressTracker steps={steps} onRetry={handleRetry} />
        </div>
      )}

      {/* ── Done Phase ── */}
      {phase === "done" && videoUrl && (
        <div className="space-y-6">
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
            <video src={videoUrl} controls playsInline className="w-full" style={{ display: "block" }} />
          </div>
          <div className="flex gap-3">
            <a href={videoUrl} download className="flex-1 py-3 rounded-lg font-semibold text-white text-center" style={{ background: "var(--color-accent)" }}>
              Download MP4
            </a>
            <button onClick={handleReset} className="flex-1 py-3 rounded-lg font-semibold" style={{ background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}>
              Make Another
            </button>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && phase !== "processing" && (
        <div className="rounded-lg px-4 py-3 mt-6 text-sm" style={{ background: "#2d1515", color: "#f87171", border: "1px solid #7f1d1d" }}>
          <p>{error}</p>
          <button onClick={handleReset} className="underline mt-2">Try again</button>
        </div>
      )}
    </main>
  );
}
