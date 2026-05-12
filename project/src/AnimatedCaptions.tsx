// 📘 WHAT THIS FILE DOES: Renders word-by-word highlighted captions on the video.
// Each word lights up in sync with the spoken audio using Whisper timestamps.
// This component is used inside CaptionedVideo.tsx as the caption layer.
// 🔗 Remotion docs: https://www.remotion.dev/docs

// 📘 React is the library that lets us write UI as components.
// Remotion builds on top of React — every frame of video is a React render.
import React from "react";
// 📘 useCurrentFrame() returns the current frame number Remotion is rendering.
// useVideoConfig() returns fps, width, height, durationInFrames for the composition.
import { useCurrentFrame, useVideoConfig } from "remotion";

// 📘 A WordTimestamp describes one word from the Whisper transcription.
// 'start' and 'end' are in seconds — we convert them to frames for Remotion.
export type WordTimestamp = {
  word: string;  // the transcribed word (e.g. "Hello")
  start: number; // when this word starts speaking (in seconds)
  end: number;   // when this word finishes (in seconds)
};

// 📘 Props this component needs from its parent (CaptionedVideo).
type AnimatedCaptionsProps = {
  words: WordTimestamp[];    // full array of transcribed words
  fontSize?: number;         // optional font size override (default: 52)
  maxWordsVisible?: number;  // how many words show at once (default: 5)
};

// 📘 This component renders a sliding window of highlighted captions.
// At any given frame it shows a few words, highlighting the one being spoken.
export const AnimatedCaptions: React.FC<AnimatedCaptionsProps> = ({
  words,
  fontSize = 52,
  maxWordsVisible = 5,
}) => {
  // 📘 useCurrentFrame() is the heart of Remotion — it tells us which frame we're on.
  // Every frame, React re-renders this component with the new frame number.
  const frame = useCurrentFrame();

  // 📘 useVideoConfig() gives us the FPS so we can convert frames ↔ seconds.
  // For example: frame 30 at 30fps = 1 second into the video.
  const { fps } = useVideoConfig();

  // 📘 Convert the current frame to seconds so we can compare with word timestamps.
  // Division converts frames to seconds: frame / fps = seconds elapsed.
  const currentTimeSeconds = frame / fps;

  // 📘 Find the index of the word currently being spoken.
  // Array.findIndex() returns the first index where the condition is true, or -1.
  // 🔗 Array methods: https://www.w3schools.com/jsref/jsref_findindex.asp
  const activeWordIndex = words.findIndex(
    (w) => currentTimeSeconds >= w.start && currentTimeSeconds <= w.end
  );

  // 📘 Determine the window of words to display around the active word.
  // We show 'maxWordsVisible' words centered near the active word.
  const windowStart = Math.max(
    0,
    activeWordIndex === -1
      ? // If no word is active, show words near the current time
        words.findIndex((w) => w.start > currentTimeSeconds) - 2
      : activeWordIndex - 2
  );
  const visibleWords = words.slice(windowStart, windowStart + maxWordsVisible);

  // 📘 If there are no words to show yet (before first word), render nothing.
  if (visibleWords.length === 0) return null;

  return (
    // 📘 'AbsoluteFill' from Remotion fills the entire frame — like position: absolute
    // with top/left/right/bottom all set to 0. We position our caption inside it.
    <div
      style={{
        position: "absolute",
        bottom: "12%",    // position captions near the bottom of the frame
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 40px",
      }}
    >
      {/* 📘 The caption container — dark semi-transparent background for readability. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",   // allows words to wrap to a new line
          justifyContent: "center",
          gap: "10px",
          maxWidth: "85%",
          backgroundColor: "rgba(0,0,0,0.55)", // semi-transparent black backdrop
          borderRadius: "16px",
          padding: "14px 24px",
        }}
      >
        {/* 📘 Render each visible word. The active word gets highlighted in yellow.
            .map() creates one <span> per word — same pattern as React lists.
            🔗 React lists: https://www.w3schools.com/react/react_lists.asp */}
        {visibleWords.map((word, i) => {
          // 📘 Determine if this specific word is the one being spoken right now.
          const globalIndex = windowStart + i;
          const isActive = globalIndex === activeWordIndex;

          return (
            <span
              key={`${word.start}-${i}`} // unique key required by React
              style={{
                fontSize,
                fontWeight: isActive ? 800 : 600,
                // 📘 Highlighted word = bright yellow; others = white
                color: isActive ? "#FFE600" : "#FFFFFF",
                // 📘 Text shadow adds depth and makes text readable on any background
                textShadow: isActive
                  ? "0 0 20px rgba(255,230,0,0.8), 2px 2px 4px rgba(0,0,0,0.9)"
                  : "2px 2px 4px rgba(0,0,0,0.9)",
                // 📘 Scale up the active word slightly for emphasis
                transform: isActive ? "scale(1.08)" : "scale(1)",
                transition: "all 0.08s ease", // smooth micro-animation
                lineHeight: 1.3,
                fontFamily: "'Arial Black', 'Impact', sans-serif",
                letterSpacing: isActive ? "0.02em" : "normal",
              }}
            >
              {word.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
