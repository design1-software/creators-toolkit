"use client";
// 📘 WHAT THIS FILE DOES: The Short-Form Video Enhancement page.
// The full pipeline runs here, step by step:
//   1. User uploads a video
//   2. FFprobe analyzes it + FFmpeg extracts and normalizes audio
//   3. Whisper transcribes the audio to word-level timestamps
//   4. Claude reads the transcript and identifies kinetic moments + Ken Burns zones
//   5. Remotion renders the enhanced MP4
//   6. User downloads the finished video
// URL: http://localhost:3000/short-form
// 🔗 React state: https://www.w3schools.com/react/react_usestate.asp

import { useState } from "react";
import Link from "next/link";
import FileUpload from "@/components/FileUpload";
import ProgressTracker, { type Step } from "@/components/ProgressTracker";
import type { WordTimestamp } from "@/lib/whisper";
import type { KenBurnsZone, KineticPhrase, VideoInfo } from "@/lib/types";

// 📘 Define the initial steps for the progress tracker.
// All start as "pending" — we update them one by one as each step runs.
const INITIAL_STEPS: Step[] = [
  { id: "upload",     label: "Upload video",                       status: "pending" },
  { id: "analyze",    label: "Analyze video + normalize audio",    status: "pending" },
  { id: "transcribe", label: "Transcribe speech with Whisper",     status: "pending" },
  { id: "enhance",    label: "Claude identifies key moments",      status: "pending" },
  { id: "render",     label: "Remotion renders enhanced MP4",      status: "pending" },
];

export default function ShortFormPage() {
  // 📘 'steps' drives the ProgressTracker UI — we clone and update it as each step runs.
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);

  // 📘 'phase' controls what the user sees: the uploader or the progress tracker.
  const [phase, setPhase] = useState<"upload" | "processing" | "done">("upload");

  // 📘 These store results that get passed forward to the next step in the pipeline.
  const [jobId, setJobId] = useState("");
  const [filePath, setFilePath] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [words, setWords] = useState<WordTimestamp[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [summary, setSummary] = useState("");
  // 📘 hookStrength is returned by Claude in the enhance step ("strong"|"medium"|"weak").
  // We store it in state so the UI can react to it, and in a local variable so it can
  // be forwarded to the render step without React's async state batching causing a stale read.
  const [hookStrength, setHookStrength] = useState("");

  // 📘 A helper that updates one step's status and optional detail text.
  // We use the "functional update" form of setSteps to always work with the latest state.
  function updateStep(id: string, status: Step["status"], detail?: string) {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, detail } : s))
      // ↑ .map() returns a new array. For the matching step, spread the old values
      //   and override status + detail. For all others, return them unchanged.
    );
  }

  // 📘 The main pipeline function — runs all 5 steps in sequence.
  // 'async' because each step calls an API route and must wait for the response.
  // 🔗 Async/await: https://www.w3schools.com/js/js_async.asp
  async function runPipeline(file: File) {
    setPhase("processing");

    // 📘 WHY local variables instead of React state for pipeline data:
    // React state updates (setJobId, setFilePath, etc.) are asynchronous — they schedule
    // a re-render but do NOT update the variable inside this running function.
    // If we read `jobId` or `filePath` (the state variables) in step 2, they are still ""
    // because the re-render from step 1 hasn't happened yet.
    // Storing values in local variables is the correct pattern for passing data
    // between steps inside a single async function.
    // 🔗 React state batching: https://www.w3schools.com/react/react_hooks.asp
    let currentJobId = "";
    let currentFilePath = "";
    let currentVideoInfo: VideoInfo | null = null;
    // 📘 Local copies of Claude's analysis results — React state updates are async,
    // so reading the state variables after setSummary/setHookStrength inside this
    // function would still return the old values. Local variables update immediately.
    let currentSummary = "";
    let currentHookStrength = "";
    let currentTitle = "";

    // ── Step 1: Upload ────────────────────────────────────────────────────────
    updateStep("upload", "running");
    try {
      // 📘 FormData is the browser's way to send files in an HTTP request.
      // We append the file under the key "video" — matching what the route expects.
      const form = new FormData();
      form.append("video", file);

      const res = await fetch("/api/short-form/upload", { method: "POST", body: form });

      // 📘 Parse the JSON body safely — if the server returns a non-JSON error
      // (e.g. a framework-level 400 before our handler runs), res.json() throws.
      // We read as text first so we always get a readable error message.
      // 🔗 fetch API: https://www.w3schools.com/js/js_api_fetch.asp
      const text = await res.text();
      let data: Record<string, string> = {};
      try { data = JSON.parse(text); } catch { /* non-JSON body — data stays empty */ }

      if (!res.ok) throw new Error(data.error || `Upload failed (HTTP ${res.status})`);

      // 📘 Save to local variables for use in later steps, AND to React state for the UI.
      currentJobId = data.jobId;
      currentFilePath = data.filePath;
      setJobId(data.jobId);
      setFilePath(data.filePath);
      updateStep("upload", "done", `Saved as ${data.fileName}`);
    } catch (err) {
      updateStep("upload", "error", String(err));
      return; // stop the pipeline on any error
    }

    // ── Step 2: Analyze ───────────────────────────────────────────────────────
    updateStep("analyze", "running");
    let audioPath = "";
    try {
      const analyzeRes = await fetch("/api/short-form/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: currentFilePath, jobId: currentJobId }),
      });
      const data = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(data.error);

      // 📘 Save videoInfo to a local variable for later steps, and to state for the UI.
      currentVideoInfo = data.videoInfo;
      setVideoInfo(data.videoInfo);
      audioPath = data.audioPath;
      updateStep("analyze", "done", `${data.videoInfo.duration.toFixed(1)}s · ${data.videoInfo.fps}fps · ${data.videoInfo.width}×${data.videoInfo.height}`);
    } catch (err) {
      updateStep("analyze", "error", String(err));
      return;
    }

    // ── Step 3: Transcribe ────────────────────────────────────────────────────
    updateStep("transcribe", "running");
    let transcribedWords: WordTimestamp[] = [];
    try {
      const res = await fetch("/api/short-form/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioPath, jobId: currentJobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      transcribedWords = data.words;
      setWords(data.words);
      updateStep("transcribe", "done", `${data.wordCount} words transcribed`);
    } catch (err) {
      updateStep("transcribe", "error", String(err));
      return;
    }

    // ── Step 4: Enhance (Claude analysis) ────────────────────────────────────
    updateStep("enhance", "running");
    let kenBurnsZones: KenBurnsZone[] = [];
    let kineticPhrases: KineticPhrase[] = [];
    try {
      const res = await fetch("/api/short-form/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: transcribedWords, videoInfo: currentVideoInfo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      kenBurnsZones = data.kenBurnsZones;
      kineticPhrases = data.kineticPhrases;
      currentSummary = data.summary || "";
      currentHookStrength = data.hookStrength || "medium";
      currentTitle = data.title || "";
      setSummary(currentSummary);
      setHookStrength(currentHookStrength);
      updateStep("enhance", "done", `${kineticPhrases.length} kinetic phrases · ${kenBurnsZones.length} Ken Burns zones · Hook: ${data.hookStrength}`);
    } catch (err) {
      updateStep("enhance", "error", String(err));
      return;
    }

    // ── Step 5: Render ────────────────────────────────────────────────────────
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
          videoInfo: currentVideoInfo,
          // 📘 Pass Claude's analysis forward so Remotion can render the intro title card.
          summary: currentSummary,
          hookStrength: currentHookStrength,
          title: currentTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setVideoUrl(data.url);
      updateStep("render", "done", `Ready: ${data.fileName}`);
      setPhase("done");
    } catch (err) {
      updateStep("render", "error", String(err));
    }
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

      {/* ── Page Content ── */}
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

            {/* 📘 FileUpload component handles drag-and-drop — calls runPipeline when a file is chosen. */}
            <FileUpload onFile={runPipeline} />

            {/* Teaching note */}
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
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  {summary}
                </p>
              )}
            </div>

            {/* 📘 ProgressTracker shows each pipeline step and its live status. */}
            <ProgressTracker steps={steps} />

            {/* Video player + download — shown when render is complete */}
            {phase === "done" && videoUrl && (
              <div className="flex flex-col gap-4">
                {/* 📘 <video> is the HTML5 element for playing video in the browser.
                    'controls' shows the play/pause/volume bar.
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
                  {/* 📘 Reset button returns the user to the upload screen for another video. */}
                  <button
                    onClick={() => { setPhase("upload"); setSteps(INITIAL_STEPS); setVideoUrl(""); setSummary(""); }}
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
