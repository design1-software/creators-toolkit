"use client";
// 📘 WHAT THIS FILE DOES: The Promo Video page — the full 3-phase workflow UI.
// Phase 1: Discovery Chat (conversation with Claude)
// Phase 2: Brief Review (user approves the creative brief)
// Phase 3: Production (real pipeline — parse → voiceover → render)
//
// URL: http://localhost:3000/promo
// 🔗 Next.js pages: https://nextjs.org/docs/app/building-your-application/routing/pages

import { useState, useEffect } from "react";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import ChatInterface from "@/components/ChatInterface";
import BriefDisplay from "@/components/BriefDisplay";
// 📘 ProgressTracker shows each pipeline step with running/done/error states.
import ProgressTracker, { type Step } from "@/components/ProgressTracker";
// 📘 We import Message from lib/claude.ts so ChatInterface and this page
// agree on the same type — including support for attached images (ContentBlock[]).
import type { Message } from "@/lib/claude";

// 📘 'Phase' tracks which step the user is currently on.
// TypeScript union types (the '|') restrict a variable to a fixed set of values.
// 🔗 TypeScript union types: https://www.w3schools.com/typescript/typescript_unions.php
type Phase = "chat" | "brief" | "production" | "done";

// 📘 PromoCheckpoint stores the pipeline state in localStorage so a crashed or
// refreshed session can resume from the last successful step instead of starting over.
// The 1-hour expiry handles Railway server restarts that clear uploaded files.
type PromoCheckpoint = {
  timestamp: number;
  lastCompletedStep?: "parse" | "voiceover" | "image" | "music";
  brief: string;
  jobId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  production?: Record<string, any>;
  voiceSrc?: string;
  backgroundImageSrc?: string;
  finalAudioSrc?: string;
  // 📘 Paths (relative to Remotion public/) of images the user uploaded during chat.
  // When present, the image step uses these directly and skips Kie.ai entirely.
  uploadedImages?: string[];
};

const CHECKPOINT_KEY = "creators_toolkit_promo";
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour — matches Railway's filesystem lifetime

// 📘 Step order used to compare checkpoint progress.
const STEP_ORDER = ["parse", "voiceover", "image", "music"] as const;
type CheckpointStep = (typeof STEP_ORDER)[number];

// 📘 Returns true if 'step' has already been completed according to the checkpoint.
function isCompleted(last: CheckpointStep | undefined, step: CheckpointStep): boolean {
  if (!last) return false;
  return STEP_ORDER.indexOf(last) >= STEP_ORDER.indexOf(step);
}

function saveCheckpoint(cp: PromoCheckpoint): void {
  try {
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(cp));
  } catch { /* localStorage may be unavailable in some environments */ }
}

function loadCheckpoint(): PromoCheckpoint | null {
  try {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return null;
    const cp = JSON.parse(raw) as PromoCheckpoint;
    if (Date.now() - cp.timestamp > MAX_AGE_MS) {
      localStorage.removeItem(CHECKPOINT_KEY);
      return null;
    }
    return cp;
  } catch {
    return null;
  }
}

function clearCheckpoint(): void {
  try {
    localStorage.removeItem(CHECKPOINT_KEY);
  } catch { /* localStorage may be unavailable */ }
}

// 📘 Returns a human-readable relative time string, e.g. "3 mins ago".
function timeAgo(ms: number): string {
  const mins = Math.floor((Date.now() - ms) / 60_000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  return `${mins} mins ago`;
}

// 📘 The full production pipeline — 6 steps, all starting as "pending".
// Image and music steps are non-fatal: if they fail the pipeline continues
// with a gradient background / voiceover-only audio as fallbacks.
const INITIAL_STEPS: Step[] = [
  { id: "parse",     label: "Parse brief → extract production data",    status: "pending" },
  { id: "voiceover", label: "Generate voiceover via ElevenLabs",         status: "pending" },
  { id: "image",     label: "Generate background image via Kie.ai",     status: "pending" },
  { id: "music",     label: "Generate & mix background music via Suno",  status: "pending" },
  { id: "render",    label: "Render video in Remotion",                  status: "pending" },
  { id: "done",      label: "Your video is ready",                       status: "pending" },
];

// 📘 Builds the steps array for a resume — marking already-completed steps as "done".
function buildResumeSteps(cp: PromoCheckpoint): Step[] {
  if (!cp.lastCompletedStep) return [...INITIAL_STEPS];
  const completedIndex = STEP_ORDER.indexOf(cp.lastCompletedStep);
  return INITIAL_STEPS.map((s) => {
    const idx = STEP_ORDER.indexOf(s.id as CheckpointStep);
    if (idx !== -1 && idx <= completedIndex) return { ...s, status: "done" as const };
    return s;
  });
}

export default function PromoPage() {
  // 📘 'phase' controls what's visible — chat, brief review, production, or done.
  const [phase, setPhase] = useState<Phase>("chat");
  const [brief, setBrief] = useState("");
  const [generatingBrief, setGeneratingBrief] = useState(false);

  // 📘 'steps' drives the ProgressTracker — we update each step as the pipeline runs.
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);

  // 📘 'videoUrl' holds the path to the finished MP4 once Remotion is done.
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 📘 Images the user uploaded during the discovery chat, saved server-side by /api/brief.
  // Stored as paths relative to Remotion's public/ folder (e.g. "renders/promo/upload-abc.jpg").
  // When non-empty, the image step uses these directly and skips Kie.ai.
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  // 📘 Persisted checkpoint — null means no in-progress session to resume.
  const [checkpoint, setCheckpoint] = useState<PromoCheckpoint | null>(null);

  // 📘 useEffect runs only in the browser (not during server-side rendering).
  // This is where we safely access localStorage to restore any saved checkpoint.
  // 🔗 React useEffect: https://www.w3schools.com/react/react_useeffect.asp
  useEffect(() => {
    const cp = loadCheckpoint();
    if (cp) setCheckpoint(cp);
  }, []);

  // 📘 Helper — updates a single step without touching the others.
  // 'Partial<Step>' means we only need to pass the fields we're changing.
  // 🔗 JavaScript spread operator: https://www.w3schools.com/js/js_es6.asp
  function updateStep(id: string, update: Partial<Step>) {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...update } : s))
    );
  }

  // 📘 Called when the chat component signals the brief is ready to generate.
  async function handleBriefReady(_chatMessages: Message[]) {
    setPhase("brief");
    setGeneratingBrief(true);

    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: _chatMessages }),
      });

      const data = await res.json();
      setBrief(data.brief || "Brief generation failed — please try again.");
      // 📘 Save the paths of any images the user uploaded during chat.
      // /api/brief already wrote them to the Remotion public/ folder — we just store the paths.
      if (Array.isArray(data.uploadedImages)) setUploadedImages(data.uploadedImages);
    } catch (err) {
      console.error("Brief generation error:", err);
      setBrief("Error generating brief. Check your connection and API key.");
    } finally {
      setGeneratingBrief(false);
    }
  }

  // 📘 Called when the user clicks "Approve" or resumes from a checkpoint.
  // An optional checkpoint lets the function skip steps that already succeeded.
  // 🔗 async/await: https://www.w3schools.com/js/js_async.asp
  async function handleApprove(cp?: PromoCheckpoint) {
    setPhase("production");
    setError(null);
    setVideoUrl(null);

    // 📘 Use data from the checkpoint if resuming, otherwise start fresh.
    const jobId = cp?.jobId ?? uuidv4();
    const currentBrief = cp?.brief ?? brief;

    let production = cp?.production;
    let voiceSrc = cp?.voiceSrc;
    let backgroundImageSrc = cp?.backgroundImageSrc;
    let finalAudioSrc = cp?.finalAudioSrc;
    // 📘 Use uploaded images from the checkpoint (resume) or from state (fresh run).
    const currentImages = cp?.uploadedImages ?? uploadedImages;

    setSteps(cp ? buildResumeSteps(cp) : INITIAL_STEPS);

    try {
      // ── Step 1: Parse the brief ──
      if (!isCompleted(cp?.lastCompletedStep, "parse")) {
        updateStep("parse", { status: "running" });

        const parseRes = await fetch("/api/promo/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief: currentBrief }),
        });

        const parseData = await parseRes.json();
        if (!parseRes.ok) throw new Error(parseData.error ?? "Brief parsing failed");

        production = parseData.production;
        updateStep("parse", {
          status: "done",
          detail: `${production!.brandName} · ${production!.durationSeconds}s script`,
        });

        const saved: PromoCheckpoint = {
          timestamp: Date.now(), lastCompletedStep: "parse",
          brief: currentBrief, jobId, production, uploadedImages: currentImages,
        };
        saveCheckpoint(saved);
        setCheckpoint(saved);
      }

      // ── Step 2: Generate voiceover ──
      if (!isCompleted(cp?.lastCompletedStep, "voiceover")) {
        updateStep("voiceover", { status: "running", detail: "Sending to ElevenLabs…" });

        const voRes = await fetch("/api/promo/voiceover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: production!.script, jobId }),
        });

        const voData = await voRes.json();
        if (!voRes.ok) throw new Error(voData.error ?? "Voiceover generation failed");

        voiceSrc = voData.voiceSrc;
        finalAudioSrc = voiceSrc; // default: voiceover only, until music is mixed in
        updateStep("voiceover", { status: "done", detail: "MP3 saved" });

        const saved: PromoCheckpoint = {
          timestamp: Date.now(), lastCompletedStep: "voiceover",
          brief: currentBrief, jobId, production, voiceSrc, uploadedImages: currentImages,
        };
        saveCheckpoint(saved);
        setCheckpoint(saved);
      } else {
        finalAudioSrc = voiceSrc; // carry forward from checkpoint before music step
      }

      // ── Step 3: Background image ──
      // 📘 If the user uploaded images during chat we use the first one directly —
      // no AI generation needed and no network call to Kie.ai.
      // If there are no uploaded images we fall back to Kie.ai (non-fatal: on failure
      // the pipeline continues and Remotion uses a CSS gradient background instead).
      if (!isCompleted(cp?.lastCompletedStep, "image")) {
        if (currentImages.length > 0) {
          backgroundImageSrc = currentImages[0];
          updateStep("image", { status: "done", detail: "Using your uploaded image" });
        } else {
          updateStep("image", { status: "running", detail: "Submitting to Kie.ai…" });
          try {
            const imgRes = await fetch("/api/promo/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jobId, imagePrompt: production!.imagePrompt }),
            });
            const imgData = await imgRes.json();
            if (!imgRes.ok) throw new Error(imgData.error ?? "Image generation failed");
            backgroundImageSrc = imgData.imageSrc;
            updateStep("image", { status: "done", detail: "Background image ready" });
          } catch (imgErr) {
            // Non-fatal — log and continue; renderer will use gradient background
            updateStep("image", {
              status: "error",
              detail: `Skipped — using gradient (${imgErr instanceof Error ? imgErr.message : "error"})`,
            });
          }
        }

        const saved: PromoCheckpoint = {
          timestamp: Date.now(), lastCompletedStep: "image",
          brief: currentBrief, jobId, production, voiceSrc, backgroundImageSrc,
          finalAudioSrc, uploadedImages: currentImages,
        };
        saveCheckpoint(saved);
        setCheckpoint(saved);
      }

      // ── Step 4: Generate & mix background music via Suno (non-fatal) ──
      // 📘 Also non-fatal — if music fails we render with voiceover-only audio.
      if (!isCompleted(cp?.lastCompletedStep, "music")) {
        updateStep("music", { status: "running", detail: "Submitting to Suno…" });
        try {
          const musicRes = await fetch("/api/promo/music", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId, voiceSrc, musicPrompt: production!.musicPrompt }),
          });
          const musicData = await musicRes.json();
          if (!musicRes.ok) throw new Error(musicData.error ?? "Music generation failed");
          finalAudioSrc = musicData.mixedAudioSrc;
          updateStep("music", { status: "done", detail: "Music mixed with voiceover" });
        } catch (musicErr) {
          // Non-fatal — log and continue; renderer will use voiceover-only audio
          updateStep("music", {
            status: "error",
            detail: `Skipped — voiceover only (${musicErr instanceof Error ? musicErr.message : "error"})`,
          });
        }

        const saved: PromoCheckpoint = {
          timestamp: Date.now(), lastCompletedStep: "music",
          brief: currentBrief, jobId, production, voiceSrc, backgroundImageSrc,
          finalAudioSrc, uploadedImages: currentImages,
        };
        saveCheckpoint(saved);
        setCheckpoint(saved);
      }

      // ── Step 5: Render in Remotion ──
      updateStep("render", { status: "running", detail: "Rendering video… (this takes 1–5 min)" });

      const renderRes = await fetch("/api/promo/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, production, voiceSrc: finalAudioSrc, backgroundImageSrc }),
      });

      const renderData = await renderRes.json();
      if (!renderRes.ok) throw new Error(renderData.error ?? "Render failed");

      updateStep("render", { status: "done", detail: "MP4 ready" });
      updateStep("done", { status: "done" });

      setVideoUrl(renderData.url);
      setPhase("done");
      // 📘 Pipeline complete — clear checkpoint so no stale resume card appears next visit.
      clearCheckpoint();
      setCheckpoint(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      // 📘 Mark the currently-running step as errored so the tracker shows it in red.
      setSteps((prev) =>
        prev.map((s) =>
          s.status === "running" ? { ...s, status: "error", detail: message } : s
        )
      );
    }
  }

  // 📘 Step-level retry — trims the checkpoint back to just before the failed step
  // so the pipeline re-runs only the failed step and everything after it.
  function handleRetry(stepId: string) {
    if (!checkpoint) return;

    const trimmed: PromoCheckpoint = { ...checkpoint, timestamp: Date.now() };

    // 📘 Remove data for the retried step and all steps that came after it.
    // The pipeline will re-fetch that data on the next run.
    switch (stepId) {
      case "parse":
        trimmed.lastCompletedStep = undefined;
        delete trimmed.production;
        delete trimmed.voiceSrc;
        delete trimmed.backgroundImageSrc;
        delete trimmed.finalAudioSrc;
        break;
      case "voiceover":
        trimmed.lastCompletedStep = "parse";
        delete trimmed.voiceSrc;
        delete trimmed.backgroundImageSrc;
        delete trimmed.finalAudioSrc;
        break;
      case "image":
        trimmed.lastCompletedStep = "voiceover";
        delete trimmed.backgroundImageSrc;
        delete trimmed.finalAudioSrc;
        break;
      case "music":
        trimmed.lastCompletedStep = "image";
        delete trimmed.finalAudioSrc;
        break;
      case "render":
        trimmed.lastCompletedStep = "music";
        break;
      default:
        return;
    }

    saveCheckpoint(trimmed);
    setCheckpoint(trimmed);
    handleApprove(trimmed);
  }

  function handleRevise() {
    setPhase("chat");
    setBrief("");
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--color-bg)" }}>

      {/* ── Top Navigation Bar ── */}
      <nav
        className="flex items-center gap-4 px-6 py-4 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <Link
          href="/"
          className="text-sm hover:opacity-70 transition-opacity"
          style={{ color: "var(--color-muted)" }}
        >
          ← Dashboard
        </Link>
        <span style={{ color: "var(--color-border)" }}>|</span>
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          🎬 Promo Video
        </span>

        {/* Phase indicator pills */}
        <div className="ml-auto flex items-center gap-2 text-xs" style={{ color: "var(--color-muted)" }}>
          {(["chat", "brief", "production"] as Phase[]).map((p, i) => (
            <span key={p} className="flex items-center gap-1">
              {i > 0 && <span>→</span>}
              <span
                className="px-2 py-1 rounded-full"
                style={{
                  backgroundColor:
                    phase === p || (phase === "done" && p === "production")
                      ? "var(--color-accent)"
                      : "transparent",
                  color:
                    phase === p || (phase === "done" && p === "production")
                      ? "white"
                      : "var(--color-muted)",
                }}
              >
                {i + 1}. {p.charAt(0).toUpperCase() + p.slice(1)}
              </span>
            </span>
          ))}
        </div>
      </nav>

      {/* ── Main Content Area ── */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 flex flex-col gap-6">

        {/* ── Phase 1: Discovery Chat ── */}
        {phase === "chat" && (
          <>
            {/* 📘 Resume card — shown when a previous session was interrupted mid-pipeline.
                The user can jump straight back into production without redoing the chat. */}
            {checkpoint && (
              <div
                className="rounded-xl p-4 flex items-center justify-between gap-4"
                style={{
                  backgroundColor: "rgba(124,58,237,0.08)",
                  border: "1px solid var(--color-accent)",
                }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                    Resume previous session?
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                    Last step: {checkpoint.lastCompletedStep ?? "not started"} · {timeAgo(checkpoint.timestamp)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(checkpoint)}
                    className="text-xs px-4 py-2 rounded-lg font-semibold text-white"
                    style={{ backgroundColor: "var(--color-accent)" }}
                  >
                    Resume
                  </button>
                  <button
                    onClick={() => { clearCheckpoint(); setCheckpoint(null); }}
                    className="text-xs px-4 py-2 rounded-lg font-medium"
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
              className="flex-1 rounded-2xl overflow-hidden flex flex-col"
              style={{
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                minHeight: "600px",
              }}
            >
              <div className="px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
                <h1 className="font-semibold" style={{ color: "var(--color-text)" }}>
                  Phase 1 — Discovery
                </h1>
                <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
                  Answer Claude&apos;s questions. When it has enough, it&apos;ll offer to build your brief.
                </p>
              </div>
              <ChatInterface onBriefReady={handleBriefReady} />
            </div>
          </>
        )}

        {/* ── Phase 2: Brief Review ── */}
        {phase === "brief" && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
                Phase 2 — Creative Brief
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
                Review before we build anything. Approve to start production or revise to go back.
              </p>
            </div>

            {generatingBrief ? (
              <div
                className="rounded-2xl p-8 text-center text-sm"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-muted)",
                }}
              >
                Compiling your creative brief…
              </div>
            ) : (
              <BriefDisplay
                brief={brief}
                onApprove={handleApprove}
                onRevise={handleRevise}
              />
            )}
          </div>
        )}

        {/* ── Phase 3: Production ── */}
        {(phase === "production" || phase === "done") && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
                Phase 3 — Production
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
                {phase === "done"
                  ? "Your video is ready to download."
                  : "Running the production pipeline — each step appears as it completes."}
              </p>
            </div>

            {/* 📘 ProgressTracker shows real-time step status.
                onRetry lets the user re-run just the failed step without starting over. */}
            <ProgressTracker steps={steps} onRetry={handleRetry} />

            {/* ── Error message ── */}
            {error && (
              <div
                className="rounded-lg px-4 py-3 text-sm"
                style={{ background: "#2d1515", color: "#f87171", border: "1px solid #7f1d1d" }}
              >
                {error}
              </div>
            )}

            {/* ── Video player + download — shown when render is complete ── */}
            {phase === "done" && videoUrl && (
              <div className="flex flex-col gap-4">
                {/* 📘 <video> is the HTML5 element for playing video files in the browser.
                    'controls' adds the play/pause/volume bar. 'playsInline' prevents iOS fullscreen.
                    🔗 HTML5 video: https://www.w3schools.com/html/html5_video.asp */}
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  className="w-full rounded-xl"
                  style={{ border: "1px solid var(--color-border)" }}
                />
                <div className="flex gap-3">
                  <a
                    href={videoUrl}
                    download
                    className="flex-1 py-3 rounded-xl font-semibold text-white text-center"
                    style={{ backgroundColor: "var(--color-accent)" }}
                  >
                    Download MP4
                  </a>
                  <button
                    onClick={() => {
                      setPhase("chat");
                      setBrief("");
                      setVideoUrl(null);
                      setSteps(INITIAL_STEPS);
                      clearCheckpoint();
                      setCheckpoint(null);
                    }}
                    className="flex-1 py-3 rounded-xl font-semibold"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    Make Another
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
