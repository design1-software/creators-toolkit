"use client";
// 📘 WHAT THIS FILE DOES: The Short-Form Video Enhancement page.
// Full pipeline: Upload → Analyze → Transcribe → Enhance (Claude) → Render (Remotion)
//
// CHECKPOINT SYSTEM: After each step succeeds, the result is saved to localStorage.
// If the pipeline crashes, the user can resume from the last successful step rather
// than starting over. Checkpoints expire after 1 hour (Railway restarts clear server files).
// 🔗 localStorage: https://www.w3schools.com/jsref/prop_win_localstorage.asp

import { useState, useEffect } from "react";
import Link from "next/link";
import FileUpload from "@/components/FileUpload";
import ProgressTracker, { type Step } from "@/components/ProgressTracker";
import type { WordTimestamp } from "@/lib/whisper";
import type { KenBurnsZone, KineticPhrase, LowerThird, VideoInfo } from "@/lib/types";

// ── Checkpoint types ────────────────────────────────────────────────────────

// 📘 This type holds everything the pipeline has computed so far.
// Each field is optional because the checkpoint is built up step by step —
// after upload we only have jobId/filePath; after enhance we have everything.
type ShortFormCheckpoint = {
  timestamp: number;        // when the checkpoint was last saved (Unix ms)
  lastCompletedStep: "upload" | "analyze" | "transcribe" | "enhance";
  fileName: string;         // shown in the resume card so the user recognizes the job
  // Accumulated after each step:
  jobId: string;
  filePath: string;
  videoInfo?: VideoInfo;
  audioPath?: string;
  words?: WordTimestamp[];
  kenBurnsZones?: KenBurnsZone[];
  kineticPhrases?: KineticPhrase[];
  lowerThirds?: LowerThird[];
  palette?: { from: string; to: string };
  title?: string;
  summary?: string;
  hookStrength?: string;
};

// ── Checkpoint helpers ──────────────────────────────────────────────────────

const CHECKPOINT_KEY = "creators_toolkit_short_form";
// 📘 1 hour — Railway restarts clear the server's file system, so files older
// than this are very likely gone and the checkpoint would fail anyway.
const MAX_AGE_MS = 60 * 60 * 1000;

// 📘 The order of steps — used to decide which steps to mark "done" on resume.
const STEP_ORDER = ["upload", "analyze", "transcribe", "enhance"] as const;
type CompletedStep = typeof STEP_ORDER[number];

function saveCheckpoint(data: ShortFormCheckpoint) {
  try { localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(data)); } catch {}
}

function loadCheckpoint(): ShortFormCheckpoint | null {
  try {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ShortFormCheckpoint;
    // 📘 Discard stale checkpoints — server files won't exist after a Railway restart.
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

// 📘 Returns true if stepId was already completed in the checkpoint.
// Used to pre-mark steps as "done" when resuming.
function isCompleted(stepId: string, lastCompleted: CompletedStep): boolean {
  const lastIdx = STEP_ORDER.indexOf(lastCompleted);
  const stepIdx = STEP_ORDER.indexOf(stepId as CompletedStep);
  return stepIdx !== -1 && stepIdx <= lastIdx;
}

// 📘 Relative time label — e.g. "4 minutes ago" — shown in the resume card.
function timeAgo(timestamp: number): string {
  const mins = Math.floor((Date.now() - timestamp) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  return `${Math.floor(mins / 60)} hour${Math.floor(mins / 60) > 1 ? "s" : ""} ago`;
}

// ── Step definitions ────────────────────────────────────────────────────────

const INITIAL_STEPS: Step[] = [
  { id: "upload",     label: "Upload video",                    status: "pending" },
  { id: "analyze",    label: "Analyze video + normalize audio", status: "pending" },
  { id: "transcribe", label: "Transcribe speech with Whisper",  status: "pending" },
  { id: "enhance",    label: "Claude identifies key moments",   status: "pending" },
  { id: "render",     label: "Remotion renders enhanced MP4",   status: "pending" },
];

// ── Page component ──────────────────────────────────────────────────────────

export default function ShortFormPage() {
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [phase, setPhase] = useState<"upload" | "processing" | "done">("upload");
  const [videoUrl, setVideoUrl] = useState("");
  const [summary, setSummary] = useState("");

  // 📘 checkpoint is loaded from localStorage on mount (client-side only).
  // null means no in-progress job to resume.
  const [checkpoint, setCheckpoint] = useState<ShortFormCheckpoint | null>(null);

  // 📘 useEffect runs once after the component mounts in the browser.
  // We can't read localStorage during server-side rendering, so this is the right place.
  // 🔗 useEffect: https://www.w3schools.com/react/react_useeffect.asp
  useEffect(() => {
    setCheckpoint(loadCheckpoint());
  }, []);

  function updateStep(id: string, status: Step["status"], detail?: string) {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, detail } : s))
    );
  }

  // 📘 Builds the initial steps array for a resume — pre-marks completed steps as "done".
  function buildResumeSteps(cp: ShortFormCheckpoint): Step[] {
    return INITIAL_STEPS.map((s) =>
      isCompleted(s.id, cp.lastCompletedStep)
        ? { ...s, status: "done" as const }
        : s
    );
  }

  // ── Main pipeline ──────────────────────────────────────────────────────────
  // 📘 'file' is null when resuming — the video is already on the server.
  // 'cp' is the saved checkpoint to continue from. If null, start from scratch.
  async function runPipeline(file: File | null, cp?: ShortFormCheckpoint) {
    setPhase("processing");
    setVideoUrl("");
    setSummary("");

    // 📘 Show completed steps as "done" immediately when resuming.
    setSteps(cp ? buildResumeSteps(cp) : INITIAL_STEPS);

    // 📘 Local variables hold data between steps. React state is async — if we
    // called setJobId() and then read jobId on the next line, it would still be "".
    // 🔗 Why local variables: https://www.w3schools.com/react/react_usestate.asp
    let currentJobId       = cp?.jobId       ?? "";
    let currentFilePath    = cp?.filePath     ?? "";
    let currentVideoInfo   = cp?.videoInfo    ?? null;
    let audioPath          = cp?.audioPath    ?? "";
    let transcribedWords   = cp?.words        ?? [];
    let kenBurnsZones      = cp?.kenBurnsZones    ?? [];
    let kineticPhrases     = cp?.kineticPhrases   ?? [];
    let lowerThirds        = cp?.lowerThirds      ?? [];
    let currentPalette     = cp?.palette      ?? { from: "#a855f7", to: "#050008" };
    let currentSummary     = cp?.summary      ?? "";
    let currentHookStrength = cp?.hookStrength ?? "medium";
    let currentTitle       = cp?.title        ?? "";

    // ── Step 1: Upload ──────────────────────────────────────────────────────
    if (!cp?.jobId) {
      updateStep("upload", "running");
      try {
        const form = new FormData();
        form.append("video", file!);
        const res = await fetch("/api/short-form/upload", { method: "POST", body: form });
        const text = await res.text();
        let data: Record<string, string> = {};
        try { data = JSON.parse(text); } catch {}
        if (!res.ok) throw new Error(data.error || `Upload failed (HTTP ${res.status})`);

        currentJobId = data.jobId;
        currentFilePath = data.filePath;

        // 📘 Save checkpoint immediately after each step so a crash in a later step
        // doesn't lose this step's work.
        saveCheckpoint({
          timestamp: Date.now(),
          lastCompletedStep: "upload",
          fileName: data.fileName,
          jobId: currentJobId,
          filePath: currentFilePath,
        });
        setCheckpoint(loadCheckpoint());
        updateStep("upload", "done", `Saved as ${data.fileName}`);
      } catch (err) {
        updateStep("upload", "error", String(err));
        return;
      }
    }

    // ── Step 2: Analyze ─────────────────────────────────────────────────────
    if (!cp?.videoInfo) {
      updateStep("analyze", "running");
      try {
        const res = await fetch("/api/short-form/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath: currentFilePath, jobId: currentJobId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        currentVideoInfo = data.videoInfo;
        audioPath = data.audioPath;

        saveCheckpoint({
          ...loadCheckpoint()!,
          timestamp: Date.now(),
          lastCompletedStep: "analyze",
          videoInfo: currentVideoInfo!,
          audioPath,
        });
        setCheckpoint(loadCheckpoint());
        updateStep("analyze", "done",
          `${data.videoInfo.duration.toFixed(1)}s · ${data.videoInfo.fps}fps · ${data.videoInfo.width}×${data.videoInfo.height}`);
      } catch (err) {
        updateStep("analyze", "error", String(err));
        return;
      }
    }

    // ── Step 3: Transcribe ──────────────────────────────────────────────────
    if (!cp?.words?.length) {
      updateStep("transcribe", "running");
      try {
        const res = await fetch("/api/short-form/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioPath, jobId: currentJobId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        transcribedWords = data.words;

        saveCheckpoint({
          ...loadCheckpoint()!,
          timestamp: Date.now(),
          lastCompletedStep: "transcribe",
          words: transcribedWords,
        });
        setCheckpoint(loadCheckpoint());
        updateStep("transcribe", "done", `${data.wordCount} words transcribed`);
      } catch (err) {
        updateStep("transcribe", "error", String(err));
        return;
      }
    }

    // ── Step 4: Enhance ─────────────────────────────────────────────────────
    if (!cp?.kineticPhrases) {
      updateStep("enhance", "running");
      try {
        const res = await fetch("/api/short-form/enhance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ words: transcribedWords, videoInfo: currentVideoInfo, filePath: currentFilePath }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        kenBurnsZones   = data.kenBurnsZones;
        kineticPhrases  = data.kineticPhrases;
        lowerThirds     = data.lowerThirds || [];
        currentPalette  = data.palette || { from: "#a855f7", to: "#050008" };
        currentSummary  = data.summary || "";
        currentHookStrength = data.hookStrength || "medium";
        currentTitle    = data.title || "";
        setSummary(currentSummary);

        saveCheckpoint({
          ...loadCheckpoint()!,
          timestamp: Date.now(),
          lastCompletedStep: "enhance",
          kenBurnsZones,
          kineticPhrases,
          lowerThirds,
          palette: currentPalette,
          title: currentTitle,
          summary: currentSummary,
          hookStrength: currentHookStrength,
        });
        setCheckpoint(loadCheckpoint());
        updateStep("enhance", "done",
          `${kineticPhrases.length} kinetic · ${kenBurnsZones.length} Ken Burns · ${lowerThirds.length} lower thirds · Hook: ${data.hookStrength}`);
      } catch (err) {
        updateStep("enhance", "error", String(err));
        return;
      }
    }

    // ── Step 5: Render ──────────────────────────────────────────────────────
    // 📘 Render always runs — it's the most likely step to fail and the whole
    // point of the checkpoint system is to avoid re-doing everything before it.
    updateStep("render", "running");
    try {
      const res = await fetch("/api/short-form/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: currentJobId,
          filePath: currentFilePath,
          words: transcribedWords,
          kenBurnsZones,
          kineticPhrases,
          lowerThirds,
          palette: currentPalette,
          videoInfo: currentVideoInfo,
          summary: currentSummary,
          hookStrength: currentHookStrength,
          title: currentTitle,
          audioPath,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setVideoUrl(data.url);
      updateStep("render", "done", `Ready: ${data.fileName}`);
      setPhase("done");
      // 📘 Clear the checkpoint on success — the job is fully complete.
      clearCheckpoint();
      setCheckpoint(null);
    } catch (err) {
      updateStep("render", "error", String(err));
    }
  }

  // 📘 Called by ProgressTracker's Retry button — re-runs from the failed step.
  // We clear the checkpoint data for the failed step and everything after it,
  // then call runPipeline with the trimmed checkpoint so it skips what's already done.
  function handleRetry(stepId: string) {
    const cp = loadCheckpoint();
    if (!cp) return;

    // 📘 Build a trimmed checkpoint that stops just before the failed step.
    // This makes the pipeline re-run from stepId onward.
    const trimmed: ShortFormCheckpoint = { ...cp, timestamp: Date.now() };
    if (stepId === "render") {
      // Everything through enhance is still valid — just re-run render.
      // No trimming needed; runPipeline will skip steps 1-4 automatically.
    } else if (stepId === "enhance") {
      delete trimmed.kineticPhrases;
      delete trimmed.kenBurnsZones;
      delete trimmed.lowerThirds;
      delete trimmed.palette;
      delete trimmed.title;
      delete trimmed.summary;
      delete trimmed.hookStrength;
      trimmed.lastCompletedStep = "transcribe";
    } else if (stepId === "transcribe") {
      delete trimmed.words;
      delete trimmed.kineticPhrases;
      delete trimmed.kenBurnsZones;
      delete trimmed.lowerThirds;
      delete trimmed.palette;
      delete trimmed.title;
      delete trimmed.summary;
      delete trimmed.hookStrength;
      trimmed.lastCompletedStep = "analyze";
    } else if (stepId === "analyze") {
      delete trimmed.videoInfo;
      delete trimmed.audioPath;
      delete trimmed.words;
      delete trimmed.kineticPhrases;
      delete trimmed.kenBurnsZones;
      delete trimmed.lowerThirds;
      delete trimmed.palette;
      delete trimmed.title;
      delete trimmed.summary;
      delete trimmed.hookStrength;
      trimmed.lastCompletedStep = "upload";
    }

    saveCheckpoint(trimmed);
    setCheckpoint(trimmed);
    runPipeline(null, trimmed);
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--color-bg)" }}>

      {/* ── Navigation ── */}
      <nav
        className="flex items-center gap-4 px-6 py-4 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <Link href="/" className="text-sm hover:opacity-70 transition-opacity"
          style={{ color: "var(--color-muted)" }}>
          ← Dashboard
        </Link>
        <span style={{ color: "var(--color-border)" }}>|</span>
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          ⚡ Short-Form Enhancement
        </span>
      </nav>

      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-8 flex flex-col gap-6">

        {/* ── Upload Phase ── */}
        {phase === "upload" && (
          <>
            <div>
              <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
                Enhance your video
              </h1>
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                Upload a video and Claude will add captions, Ken Burns zoom, kinetic text
                pops, and audio normalization — then render a finished MP4.
              </p>
            </div>

            {/* 📘 Resume card — shown when a recent checkpoint exists.
                The user can continue their in-progress job or discard it and start fresh. */}
            {checkpoint && (
              <div
                className="rounded-xl p-4 flex flex-col gap-3"
                style={{
                  backgroundColor: "rgba(124,58,237,0.08)",
                  border: "1px solid var(--color-accent)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                      Resume in-progress job
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                      {checkpoint.fileName} · Stopped after: <strong>{checkpoint.lastCompletedStep}</strong> · {timeAgo(checkpoint.timestamp)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => runPipeline(null, checkpoint)}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
                    style={{ backgroundColor: "var(--color-accent)" }}
                  >
                    Resume from {checkpoint.lastCompletedStep === "enhance" ? "Render" :
                                  checkpoint.lastCompletedStep === "transcribe" ? "Claude Enhance" :
                                  checkpoint.lastCompletedStep === "analyze" ? "Transcribe" : "Analyze"}
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

            <FileUpload onFile={(file) => runPipeline(file)} />

            <div
              className="rounded-xl p-4 text-xs leading-relaxed"
              style={{
                backgroundColor: "rgba(124,58,237,0.06)",
                border: "1px solid rgba(124,58,237,0.2)",
                color: "var(--color-muted)",
              }}
            >
              <strong style={{ color: "var(--color-accent-light)" }}>What happens next:</strong>
              {" "}FFprobe reads your video metadata → FFmpeg extracts and normalizes the audio →
              Whisper transcribes every word with timestamps → Claude identifies the most
              impactful phrases and zoom moments → Remotion renders the finished video.
            </div>
          </>
        )}

        {/* ── Processing + Done Phase ── */}
        {(phase === "processing" || phase === "done") && (
          <>
            <div>
              <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text)" }}>
                {phase === "done" ? "Enhancement complete!" : "Enhancing your video..."}
              </h1>
              {summary && (
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>{summary}</p>
              )}
            </div>

            {/* 📘 Pass handleRetry to ProgressTracker — failed steps will show a Retry button. */}
            <ProgressTracker steps={steps} onRetry={phase === "processing" ? handleRetry : undefined} />

            {phase === "done" && videoUrl && (
              <div className="flex flex-col gap-4">
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
                      setPhase("upload");
                      setSteps(INITIAL_STEPS);
                      setVideoUrl("");
                      setSummary("");
                    }}
                    className="flex-1 py-3 rounded-xl font-semibold"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    Enhance Another
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
