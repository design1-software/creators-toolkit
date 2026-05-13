// 📘 WHAT THIS FILE DOES: Renders word-by-word highlighted captions on the video.
// Each word lights up in sync with the spoken audio using Whisper timestamps.
// The active word uses Remotion's spring() function for a frame-accurate pop animation —
// unlike CSS transitions, spring() works correctly because Remotion renders each frame
// as a static React snapshot; CSS 'transition' has no effect between frames.
// 🔗 Remotion spring: https://www.remotion.dev/docs/spring

import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";

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
  fontSize?: number;         // optional font size override (default: 64)
  maxWordsVisible?: number;  // how many words show at once (default: 5)
};

// 📘 This component renders a sliding window of highlighted captions.
// At any given frame it shows a few words, spring-animating the one being spoken.
export const AnimatedCaptions: React.FC<AnimatedCaptionsProps> = ({
  words,
  fontSize = 64,
  maxWordsVisible = 5,
}) => {
  // 📘 useCurrentFrame() is the heart of Remotion — tells us which frame we're on.
  // Every frame, React re-renders this component with the new frame number.
  const frame = useCurrentFrame();

  // 📘 useVideoConfig() gives us fps to convert frames ↔ seconds.
  // At 30fps: frame 30 = 1 second into the video.
  const { fps } = useVideoConfig();

  // 📘 Convert the current frame to seconds to compare with word timestamps.
  const currentTimeSeconds = frame / fps;

  // 📘 Hide captions completely before the first word starts and after the last word ends.
  // Without this guard, the window-calculation below falls back to index 0 once
  // findIndex() returns -1 (no future word exists), causing the first 5 words to
  // reappear and stay frozen on screen for the rest of the video.
  const firstWord = words[0];
  const lastWord  = words[words.length - 1];
  if (!firstWord || !lastWord) return null;
  if (currentTimeSeconds < firstWord.start) return null;
  if (currentTimeSeconds > lastWord.end)    return null;

  // 📘 Find the index of the word currently being spoken.
  // findIndex() returns -1 when no word matches (gap between words).
  // 🔗 Array methods: https://www.w3schools.com/jsref/jsref_findindex.asp
  const activeWordIndex = words.findIndex(
    (w) => currentTimeSeconds >= w.start && currentTimeSeconds <= w.end
  );

  // 📘 Build a window of words centred near the active word.
  // During a gap between words (activeWordIndex === -1), we find the next upcoming
  // word and anchor the window just before it so captions stay visible mid-sentence.
  // Math.max(0, ...) prevents a negative start index.
  const windowStart = Math.max(
    0,
    activeWordIndex === -1
      ? words.findIndex((w) => w.start > currentTimeSeconds) - 2
      : activeWordIndex - 2
  );
  const visibleWords = words.slice(windowStart, windowStart + maxWordsVisible);

  if (visibleWords.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "12%",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 40px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "12px",
          maxWidth: "85%",
          backgroundColor: "rgba(0,0,0,0.6)",
          borderRadius: "20px",
          padding: "18px 28px",
        }}
      >
        {visibleWords.map((word, i) => {
          const globalIndex = windowStart + i;
          const isActive = globalIndex === activeWordIndex;

          // 📘 spring() creates a physics-based animation that snaps to its target value.
          // 'frame' here is how many frames have elapsed since this word became active.
          // frame - wordStartFrame gives 0 on the first frame the word is spoken, then
          // counts up — spring() maps that elapsed count to a smoothly animated scale.
          // WHY spring() instead of CSS transition: Remotion renders each frame as an
          // independent static image. CSS transitions need a live DOM to interpolate
          // between states — they do nothing in Remotion's render pipeline.
          // 🔗 Spring physics: https://www.remotion.dev/docs/spring
          const wordStartFrame = Math.round(word.start * fps);
          const framesSinceActive = Math.max(0, frame - wordStartFrame);

          const activeScale = isActive
            ? spring({
                frame: framesSinceActive,
                fps,
                config: { damping: 10, stiffness: 300 },
                from: 1,
                to: 1.18,
              })
            : 1;

          // 📘 The active word also gets a yellow glow. We fade the glow in with
          // interpolate() so it doesn't just snap on at frame 0.
          const glowOpacity = isActive
            ? spring({ frame: framesSinceActive, fps, config: { damping: 20, stiffness: 200 }, from: 0, to: 1 })
            : 0;

          return (
            <span
              key={`${word.start}-${i}`}
              style={{
                fontSize,
                fontWeight: isActive ? 900 : 600,
                // 📘 Active word = bright yellow; others = white
                color: isActive ? "#FFE600" : "#FFFFFF",
                textShadow: isActive
                  ? `0 0 ${20 * glowOpacity}px rgba(255,230,0,${0.9 * glowOpacity}), 2px 2px 6px rgba(0,0,0,0.95)`
                  : "2px 2px 6px rgba(0,0,0,0.9)",
                // 📘 spring() drives the scale — no CSS transition needed or wanted
                transform: `scale(${activeScale})`,
                lineHeight: 1.3,
                fontFamily: "'Arial Black', 'Impact', sans-serif",
                letterSpacing: isActive ? "0.03em" : "normal",
                // 📘 transform-origin: center keeps the word scaling from its own centre,
                // not the top-left corner of its bounding box.
                transformOrigin: "center center",
                display: "inline-block", // required for transform to apply to inline text
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
