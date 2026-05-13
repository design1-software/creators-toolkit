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

export type LowerThird = {
  label: string;
  sublabel: string;
  startFrame: number;
  durationFrames: number;
};

export type CaptionedVideoProps = {
  videoSrc: string;
  words: WordTimestamp[];
  kenBurnsZones: KenBurnsZone[];
  kineticPhrases: KineticPhrase[];
  lowerThirds: LowerThird[];
  title: string;       // 3–5 word ALL CAPS hook — the only text on the intro card
  introFrames: number; // frames the intro card occupies (90 = 3s at 30fps)
  // 📘 Dynamic colour palette for the intro card background.
  // 'from' = vivid centre colour (chosen by Claude based on video mood).
  // 'to'   = very dark edge colour — creates a radial bloom effect.
  palette: { from: string; to: string };
  // kept for backward compatibility but no longer rendered on the intro card
  summary?: string;
  hookStrength?: string;
  // 📘 HTTP URL for the normalized WAV — empty string disables the audio visualizer.
  audioSrc?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// IntroCard
// ─────────────────────────────────────────────────────────────────────────────

// 📘 IntroCard — title only, dynamic palette, spring scale-in for impact.
// The background is a radial gradient: Claude's vivid 'from' colour at the centre
// (where the eye lands on the title) fading to a near-black 'to' colour at the edges.
// A light-bloom div sits behind the text to create a glow/halo effect.
const IntroCard: React.FC<{
  title: string;
  introFrames: number;
  palette: { from: string; to: string };
}> = ({ title, introFrames, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 📘 Spring scale: title punches in from 0.7× to 1× — feels like a snap cut reveal.
  const titleScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 160 },
    from: 0.7,
    to: 1,
  });

  // 📘 Fade the content in quickly (8 frames) and out at the very end (12 frames).
  const opacity = interpolate(
    frame,
    [0, 8, introFrames - 12, introFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        // 📘 Radial gradient: vivid centre → near-black edge.
        // Each video gets a unique colour from Claude's palette choice.
        background: `radial-gradient(ellipse at center, ${palette.from} 0%, ${palette.to} 100%)`,
      }}
    >
      {/* ── Light bloom behind the title — amplifies the glow effect ── */}
      {/* 📘 A large semi-transparent radial disc centred on the frame creates
          a bloom/halo around the text without needing image assets. */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "140%",
          height: "55%",
          background: `radial-gradient(ellipse at center, ${palette.from}55 0%, transparent 70%)`,
          opacity,
          pointerEvents: "none",
        }}
      />

      {/* ── Title — the only text on the card ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity,
        }}
      >
        <div
          style={{
            fontSize: 140,
            fontWeight: 900,
            fontFamily: "'Arial Black', 'Impact', sans-serif",
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.05,
            letterSpacing: "0.02em",
            padding: "0 80px",
            // 📘 Two-layer text shadow: a wide colour glow matching the palette,
            // and a tight dark drop-shadow for legibility against the bloom.
            textShadow: `0 0 80px ${palette.from}, 0 0 160px ${palette.from}88, 0 8px 24px rgba(0,0,0,0.9)`,
            transform: `scale(${titleScale})`,
            transformOrigin: "center center",
          }}
        >
          {title}
        </div>
      </div>
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
// LowerThirdOverlay — director-style banner that labels a location or moment
// ─────────────────────────────────────────────────────────────────────────────

// 📘 A lower third is the text banner you see in broadcast TV and YouTube vlogs —
// slides in from the left, holds for a few seconds, then exits left.
// It sits above the audio visualizer bars and below the kinetic text zone.
// Captions are suppressed when a lower third is active to keep the frame clean.
//
// Position: bottom 450px (above the 400px audio bars + 50px gap).
// Width: 68% of the 1080px frame so it never reaches the JLM watermark (top-right).
// Priority: hidden during kinetic phrases — caller passes activeLowerThird=null when phrase is on.
const LowerThirdOverlay: React.FC<{ lowerThird: LowerThird }> = ({ lowerThird }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const elapsed = frame - lowerThird.startFrame;
  const SLIDE_IN_FRAMES  = 12; // frames to animate in
  const SLIDE_OUT_FRAMES = 14; // frames to animate out before end

  // 📘 spring() drives the entrance — slides from off-screen left to resting position.
  const slideIn = spring({
    frame: elapsed,
    fps,
    config: { damping: 18, stiffness: 200 },
    from: -780, // start fully off the left edge (negative px)
    to: 0,
  });

  // 📘 interpolate() drives the exit — after the hold period, slide back left.
  // We use a linear ease so the exit feels like a deliberate pull rather than a bounce.
  const slideOut = elapsed >= lowerThird.durationFrames - SLIDE_OUT_FRAMES
    ? interpolate(
        elapsed,
        [lowerThird.durationFrames - SLIDE_OUT_FRAMES, lowerThird.durationFrames],
        [0, -780],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 0;

  // 📘 Combine entrance and exit — both are offsets; add them so exit overrides hold.
  const translateX = elapsed < SLIDE_IN_FRAMES ? slideIn : slideOut;

  // 📘 Fade in quickly and fade out with the slide so there's no hard cut.
  const opacity = interpolate(
    elapsed,
    [0, SLIDE_IN_FRAMES, lowerThird.durationFrames - SLIDE_OUT_FRAMES, lowerThird.durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        // 📘 bottom: 450px puts us 50px above the audio visualizer bars (400px tall).
        // This also clears the caption zone (bottom: 12% = ~230px) with room to spare.
        bottom: 450,
        left: 0,
        transform: `translateX(${translateX}px)`,
        opacity,
        // 📘 Width is 68% of 1080px = ~734px, leaving the right 32% clear for the watermark.
        width: "68%",
        display: "flex",
        alignItems: "stretch",
        pointerEvents: "none",
      }}
    >
      {/* Purple left accent bar — the visual anchor of the lower third */}
      <div
        style={{
          width: 8,
          borderRadius: "0 0 0 0",
          background: "linear-gradient(to bottom, #a78bfa, #7c3aed)",
          flexShrink: 0,
        }}
      />

      {/* Text block */}
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.72)",
          padding: "18px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flex: 1,
        }}
      >
        {/* 📘 Label — ALL CAPS, bold. Identifies the place/person/moment. */}
        <div
          style={{
            fontSize: 46,
            fontWeight: 900,
            fontFamily: "'Arial Black', 'Impact', sans-serif",
            color: "#ffffff",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            lineHeight: 1.1,
            textShadow: "0 2px 8px rgba(0,0,0,0.7)",
          }}
        >
          {lowerThird.label}
        </div>

        {/* 📘 Sublabel — context line in mixed case and a lighter colour. */}
        <div
          style={{
            fontSize: 30,
            fontWeight: 400,
            fontFamily: "'Arial', sans-serif",
            color: "rgba(255,255,255,0.72)",
            letterSpacing: "0.02em",
            lineHeight: 1.2,
          }}
        >
          {lowerThird.sublabel}
        </div>
      </div>
    </div>
  );
};

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

  // 📘 numberOfSamples MUST be a power of two (32, 64, 128…) — visualizeAudio() uses
  // an FFT internally and throws if the value isn't a valid FFT bin count.
  // 32 gives wider, chunkier bars that read well at 1080px wide.
  const NUMBER_OF_SAMPLES = 32;
  const rawBars = visualizeAudio({
    audioData,
    frame,
    fps,
    numberOfSamples: NUMBER_OF_SAMPLES,
    // 📘 smoothing reduces frame-to-frame jitter so bars feel fluid not chaotic.
    smoothing: true,
  });

  // 📘 Raw audio magnitudes cluster near zero for most frequencies — the result
  // looks like flat lines. Raising each value to a fractional power (< 1) stretches
  // small values upward while leaving loud peaks near their ceiling.
  // e.g. 0.1^0.5 = 0.316 — a quiet frequency now renders at 31% height instead of 10%.
  const bars = rawBars.map((m) => Math.pow(m, 0.5));

  const BAR_HEIGHT_MAX = 400; // 400px out of 1920px tall frame (~21%) — clearly visible
  const BAR_GAP        = 6;   // wider gap to match the wider bars

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
          // 📘 Each bar's height is the boosted magnitude multiplied by the max pixel height.
          // Gradient: solid bright purple at the base → lighter purple at the tip.
          // boxShadow adds a soft glow so bars punch through the video behind them.
          <div
            key={i}
            style={{
              flex: 1,
              height: magnitude * BAR_HEIGHT_MAX,
              background: "linear-gradient(to top, rgba(139,92,246,1), rgba(196,167,255,0.85))",
              borderRadius: "3px 3px 0 0",
              boxShadow: "0 0 14px rgba(139,92,246,0.7)",
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
  lowerThirds: LowerThird[];
  audioSrc?: string;
}> = ({ videoSrc, words, kenBurnsZones, kineticPhrases, lowerThirds, audioSrc }) => {
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

  // ── Lower thirds ──────────────────────────────────────────────────────────
  // 📘 Find the active lower third for this frame. When a kinetic phrase is on
  // screen we treat activeLowerThird as null so the full-screen phrase takes
  // priority and the lower third banner is hidden.
  const activeLowerThird = !activePhrase
    ? lowerThirds.find(
        (lt) => frame >= lt.startFrame && frame < lt.startFrame + lt.durationFrames
      ) ?? null
    : null;

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

      {/* Layer 5: Lower third — hidden during kinetic phrases (activeLowerThird is null then) */}
      {/* 📘 Positioned bottom 450px so it clears the audio bars (400px) and doesn't
          reach the JLM watermark (top-right). Width 68% keeps the right side clear. */}
      {activeLowerThird && <LowerThirdOverlay lowerThird={activeLowerThird} />}

      {/* Layer 6: Captions — hidden during kinetic phrases AND during lower thirds */}
      {/* 📘 Suppressing captions while a lower third is visible keeps the frame
          uncluttered — both elements live in the lower portion of the frame. */}
      {!activePhrase && !activeLowerThird && <AnimatedCaptions words={words} fontSize={64} />}

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
  lowerThirds,
  title,
  palette,
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
            introFrames={introFrames}
            palette={palette}
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
            lowerThirds={lowerThirds}
            audioSrc={audioSrc}
          />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
