// 📘 WHAT THIS FILE DOES: The main Remotion composition for short-form video enhancement.
// It renders two sequences back-to-back using Remotion's Series component:
//   1. IntroCard  — 3-second animated title card (short title + summary subtitle)
//   2. MainFootage — Ken Burns zoom + captions + kinetic text pops + JLM watermark
//
// 📘 WHY Series?  Remotion's <Series> resets useCurrentFrame() to 0 at the start of
// each <Series.Sequence>, so all kenBurnsZones and kineticPhrases frame numbers
// (relative to video start) stay correct without any offset math.
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
// 📘 @remotion/google-fonts loads a Google Font at render time and returns the
// fontFamily string to use in your styles. Remotion handles delayRender/continueRender
// automatically so the font is guaranteed to be loaded before the first frame renders.
// 🔗 Remotion Google Fonts: https://www.remotion.dev/docs/google-fonts
import { loadFont } from "@remotion/google-fonts/GreatVibes";
// 📘 useAudioData() fetches and decodes the audio file so Remotion knows every sample.
// visualizeAudio() turns that sample data into per-frame frequency bar heights.
// 🔗 @remotion/media-utils: https://www.remotion.dev/docs/media-utils/use-audio-data
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { AnimatedCaptions, type WordTimestamp } from "./AnimatedCaptions";

// 📘 loadFont() is called at module level (outside any component) so the font is
// registered once and shared across all frames. The returned fontFamily string is
// what you pass to CSS font-family.
const { fontFamily: scriptFont } = loadFont("normal");

// ─── Types ────────────────────────────────────────────────────────────────────

export type KenBurnsZone = {
  startFrame: number;
  endFrame: number;
  scale: number;
  x: number;
  y: number;
};

export type KineticPhrase = {
  text: string;
  startFrame: number;
  durationFrames: number;
};

export type CaptionedVideoProps = {
  videoSrc: string;
  words: WordTimestamp[];
  kenBurnsZones: KenBurnsZone[];
  kineticPhrases: KineticPhrase[];
  title: string;        // 3–5 word ALL CAPS hook shown large on the intro card
  summary: string;      // full sentence shown as a subtitle beneath the title
  hookStrength: string; // "strong" | "medium" | "weak"
  introFrames: number;  // frames the intro card occupies (90 = 3s at 30fps)
  // 📘 HTTP URL for the normalized WAV — empty string disables the audio visualizer.
  // Remotion's useAudioData() fetches this file during rendering to read frequency data.
  audioSrc?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// IntroCard
// ─────────────────────────────────────────────────────────────────────────────

const IntroCard: React.FC<{
  title: string;
  summary: string;
  hookStrength: string;
  introFrames: number;
}> = ({ title, summary, hookStrength, introFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 📘 Fade the whole card in over 12 frames and out over 12 frames at the end.
  // The fade is applied to an inner wrapper — NOT to the AbsoluteFill — so the
  // background colour stays solid and only the content animates.
  const opacity = interpolate(
    frame,
    [0, 12, introFrames - 12, introFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // 📘 The title slides up slightly as it fades in — gives a polished entrance feel.
  const contentY = interpolate(
    frame,
    [0, 20],
    [36, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // 📘 "STRONG HOOK" badge springs in 10 frames after the title arrives.
  const badgeScale = hookStrength === "strong"
    ? spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 12, stiffness: 220 }, from: 0, to: 1 })
    : 0;

  return (
    // 📘 AbsoluteFill covers the full 1080×1920 frame with a solid background.
    // Opacity is NOT on this element — putting opacity here would fade the background
    // too, which looks wrong. Instead we apply it to the inner content wrapper.
    <AbsoluteFill
      style={{
        background: "linear-gradient(160deg, #0a0a0f 0%, #1a0830 55%, #0a0a0f 100%)",
      }}
    >
      {/* ── Branding label — top-centre ── */}
      {/* 📘 position: absolute takes it out of flow so it doesn't affect flex centering below. */}
      <div
        style={{
          position: "absolute",
          top: 90,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 28,
          fontWeight: 600,
          fontFamily: "'Arial', sans-serif",
          color: "rgba(255,255,255,0.5)",
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          opacity,
        }}
      >
        Creators Toolkit
      </div>

      {/* ── Content wrapper — vertically centred with a full-height explicit div ── */}
      {/* 📘 WHY an inner div instead of flex on AbsoluteFill?
          AbsoluteFill applies position:absolute which removes it from layout flow.
          Pairing display:flex + alignItems:center on a position:absolute element
          can behave inconsistently in headless Chromium. An explicit inner div
          with width/height:100% and display:flex gives reliable centering. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity,
          transform: `translateY(${contentY}px)`,
        }}
      >
        {/* "STRONG HOOK" badge — only when Claude rated it strong */}
        {hookStrength === "strong" && (
          <div
            style={{
              transform: `scale(${badgeScale})`,
              transformOrigin: "center center",
              backgroundColor: "#7c3aed",
              color: "#fff",
              fontSize: 26,
              fontWeight: 700,
              fontFamily: "'Arial Black', sans-serif",
              padding: "10px 32px",
              borderRadius: 100,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: 48,
            }}
          >
            Strong Hook
          </div>
        )}

        {/* 📘 Title — 3–5 word ALL CAPS hook from Claude. Large and punchy. */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            fontFamily: "'Arial Black', 'Impact', sans-serif",
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "0.03em",
            padding: "0 80px",
            textShadow: "0 4px 32px rgba(124,58,237,0.6)",
            marginBottom: 32,
          }}
        >
          {title}
        </div>

        {/* 📘 Summary — full sentence, smaller, acts as subtitle context. */}
        <div
          style={{
            fontSize: 36,
            fontWeight: 400,
            fontFamily: "'Arial', sans-serif",
            color: "rgba(255,255,255,0.65)",
            textAlign: "center",
            lineHeight: 1.5,
            padding: "0 100px",
            fontStyle: "italic",
          }}
        >
          {summary}
        </div>
      </div>

      {/* ── Purple accent line — bottom anchor ── */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 120,
          right: 120,
          height: 4,
          backgroundColor: "#7c3aed",
          borderRadius: 2,
          opacity,
        }}
      />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BrandingMark — "JLM" in Great Vibes script on the main footage
// ─────────────────────────────────────────────────────────────────────────────

// 📘 Great Vibes is a flowing calligraphy script loaded from Google Fonts via
// @remotion/google-fonts. The loadFont() call at module level (above) registered it.
// 'scriptFont' is the CSS font-family string Remotion returns after loading.
const BrandingMark: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 48,
      right: 48,
      fontSize: 52,
      fontFamily: scriptFont,
      color: "rgba(255,255,255,0.5)",
      // 📘 text-shadow gives legibility against both bright and dark backgrounds.
      textShadow: "1px 2px 6px rgba(0,0,0,0.7)",
      pointerEvents: "none",
      lineHeight: 1,
    }}
  >
    JLM
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// AudioVisualizer — frequency bar graph anchored to the bottom of the frame
// ─────────────────────────────────────────────────────────────────────────────

// 📘 useAudioData() is a Remotion hook that fetches and decodes an audio file.
// It calls delayRender() internally so Remotion waits for the file before
// rendering the first frame — no manual preloading needed.
//
// visualizeAudio() converts the decoded audio into an array of bar heights
// (one per frequency bucket) for the current frame. We render each as a
// vertical bar at the bottom of the screen.
//
// WHY at the bottom? The caption text sits in the lower third of the frame.
// Bars grow upward from the very bottom so they sit behind/beneath the captions
// without blocking faces or kinetic text which are centred vertically.
const AudioVisualizer: React.FC<{ audioSrc: string }> = ({ audioSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 📘 useAudioData() returns null while the file is still loading.
  // We render nothing until it resolves — Remotion holds the frame via delayRender.
  const audioData = useAudioData(audioSrc);
  if (!audioData) return null;

  // 📘 numberOfSamples controls how many bars to draw.
  // 64 buckets gives enough detail without making bars too thin at 1080px wide.
  const NUMBER_OF_SAMPLES = 64;
  const bars = visualizeAudio({
    audioData,
    frame,
    fps,
    numberOfSamples: NUMBER_OF_SAMPLES,
    // 📘 smoothing reduces frame-to-frame jitter so bars feel fluid not chaotic.
    smoothing: true,
  });

  const BAR_HEIGHT_MAX = 180; // maximum bar height in pixels
  const BAR_GAP        = 4;   // gap between bars in pixels

  return (
    // 📘 AbsoluteFill covers the full frame. We position the bars at the bottom
    // using absolute positioning so they don't affect the flex layout above.
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: BAR_HEIGHT_MAX,
          display: "flex",
          alignItems: "flex-end",
          gap: BAR_GAP,
          padding: "0 0",
        }}
      >
        {bars.map((magnitude, i) => (
          // 📘 Each bar's height is the magnitude (0–1) multiplied by the max pixel height.
          // The gradient goes from the accent purple at the base to a semi-transparent top.
          <div
            key={i}
            style={{
              flex: 1,
              height: magnitude * BAR_HEIGHT_MAX,
              background: "linear-gradient(to top, rgba(124,58,237,0.9), rgba(124,58,237,0.15))",
              borderRadius: "2px 2px 0 0",
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MainFootage — Ken Burns + captions + kinetic phrases + branding
// ─────────────────────────────────────────────────────────────────────────────

const MainFootage: React.FC<{
  videoSrc: string;
  words: WordTimestamp[];
  kenBurnsZones: KenBurnsZone[];
  kineticPhrases: KineticPhrase[];
  audioSrc?: string;
}> = ({ videoSrc, words, kenBurnsZones, kineticPhrases, audioSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Ken Burns ─────────────────────────────────────────────────────────────
  const activeZone = kenBurnsZones.find(
    (z) => frame >= z.startFrame && frame <= z.endFrame
  );

  let scale = 1;
  let transformOrigin = "50% 50%";

  if (activeZone) {
    scale = interpolate(
      frame,
      [activeZone.startFrame, activeZone.endFrame],
      [1, activeZone.scale],
      { easing: Easing.bezier(0.25, 0.1, 0.25, 1) }
    );
    transformOrigin = `${activeZone.x * 100}% ${activeZone.y * 100}%`;
  }

  // ── Kinetic phrases ───────────────────────────────────────────────────────
  const activePhrase = kineticPhrases.find(
    (p) => frame >= p.startFrame && frame < p.startFrame + p.durationFrames
  );

  const phraseEntrance = activePhrase
    ? spring({ frame: frame - activePhrase.startFrame, fps, config: { damping: 14, stiffness: 180 } })
    : 0;

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
      {/* Layer 1: Video + Ken Burns */}
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin, willChange: "transform" }}>
        <Video src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>

      {/* Layer 2: Vignette */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)",
          opacity: 0.6 + vignettePulse,
          pointerEvents: "none",
        }}
      />

      {/* Layer 3: JLM branding mark */}
      <BrandingMark />

      {/* Layer 4: Audio frequency visualizer — only rendered when audioSrc is provided */}
      {/* 📘 Renders behind captions so text stays readable, but above the vignette */}
      {audioSrc && <AudioVisualizer audioSrc={audioSrc} />}

      {/* Layer 5: Captions (hidden during kinetic phrases) */}
      {!activePhrase && <AnimatedCaptions words={words} fontSize={64} />}

      {/* Layer 6: Kinetic text pop */}
      {activePhrase && (
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
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
              textShadow: "0 0 40px rgba(255,255,255,0.3), 4px 4px 0px rgba(0,0,0,0.8)",
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

export const CaptionedVideo: React.FC<CaptionedVideoProps> = ({
  videoSrc,
  words,
  kenBurnsZones,
  kineticPhrases,
  title,
  summary,
  hookStrength,
  introFrames,
  audioSrc,
}) => {
  const { durationInFrames } = useVideoConfig();
  const mainFrames = durationInFrames - introFrames;

  return (
    <AbsoluteFill>
      <Series>
        {/* 📘 Sequence 1: Intro card. useCurrentFrame() runs 0 → introFrames-1 here. */}
        <Series.Sequence durationInFrames={introFrames}>
          <IntroCard
            title={title}
            summary={summary}
            hookStrength={hookStrength}
            introFrames={introFrames}
          />
        </Series.Sequence>

        {/* 📘 Sequence 2: Main footage. useCurrentFrame() resets to 0 here, so all
            kenBurnsZones and kineticPhrases startFrame values align with the video. */}
        <Series.Sequence durationInFrames={mainFrames}>
          <MainFootage
            videoSrc={videoSrc}
            words={words}
            kenBurnsZones={kenBurnsZones}
            kineticPhrases={kineticPhrases}
            audioSrc={audioSrc}
          />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
