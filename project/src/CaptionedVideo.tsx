// 📘 WHAT THIS FILE DOES: The main Remotion composition for short-form video enhancement.
// It layers three effects on top of the source video:
//   1. Ken Burns zoom — slow, elegant zoom into key moments
//   2. AnimatedCaptions — word-highlighted subtitles from Whisper
//   3. Kinetic text pops — full-screen text at high-impact phrases
// 🔗 Remotion docs: https://www.remotion.dev/docs

import React from "react";
import {
  AbsoluteFill,    // fills the full frame — like position:absolute, inset:0
  Video,           // renders an MP4 video source inside a composition
  useCurrentFrame,
  useVideoConfig,
  interpolate,     // maps one range of numbers to another (like CSS calc)
  Easing,          // pre-built easing curves for smooth animations
  spring,          // spring physics animation (bouncy, natural)
} from "remotion";
import { AnimatedCaptions, type WordTimestamp } from "./AnimatedCaptions";

// 📘 A KenBurnsZone defines one zoom effect — when it starts, when it ends,
// how much to zoom in, and where to focus (x, y as 0–1 percentages of the frame).
export type KenBurnsZone = {
  startFrame: number; // frame where zoom begins
  endFrame: number;   // frame where zoom ends
  scale: number;      // zoom level (1.0 = normal, 1.15 = 15% zoom in)
  x: number;          // horizontal focus point (0 = left, 0.5 = center, 1 = right)
  y: number;          // vertical focus point (0 = top, 0.5 = center, 1 = bottom)
};

// 📘 A KineticPhrase is a high-impact word or phrase that pops full-screen for emphasis.
export type KineticPhrase = {
  text: string;        // the phrase to display (e.g. "THE RESULTS SPEAK")
  startFrame: number;  // frame where the pop begins
  durationFrames: number; // how many frames it stays visible
};

// 📘 These are all the props the composition needs — passed in from the render command.
export type CaptionedVideoProps = {
  videoSrc: string;              // URL/path to the source video file
  words: WordTimestamp[];        // Whisper word timestamps for captions
  kenBurnsZones: KenBurnsZone[]; // Ken Burns zoom zones
  kineticPhrases: KineticPhrase[]; // full-screen kinetic text moments
};

// 📘 The main composition component. Remotion calls this once per frame.
// Each call gets a different 'frame' value from useCurrentFrame().
export const CaptionedVideo: React.FC<CaptionedVideoProps> = ({
  videoSrc,
  words,
  kenBurnsZones,
  kineticPhrases,
}) => {
  // 📘 Get the current frame number and fps from Remotion's context.
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // ── Ken Burns Zoom ──────────────────────────────────────────────────────────

  // 📘 Find if any Ken Burns zone is active at the current frame.
  // Array.find() returns the first matching item, or undefined.
  // 🔗 Array.find: https://www.w3schools.com/jsref/jsref_find.asp
  const activeZone = kenBurnsZones.find(
    (z) => frame >= z.startFrame && frame <= z.endFrame
  );

  // 📘 Calculate the current zoom scale and transform origin.
  // interpolate() maps frame position within the zone to a scale value.
  // Think of it as: "at the start of the zone, scale is 1.0; at the end, it's zone.scale"
  let scale = 1;
  let transformOrigin = "50% 50%"; // default: zoom from center

  if (activeZone) {
    // 📘 Easing.bezier creates a smooth acceleration curve (ease-in-out feel).
    scale = interpolate(
      frame,
      [activeZone.startFrame, activeZone.endFrame],
      [1, activeZone.scale],
      { easing: Easing.bezier(0.25, 0.1, 0.25, 1) }
    );
    // 📘 Transform origin sets WHERE the zoom is anchored.
    // Converting 0–1 values to percentages: 0.5 → "50%"
    transformOrigin = `${activeZone.x * 100}% ${activeZone.y * 100}%`;
  }

  // ── Kinetic Phrase Detection ─────────────────────────────────────────────────

  // 📘 Find if a kinetic phrase should pop on screen right now.
  const activePhrase = kineticPhrases.find(
    (p) => frame >= p.startFrame && frame < p.startFrame + p.durationFrames
  );

  // 📘 spring() animates a value using physics — it starts fast and eases to a stop.
  // This is what makes the kinetic text "pop" rather than just appear.
  // 🔗 Spring physics: https://www.remotion.dev/docs/spring
  const phraseEntrance = activePhrase
    ? spring({
        frame: frame - activePhrase.startFrame, // frames elapsed since phrase started
        fps,
        config: { damping: 14, stiffness: 180 }, // bounciness controls
      })
    : 0;

  // 📘 Vignette pulse — a subtle darkening at the edges, tied to kinetic moments.
  // interpolate clamps the frame to a 0–1 range within the phrase duration.
  const vignettePulse = activePhrase
    ? interpolate(
        frame - activePhrase.startFrame,
        [0, activePhrase.durationFrames * 0.3, activePhrase.durationFrames],
        [0, 0.4, 0],  // opacity: fade in, hold, fade out
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 0;

  return (
    // 📘 AbsoluteFill is a Remotion helper that fills the entire frame with its children.
    // Everything inside is positioned relative to the frame dimensions.
    <AbsoluteFill style={{ backgroundColor: "#000" }}>

      {/* ── Layer 1: Source Video with Ken Burns transform ── */}
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          transformOrigin,
          // 📘 'will-change: transform' hints to the browser to optimise this layer.
          willChange: "transform",
        }}
      >
        {/* 📘 The <Video> component renders the source MP4 inside the composition.
            Remotion syncs its playback to the current frame automatically. */}
        <Video
          src={videoSrc}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      {/* ── Layer 2: Vignette Overlay ── */}
      {/* 📘 A radial gradient that darkens the edges — adds cinematic depth.
          The opacity pulses up during kinetic moments for dramatic effect. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)`,
          opacity: 0.6 + vignettePulse,
          pointerEvents: "none", // this layer doesn't block mouse events
        }}
      />

      {/* ── Layer 3: Word-Highlighted Captions ── */}
      {/* 📘 Only show captions when there's no kinetic phrase overlapping.
          Captions and kinetic text would clash visually. */}
      {!activePhrase && <AnimatedCaptions words={words} fontSize={48} />}

      {/* ── Layer 4: Kinetic Text Pop ── */}
      {activePhrase && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          {/* 📘 The kinetic text uses spring() for the scale entrance animation.
              'scale(phraseEntrance)' starts at 0 and snaps to 1 with a bounce. */}
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
              // 📘 Multi-layer text shadow for depth and legibility
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
