// 📘 WHAT THIS FILE DOES: The Remotion entry point — registers all compositions.
// Remotion needs to know which compositions exist and their default settings.
// Think of this like a table of contents for all the videos this project can render.
// 🔗 Remotion compositions: https://www.remotion.dev/docs/composition

import React from "react";
// 📘 Composition is a Remotion component that registers a renderable video.
// registerRoot tells Remotion which component is the starting point.
import { Composition } from "remotion";
import { CaptionedVideo, type CaptionedVideoProps } from "./CaptionedVideo";
// 📘 Import the AnimatedQuote composition added in Phase 3.
import { AnimatedQuote, type AnimatedQuoteProps } from "./AnimatedQuote";
// 📘 Import the PromoVideo composition added in Phase 4.
import { PromoVideo, type PromoVideoProps } from "./PromoVideo";

// 📘 'registerRoot' is exported and called by Remotion's CLI automatically.
// It wraps all <Composition> elements — each one is a video you can render.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 📘 The CaptionedVideo composition — used for short-form video enhancement.
          id: the name you pass to 'npx remotion render CaptionedVideo'
          component: the React component that renders each frame
          durationInFrames: default length (overridden at render time with real video length)
          fps: frames per second — 30fps is standard for social media
          width/height: 1080x1920 = vertical 9:16 aspect ratio (TikTok/Reels) */}
      <Composition
        id="CaptionedVideo"
        component={CaptionedVideo}
        durationInFrames={900}  // default 30 seconds at 30fps (overridden at render time)
        fps={30}
        width={1080}
        height={1920}
        // 📘 defaultProps are used when previewing in Remotion Studio.
        // The real props come from the --props flag at render time.
        defaultProps={{
          videoSrc: "/sample.mp4",
          words: [],
          kenBurnsZones: [],
          kineticPhrases: [],
          lowerThirds: [],
          title: "SAMPLE VIDEO",
          summary: "A sample video for preview in Remotion Studio.",
          hookStrength: "medium",
          introFrames: 90,
          audioSrc: "",
        } satisfies CaptionedVideoProps}
      />
      {/* 📘 The AnimatedQuote composition — used for the Animated Quotes skill (Phase 3).
          Square 1080x1080 format works for Instagram, Facebook, LinkedIn, and Twitter.
          durationInFrames is overridden at render time based on Claude's durationSeconds choice.
          id: the name passed to 'npx remotion render AnimatedQuote' */}
      <Composition
        id="AnimatedQuote"
        component={AnimatedQuote}
        durationInFrames={600}  // default 20 seconds at 30fps — overridden at render time
        fps={30}
        width={1080}
        height={1080}
        // 📘 defaultProps are used for preview in Remotion Studio (npx remotion studio).
        // The real props come from the --props flag in the render API route.
        defaultProps={{
          quote: "The only way to do great work is to love what you do.",
          author: "Steve Jobs",
          gradientFrom: "#1a1a2e",
          gradientTo: "#16213e",
          accentColor: "#7c3aed",
          textColor: "#ffffff",
          animationStyle: "word-by-word",
          fontSize: "large",
        } satisfies AnimatedQuoteProps}
      />
      {/* 📘 The PromoVideo composition — used for the Promo Video skill (Phase 4).
          16:9 widescreen format (1920x1080) — standard for YouTube, LinkedIn, and brand videos.
          durationInFrames is overridden at render time based on the voiceover length.
          id: the name passed to 'npx remotion render PromoVideo' */}
      <Composition
        id="PromoVideo"
        component={PromoVideo}
        durationInFrames={900}  // default 30 seconds at 30fps — overridden at render time
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          brandName: "Brand Name",
          tagline: "Your tagline here",
          keyMessages: ["Key message one", "Key message two", "Key message three"],
          cta: "Get started today",
          gradientFrom: "#0a0a0f",
          gradientTo: "#1a1a2e",
          accentColor: "#7c3aed",
          textColor: "#ffffff",
          voiceSrc: "",
        } satisfies PromoVideoProps}
      />
    </>
  );
};
