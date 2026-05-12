"use client";
// 📘 WHAT THIS FILE DOES: The Promo Video page — the full 3-phase workflow UI.
// Phase 1: Discovery Chat (conversation with Claude)
// Phase 2: Brief Review (user approves the creative brief)
// Phase 3: Production (real pipeline — parse → voiceover → render)
//
// URL: http://localhost:3000/promo
// 🔗 Next.js pages: https://nextjs.org/docs/app/building-your-application/routing/pages

import { useState } from "react";
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

// 📘 The full production pipeline — 6 steps, all starting as "pending".
// Image and music steps are marked as non-fatal: if they fail, the pipeline
// continues with gradient background and voiceover-only audio as fallbacks.
const INITIAL_STEPS: Step[] = [
  { id: "parse",     label: "Parse brief → extract production data",   status: "pending" },
  { id: "voiceover", label: "Generate voiceover via ElevenLabs",        status: "pending" },
  { id: "image",     label: "Generate background image via Kie.ai",    status: "pending" },
  { id: "music",     label: "Generate & mix background music via Suno", status: "pending" },
  { id: "render",    label: "Render video in Remotion",                 status: "pending" },
  { id: "done",      label: "Your video is ready",                      status: "pending" },
];

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
    } catch (err) {
      console.error("Brief generation error:", err);
      setBrief("Error generating brief. Check your connection and API key.");
    } finally {
      setGeneratingBrief(false);
    }
  }

  // 📘 Called when the user clicks "Approve" — kicks off the real production pipeline.
  // Each step calls an API route, updates the tracker, then passes data to the next step.
  // 🔗 async/await: https://www.w3schools.com/js/js_async.asp
  async function handleApprove() {
    setPhase("production");
    setSteps(INITIAL_STEPS);
    setError(null);
    setVideoUrl(null);

    // 📘 Generate a unique ID for this job — used to name the output files.
    // uuidv4() creates a string like "550e8400-e29b-41d4-a716-446655440000".
    const jobId = uuidv4();

    try {
      // ── Step 1: Parse the brief ──
      updateStep("parse", { status: "running" });

      const parseRes = await fetch("/api/promo/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });

      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error ?? "Brief parsing failed");

      const production = parseData.production;
      updateStep("parse", {
        status: "done",
        detail: `${production.brandName} · ${production.durationSeconds}s script`,
      });

      // ── Step 2: Generate voiceover ──
      updateStep("voiceover", { status: "running", detail: "Sending to ElevenLabs…" });

      const voRes = await fetch("/api/promo/voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: production.script, jobId }),
      });

      const voData = await voRes.json();
      if (!voRes.ok) throw new Error(voData.error ?? "Voiceover generation failed");

      updateStep("voiceover", { status: "done", detail: "MP3 saved" });

      // ── Step 3: Generate background image via Kie.ai ──
      // 📘 This step is non-fatal — if it fails we fall back to a CSS gradient background.
      updateStep("image", { status: "running", detail: "Submitting to Kie.ai…" });
      let backgroundImageSrc: string | undefined;
      try {
        const imgRes = await fetch("/api/promo/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, imagePrompt: production.imagePrompt }),
        });
        const imgData = await imgRes.json();
        if (!imgRes.ok) throw new Error(imgData.error ?? "Image generation failed");
        backgroundImageSrc = imgData.imageSrc;
        updateStep("image", { status: "done", detail: "Background image ready" });
      } catch (imgErr) {
        // Non-fatal — log the error but continue with gradient fallback
        updateStep("image", {
          status: "error",
          detail: `Skipped — using gradient (${imgErr instanceof Error ? imgErr.message : "error"})`,
        });
      }

      // ── Step 4: Generate & mix background music via Suno ──
      // 📘 Also non-fatal — if music fails we render with voiceover-only audio.
      updateStep("music", { status: "running", detail: "Submitting to Suno…" });
      let finalAudioSrc = voData.voiceSrc; // default: voiceover only
      try {
        const musicRes = await fetch("/api/promo/music", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            voiceSrc: voData.voiceSrc,
            musicPrompt: production.musicPrompt,
          }),
        });
        const musicData = await musicRes.json();
        if (!musicRes.ok) throw new Error(musicData.error ?? "Music generation failed");
        finalAudioSrc = musicData.mixedAudioSrc;
        updateStep("music", { status: "done", detail: "Music mixed with voiceover" });
      } catch (musicErr) {
        updateStep("music", {
          status: "error",
          detail: `Skipped — voiceover only (${musicErr instanceof Error ? musicErr.message : "error"})`,
        });
      }

      // ── Step 5: Render in Remotion ──
      updateStep("render", { status: "running", detail: "Rendering video… (this takes 1–5 min)" });

      const renderRes = await fetch("/api/promo/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          production,
          voiceSrc: finalAudioSrc,
          backgroundImageSrc,
        }),
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
      // 📘 Mark the currently-running step as errored so the tracker shows it in red.
      setSteps((prev) =>
        prev.map((s) =>
          s.status === "running" ? { ...s, status: "error", detail: message } : s
        )
      );
    }
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
                Answer Claude's questions. When it has enough, it'll offer to build your brief.
              </p>
            </div>
            <ChatInterface onBriefReady={handleBriefReady} />
          </div>
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

            {/* 📘 ProgressTracker shows real-time step status from the pipeline. */}
            <ProgressTracker steps={steps} />

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
