// 📘 WHAT THIS FILE DOES: The main Remotion composition for short-form video enhancement.
// It renders two sequences back-to-back using Remotion's Series component:
//   1. IntroCard  — 3-second animated title card built from Claude's summary analysis
//   2. Main video — Ken Burns zoom + AnimatedCaptions + kinetic text pops + branding
//
// 📘 WHY Series?  Remotion's <Series> component resets useCurrentFrame() to 0 at the
// start of each <Series.Sequence>. This means all kenBurnsZones and kineticPhrases
// frame numbers (which are relative to the video start) stay correct without any math.
// 🔗 Remotion Series: https://www.remotion.dev/docs/series

import React from "react";
import {
  AbsoluteFill,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  spring,
  Series,
} from "remotion";
import { AnimatedCaptions, type WordTimestamp } from "./AnimatedCaptions";

// 📘 A KenBurnsZone defines one zoom effect — when it starts/ends, scale, and focal point.
export type KenBurnsZone = {
  startFrame: number;
  endFrame: number;
  scale: number;  // 1.0 = no zoom, 1.15 = 15% zoom in
  x: number;     // focal point: 0=left, 0.5=centre, 1=right
  y: number;     // focal point: 0=top,  0.5=centre, 1=bottom
};

// 📘 A KineticPhrase is a high-impact phrase that fills the screen for emphasis.
export type KineticPhrase = {
  text: string;
  startFrame: number;
  durationFrames: number;
};

// 📘 All props the composition accepts — passed in from the render command via --props.
export type CaptionedVideoProps = {
  videoSrc: string;
  words: WordTimestamp[];
  kenBurnsZones: KenBurnsZone[];
  kineticPhrases: KineticPhrase[];
  summary: string;       // Claude's one-sentence description of the video
  hookStrength: string;  // "strong" | "medium" | "weak"
  introFrames: number;   // how many frames the intro card occupies (default 90 = 3s)
};

// ─────────────────────────────────────────────────────────────────────────────
// IntroCard — 3-second animated title card shown before the main footage
// ─────────────────────────────────────────────────────────────────────────────

// 📘 This is a separate React component used only inside <Series.Sequence>.
// Keeping it separate makes CaptionedVideo easier to read and the intro easy to change.
const IntroCard: React.FC<{
  summary: string;
  hookStrength: string;
  introFrames: number;
}> = ({ summary, hookStrength, introFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 📘 Fade the entire card in over 12 frames (0.4s) and out over 12 frames at the end.
  // interpolate() maps frame ranges to output values, like a keyframe timeline.
  // 🔗 interpolate: https://www.remotion.dev/docs/interpolate
  const opacity = interpolate(
    frame,
    [0, 12, introFrames - 12, introFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // 📘 spring() animates the title text scaling up from 0.88 → 1 with a slight bounce.
  // 'from' and 'to' set the start and end values; damping/stiffness control the feel.
  const titleScale = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 140 },
    from: 0.88,
    to: 1,
  });

  // 📘 The "STRONG HOOK" badge springs in 8 frames after the title starts.
  // Math.max(0, frame - 8) delays the animation start by 8 frames.
  const badgeScale = hookStrength === "strong"
    ? spring({
        frame: Math.max(0, frame - 8),
        fps,
        config: { damping: 12, stiffness: 220 },
        from: 0,
        to: 1,
      })
    : 0;

  // 📘 Pick a font size that fits the summary text within the 1080px frame width.
  // Shorter summaries can afford larger text; longer ones need to shrink.
  const summaryFontSize =
    summary.length < 40 ? 72
    : summary.length < 70 ? 56
    : 44;

  return (
    <AbsoluteFill
      style={{
        // 📘 A subtle purple-tinted gradient gives the intro a premium, cinematic feel.
        background: "linear-gradient(160deg, #0a0a0f 0%, #1a0830 50%, #0a0a0f 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        opacity,
      }}
    >
      {/* ── Branding label (top-centre) ── */}
      {/* 📘 Small, muted "CREATORS TOOLKIT" serves as a brand watermark on the intro.
          letterSpacing: "0.25em" spreads the letters for a logo-like appearance. */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 26,
          fontFamily: "'Arial', sans-serif",
          fontWeight: 600,
          color: "rgba(255,255,255,0.35)",
          letterSpacing: "0.25em",
          textTransform: "uppercase",
        }}
      >
        Creators Toolkit
      </div>

      {/* ── Main title block ── */}
      <div
        style={{
          padding: "0 80px",
          textAlign: "center",
          transform: `scale(${titleScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
        }}
      >
        {/* 📘 "STRONG HOOK" badge — only shown when Claude rated the hook as strong.
            spring() gives it a satisfying pop-in rather than an abrupt appearance. */}
        {hookStrength === "strong" && (
          <div
            style={{
              transform: `scale(${badgeScale})`,
              backgroundColor: "#7c3aed",
              color: "#fff",
              fontSize: 24,
              fontWeight: 700,
              padding: "10px 28px",
              borderRadius: 100,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              fontFamily: "'Arial Black', sans-serif",
            }}
          >
            Strong Hook
          </div>
        )}

        {/* 📘 The summary text from Claude. Font weight 900 = maximum boldness.
            lineHeight 1.2 keeps multi-line text tight and impactful. */}
        <div
          style={{
            fontSize: summaryFontSize,
            fontWeight: 900,
            fontFamily: "'Arial Black', 'Impact', sans-serif",
            color: "#ffffff",
            lineHeight: 1.2,
            textShadow: "0 4px 24px rgba(124,58,237,0.5)",
          }}
        >
          {summary}
        </div>
      </div>

      {/* ── Accent line (bottom) ── */}
      {/* 📘 A thin purple line anchors the design and echoes the brand accent colour. */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 120,
          right: 120,
          height: 3,
          backgroundColor: "#7c3aed",
          opacity: 0.7,
          borderRadius: 2,
        }}
      />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BrandingMark — small persistent watermark on the main video footage
// ─────────────────────────────────────────────────────────────────────────────

// 📘 A lightweight overlay that stays visible throughout the main footage.
// Positioned top-right so it doesn't clash with captions (bottom) or kinetic text (centre).
const BrandingMark: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 52,
      right: 48,
      fontSize: 22,
      fontFamily: "'Arial', sans-serif",
      fontWeight: 700,
      color: "rgba(255,255,255,0.45)",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      // 📘 text-shadow gives the text legibility against both light and dark backgrounds.
      textShadow: "1px 1px 4px rgba(0,0,0,0.7)",
      pointerEvents: "none", // this layer doesn't intercept mouse events
    }}
  >
    CT
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MainFootage — Ken Burns + captions + kinetic phrases
// ─────────────────────────────────────────────────────────────────────────────

// 📘 Separated into its own component so Series.Sequence can contain it cleanly.
// Inside a Series.Sequence, useCurrentFrame() resets to 0 — so all startFrame /
// endFrame values from Claude are correct without any offset math.
const MainFootage: React.FC<{
  videoSrc: string;
  words: WordTimestamp[];
  kenBurnsZones: KenBurnsZone[];
  kineticPhrases: KineticPhrase[];
}> = ({ videoSrc, words, kenBurnsZones, kineticPhrases }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // ── Ken Burns Zoom ────────────────────────────────────────────────────────

  // 📘 Find whether a Ken Burns zone is active at this frame.
  const activeZone = kenBurnsZones.find(
    (z) => frame >= z.startFrame && frame <= z.endFrame
  );

  let scale = 1;
  let transformOrigin = "50% 50%";

  if (activeZone) {
    // 📘 Easing.bezier creates a smooth ease-in-out curve, like CSS ease-in-out.
    // interpolate() maps the frame position inside the zone to a scale value.
    scale = interpolate(
      frame,
      [activeZone.startFrame, activeZone.endFrame],
      [1, activeZone.scale],
      { easing: Easing.bezier(0.25, 0.1, 0.25, 1) }
    );
    transformOrigin = `${activeZone.x * 100}% ${activeZone.y * 100}%`;
  }

  // ── Kinetic Phrase Detection ──────────────────────────────────────────────

  const activePhrase = kineticPhrases.find(
    (p) => frame >= p.startFrame && frame < p.startFrame + p.durationFrames
  );

  // 📘 spring() gives the kinetic text a satisfying "pop" entrance.
  const phraseEntrance = activePhrase
    ? spring({
        frame: frame - activePhrase.startFrame,
        fps,
        config: { damping: 14, stiffness: 180 },
      })
    : 0;

  // 📘 Vignette intensity pulses up during kinetic moments for dramatic effect.
  const vignettePulse = activePhrase
    ? interpolate(
        frame - activePhrase.startFrame,
        [0, activePhrase.durationFrames * 0.3, activePhrase.durationFrames],
        [0, 0.4, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>

      {/* ── Layer 1: Source video with Ken Burns transform ── */}
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          transformOrigin,
          willChange: "transform",
        }}
      >
        {/* 📘 <Video> renders the source MP4. Remotion syncs playback to the current frame. */}
        <Video
          src={videoSrc}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      {/* ── Layer 2: Vignette ── */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)",
          opacity: 0.6 + vignettePulse,
          pointerEvents: "none",
        }}
      />

      {/* ── Layer 3: Branding mark (always visible) ── */}
      <BrandingMark />

      {/* ── Layer 4: Captions (hidden during kinetic phrases to avoid visual clash) ── */}
      {!activePhrase && <AnimatedCaptions words={words} fontSize={64} />}

      {/* ── Layer 5: Kinetic text pop ── */}
      {activePhrase && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 88,
              fontWeight: 900,
              fontFamily: "'Arial Black', 'Impact', sans-serif",
              color: "#FFFFFF",
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              lineHeight: 1.1,
              padding: "0 60px",
              textShadow:
                "0 0 40px rgba(255,255,255,0.3), 4px 4px 0px rgba(0,0,0,0.8)",
              transform: `scale(${phraseEntrance})`,
              opacity: phraseEntrance,
            }}
          >
            {activePhrase.text}
          </div>
        </AbsoluteFill>
      )}

    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CaptionedVideo — root composition
// ─────────────────────────────────────────────────────────────────────────────

// 📘 The main export used by Root.tsx. Remotion calls this once per frame.
// Series runs IntroCard for 'introFrames' frames, then switches to MainFootage.
export const CaptionedVideo: React.FC<CaptionedVideoProps> = ({
  videoSrc,
  words,
  kenBurnsZones,
  kineticPhrases,
  summary,
  hookStrength,
  introFrames,
}) => {
  // 📘 durationInFrames is the full composition length — intro + video footage.
  // We use it to tell MainFootage how long it runs so Series can size the sequence.
  const { durationInFrames } = useVideoConfig();
  const mainFrames = durationInFrames - introFrames;

  return (
    // 📘 AbsoluteFill fills the full 1080×1920 frame. Series stacks sequences in time.
    <AbsoluteFill>
      <Series>
        {/* ── Sequence 1: Intro title card ── */}
        {/* 📘 Inside this sequence, useCurrentFrame() runs from 0 to introFrames-1. */}
        <Series.Sequence durationInFrames={introFrames}>
          <IntroCard
            summary={summary}
            hookStrength={hookStrength}
            introFrames={introFrames}
          />
        </Series.Sequence>

        {/* ── Sequence 2: Main footage ── */}
        {/* 📘 Inside this sequence, useCurrentFrame() resets to 0 — frame 0 = video start.
            All kenBurnsZones and kineticPhrases startFrame values are relative to the
            video start, so they match useCurrentFrame() here with no offset needed. */}
        <Series.Sequence durationInFrames={mainFrames}>
          <MainFootage
            videoSrc={videoSrc}
            words={words}
            kenBurnsZones={kenBurnsZones}
            kineticPhrases={kineticPhrases}
          />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
