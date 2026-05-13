// 📘 WHAT THIS FILE DOES: Shared TypeScript types used across multiple files.
// Keeping types in one place means if you change a type, all files update automatically.
// 🔗 TypeScript types: https://www.w3schools.com/typescript/typescript_aliases_and_interfaces.php

// 📘 A KenBurnsZone defines one slow zoom effect on the video.
// 'scale' is the zoom level — 1.0 is no zoom, 1.15 is 15% zoom in.
// 'x' and 'y' are the focal point (0–1 percentage of the frame).
export type KenBurnsZone = {
  startFrame: number;
  endFrame: number;
  scale: number;  // 1.0 = no zoom, 1.2 = 20% zoom in
  x: number;     // 0=left, 0.5=center, 1=right
  y: number;     // 0=top, 0.5=center, 1=bottom
};

// 📘 A KineticPhrase is a high-impact word or short phrase that appears
// full-screen for a few frames to emphasize a key moment.
export type KineticPhrase = {
  text: string;
  startFrame: number;
  durationFrames: number;
};

// 📘 A LowerThird is a director-style banner that slides in from the left
// to label a moment — a location, a person, a key quote.
// It appears above the audio visualizer bars and hides captions while active.
export type LowerThird = {
  label: string;     // main text — short, upper-case (e.g. "INTOXICATED SCIENTIST")
  sublabel: string;  // secondary line (e.g. "Bar · Birthday Night Out")
  startFrame: number;
  durationFrames: number;
};

// 📘 VideoInfo holds the metadata FFprobe reads from a video file.
export type VideoInfo = {
  duration: number;       // total length in seconds
  fps: number;            // frames per second
  width: number;          // pixel width
  height: number;         // pixel height
  durationFrames: number; // total frame count
};
