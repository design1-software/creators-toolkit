// 📘 WHAT THIS FILE DOES: The Remotion composition that renders animated quote videos.
// Remotion is a library that lets you create videos by writing React components.
// Each frame of the video is one render of this React component at a specific time.
// 🔗 Remotion overview: https://www.remotion.dev/docs/

// 📘 'import' brings in code from other packages we installed via npm.
// Each import below adds specific capabilities to this file.
import React from "react";
import {
  AbsoluteFill,    // A helper div that fills the entire video frame
  useCurrentFrame, // Returns the current frame number (0, 1, 2, 3…)
  useVideoConfig,  // Returns fps, width, height, durationInFrames
  spring,          // Physics-based animation — creates bounce/ease effects
  interpolate,     // Maps one range of numbers to another (used for fading, scaling, etc.)
  Easing,          // Easing functions — control how animations accelerate/decelerate
} from "remotion";

// 📘 This defines the "shape" of data this component expects to receive.
// TypeScript uses types to catch mistakes — if you forget a prop, it will error.
// 🔗 TypeScript types: https://www.w3schools.com/typescript/typescript_object_types.php
export type AnimatedQuoteProps = {
  quote: string;              // The quote text to display
  author: string;             // Who said the quote
  gradientFrom: string;       // CSS hex color for the gradient's start (top-left)
  gradientTo: string;         // CSS hex color for the gradient's end (bottom-right)
  accentColor: string;        // Color for decorative lines and the author name
  textColor: string;          // Color for the main quote text (usually white)
  animationStyle: "word-by-word" | "full-text"; // How the text enters the frame
  fontSize: "small" | "medium" | "large";       // Text size (adapts to quote length)
};

// 📘 Maps the fontSize prop to actual pixel values.
// 'Record<string, number>' means an object whose keys are strings and values are numbers.
const FONT_SIZE_MAP: Record<string, number> = {
  small: 52,
  medium: 68,
  large: 84,
};

// 📘 This is the main React component — a function that returns JSX (React's HTML-like syntax).
// Remotion calls this function once per frame, with useCurrentFrame() returning the frame number.
// Think of it like an animation loop where React re-draws the scene at each frame.
// 🔗 React components: https://www.w3schools.com/react/react_components.asp
export const AnimatedQuote: React.FC<AnimatedQuoteProps> = ({
  quote,
  author,
  gradientFrom,
  gradientTo,
  accentColor,
  textColor,
  animationStyle,
  fontSize,
}) => {
  // 📘 'useCurrentFrame()' returns which frame is being rendered right now (starts at 0).
  // When the video plays at 30fps, frame 30 = 1 second into the video.
  // 🔗 Remotion frame: https://www.remotion.dev/docs/use-current-frame
  const frame = useCurrentFrame();

  // 📘 'useVideoConfig()' gives us info about the video: fps, width, height, durationInFrames.
  // We use fps to calculate how many frames = 1 second.
  const { fps, durationInFrames } = useVideoConfig();

  // 📘 Split the quote into individual words so we can animate each one separately.
  // 'split(" ")' breaks the string at every space, returning an array of words.
  // 🔗 String split: https://www.w3schools.com/jsref/jsref_split.asp
  const words = quote.split(" ");

  // How many frames to wait between each word appearing (word-by-word mode)
  const wordDelay = 7;

  // The frame at which the author line starts fading in
  // (after all words have appeared + a 20-frame pause)
  const authorStartFrame =
    animationStyle === "word-by-word" ? words.length * wordDelay + 20 : 40;

  // ── Author line animations ──

  // 📘 'interpolate' maps one number range to another.
  // Here: when frame goes from authorStartFrame to authorStartFrame+20,
  // opacity goes from 0 (invisible) to 1 (fully visible).
  // extrapolateLeft/Right: "clamp" means don't go below 0 or above 1.
  // 🔗 Remotion interpolate: https://www.remotion.dev/docs/interpolate
  const authorOpacity = interpolate(
    frame,
    [authorStartFrame, authorStartFrame + 20],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // The author line slides up from 20px below to its final position
  const authorTranslateY = interpolate(
    frame,
    [authorStartFrame, authorStartFrame + 20],
    [20, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.ease),
    }
  );

  // ── Decorative accent bar animation — slides in from left ──
  const accentBarWidth = interpolate(frame, [0, 20], [0, 80], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  // ── Subtle background "breathing" effect — very slow scale over the whole video ──
  const bgScale = interpolate(frame, [0, durationInFrames], [1, 1.04], {
    extrapolateRight: "clamp",
  });

  const quoteFontSize = FONT_SIZE_MAP[fontSize] ?? 68;

  return (
    // 📘 'AbsoluteFill' is a Remotion helper — it's a div that fills the entire frame.
    // It's the video equivalent of 'position: absolute; inset: 0'.
    // 🔗 AbsoluteFill: https://www.remotion.dev/docs/absolute-fill
    <AbsoluteFill
      style={{
        // 📘 Template literal to build the CSS gradient from the props.
        // 'linear-gradient' creates a smooth color transition across the background.
        // 🔗 CSS gradients: https://www.w3schools.com/css/css3_gradients.asp
        background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
        transform: `scale(${bgScale})`, // subtle scale creates a "breathing" feel
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "100px 80px",
      }}
    >
      {/* ── Decorative accent bar — slides in from left ── */}
      <div
        style={{
          width: accentBarWidth,
          height: "4px",
          backgroundColor: accentColor,
          marginBottom: "48px",
          borderRadius: "2px",
        }}
      />

      {/* ── Quote text ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "baseline",
          gap: "16px",
          maxWidth: "90%",
          textAlign: "center",
        }}
      >
        {/* 📘 'animationStyle === "word-by-word"' is a conditional check.
            If true, we render each word separately so they can spring in one at a time.
            If false, we render the whole quote at once and fade it in.
            🔗 JavaScript if/else: https://www.w3schools.com/js/js_if_else.asp */}
        {animationStyle === "word-by-word" ? (
          // 📘 '.map()' loops over the words array, returning a <span> for each word.
          // Each span springs in at a different time based on its index.
          // 🔗 Array.map: https://www.w3schools.com/jsref/jsref_map.asp
          words.map((word, i) => {
            // Each word starts its animation 'wordDelay' frames after the previous one.
            const wordStartFrame = i * wordDelay;

            // 📘 'spring()' simulates a physical spring — it bounces into place.
            // progress goes from 0 (not started) to 1 (fully settled).
            // frame - wordStartFrame = how many frames have passed since THIS word started.
            // config: damping controls bounciness, stiffness controls speed.
            // 🔗 Remotion spring: https://www.remotion.dev/docs/spring
            const progress = spring({
              frame: frame - wordStartFrame,
              fps,
              config: { damping: 14, stiffness: 180 },
            });

            return (
              <span
                key={i}
                style={{
                  color: textColor,
                  fontSize: quoteFontSize,
                  fontWeight: 700,
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  lineHeight: 1.2,
                  letterSpacing: "-0.02em",
                  display: "inline-block",
                  // 📘 'interpolate' here maps the spring's 0→1 progress to visual values.
                  // When progress=0: opacity=0, scale=0.8, translateY=20px (below position)
                  // When progress=1: opacity=1, scale=1, translateY=0px (final position)
                  opacity: interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }),
                  transform: `scale(${interpolate(progress, [0, 1], [0.7, 1])}) translateY(${interpolate(progress, [0, 1], [30, 0])}px)`,
                }}
              >
                {word}
              </span>
            );
          })
        ) : (
          // Full-text mode: fade the entire quote in at once
          <span
            style={{
              color: textColor,
              fontSize: quoteFontSize,
              fontWeight: 700,
              fontFamily: "Georgia, 'Times New Roman', serif",
              lineHeight: 1.35,
              letterSpacing: "-0.02em",
              opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" }),
            }}
          >
            {quote}
          </span>
        )}
      </div>

      {/* ── Author line ── */}
      <div
        style={{
          marginTop: "56px",
          opacity: authorOpacity,
          transform: `translateY(${authorTranslateY}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
        }}
      >
        {/* Small accent dash above the author name */}
        <div
          style={{
            width: "40px",
            height: "2px",
            backgroundColor: accentColor,
            borderRadius: "1px",
          }}
        />
        <p
          style={{
            color: accentColor,
            fontSize: 34,
            fontWeight: 500,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontStyle: "italic",
            textAlign: "center",
            letterSpacing: "0.04em",
          }}
        >
          — {author}
        </p>
      </div>
    </AbsoluteFill>
  );
};
