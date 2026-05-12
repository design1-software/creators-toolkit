// 📘 WHAT THIS FILE DOES: The Remotion composition that renders the final promo brand video.
// Remotion renders this React component frame-by-frame to produce an MP4.
// The video has three acts: intro (brand + tagline), messages (key points), outro (CTA).
// Voiceover audio plays as a continuous track underneath the visuals.
// 🔗 Remotion overview: https://www.remotion.dev/docs/

import React from "react";
import {
  AbsoluteFill,    // A div that fills the entire video frame
  Audio,           // Plays an audio file as part of the video
  Img,             // Renders an image — Remotion-aware, handles caching correctly
  useCurrentFrame, // Returns the current frame number being rendered
  useVideoConfig,  // Returns fps, width, height, durationInFrames
  spring,          // Physics-based spring animation
  interpolate,     // Maps one number range to another
  Easing,          // Easing curves for animations
  staticFile,      // Resolves a path relative to the Remotion project's public/ folder
} from "remotion";

// 📘 TypeScript type — defines exactly what props this component accepts.
// The render API route builds an object matching this shape and passes it via --props.
// 🔗 TypeScript types: https://www.w3schools.com/typescript/typescript_object_types.php
export type PromoVideoProps = {
  brandName: string;       // e.g. "Nova Coffee"
  tagline: string;         // e.g. "Brewed for the bold"
  keyMessages: string[];   // e.g. ["Organic sourced", "Same-day roast", "Free delivery"]
  cta: string;             // e.g. "Order today"
  gradientFrom: string;    // CSS hex — gradient start color
  gradientTo: string;      // CSS hex — gradient end color
  accentColor: string;     // CSS hex — highlight color for lines and accents
  textColor: string;       // CSS hex — main text color (usually white)
  voiceSrc: string;             // Path relative to Remotion public/ — the mixed audio (VO + music)
  backgroundImageSrc?: string;  // Optional — path to Kie.ai generated background image in public/
};

// 📘 Frame timing constants — all measured in frames at 30fps.
// 30 frames = 1 second. Having named constants avoids "magic numbers" in the code.
const INTRO_END = 150;       // Intro (brand + tagline) runs for 5 seconds
const MESSAGES_START = 180;  // Small 1-second gap before key messages begin

// 📘 The main PromoVideo component — Remotion calls this once per frame.
// Each call receives the same props but useCurrentFrame() returns a different number,
// so the visuals change frame-by-frame to create the animation.
export const PromoVideo: React.FC<PromoVideoProps> = ({
  brandName,
  tagline,
  keyMessages,
  cta,
  gradientFrom,
  gradientTo,
  accentColor,
  textColor,
  voiceSrc,
  backgroundImageSrc,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ── Act 1: Intro — Brand name and tagline ──

  // 📘 spring() simulates a physical spring — creates a natural bounce-into-place effect.
  // frame - 0 means the spring starts immediately. damping: higher = less bounce.
  // 🔗 Remotion spring: https://www.remotion.dev/docs/spring
  const brandScale = spring({ frame, fps, config: { damping: 18, stiffness: 150 } });
  const brandOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // Subtle slow-zoom on the gradient background — only visible in fallback mode
  const bgScale = interpolate(frame, [0, durationInFrames], [1, 1.04], {
    extrapolateRight: "clamp",
  });

  // 📘 interpolate() maps one number range to another.
  // Here: when frame goes 0→300, accentBarWidth goes 0→120 (in pixels).
  // 🔗 Remotion interpolate: https://www.remotion.dev/docs/interpolate
  const accentBarWidth = interpolate(frame, [20, 50], [0, 120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  const taglineOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineY = interpolate(frame, [60, 90], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  // ── Act 2: Key messages ──

  // 📘 Calculate how many frames each key message gets.
  // We split the middle section equally between all messages.
  const outroStart = durationInFrames - 120; // last 4 seconds = outro
  const messagesEnd = outroStart - 20;
  const messagesAvailable = Math.max(1, messagesEnd - MESSAGES_START);
  const framesPerMessage = keyMessages.length > 0
    ? Math.floor(messagesAvailable / keyMessages.length)
    : messagesAvailable;

  // 📘 Calculate which message to show right now based on the current frame.
  // 'Math.floor' rounds down to the nearest whole number.
  // 🔗 JavaScript Math: https://www.w3schools.com/js/js_math.asp
  const messageIndex = Math.min(
    keyMessages.length - 1,
    Math.floor((frame - MESSAGES_START) / framesPerMessage)
  );

  const messageLocalFrame = (frame - MESSAGES_START) % framesPerMessage;

  // Each message fades in over 20 frames, fades out over the last 20 frames of its slot
  const messageFadeIn = interpolate(messageLocalFrame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const messageFadeOut = interpolate(
    messageLocalFrame,
    [framesPerMessage - 20, framesPerMessage],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const messageOpacity =
    frame >= MESSAGES_START && frame < messagesEnd
      ? messageFadeIn * messageFadeOut
      : 0;

  // ── Act 3: Outro — CTA ──

  const ctaProgress = spring({
    frame: frame - outroStart,
    fps,
    config: { damping: 14, stiffness: 160 },
  });
  const ctaOpacity = frame >= outroStart
    ? interpolate(ctaProgress, [0, 0.4], [0, 1], { extrapolateRight: "clamp" })
    : 0;
  const ctaScale = frame >= outroStart ? ctaProgress : 0;

  // Brand name returns smaller in the outro
  const outroBrandOpacity = interpolate(
    frame,
    [outroStart + 30, outroStart + 60],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ── Vignette opacity — only used in gradient-background fallback mode ──
  const vignetteOpacity = backgroundImageSrc ? 0 : 0.4;

  return (
    // 📘 AbsoluteFill is Remotion's full-frame container — like position: absolute; inset: 0.
    // 🔗 AbsoluteFill: https://www.remotion.dev/docs/absolute-fill
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      {/* ── Background: Kie.ai image if available, CSS gradient as fallback ── */}
      {backgroundImageSrc ? (
        <AbsoluteFill>
          {/* 📘 Remotion's <Img> component is like <img> but handles caching correctly.
              objectFit: "cover" fills the frame without stretching — crops if needed.
              🔗 Remotion Img: https://www.remotion.dev/docs/img */}
          <Img
            src={staticFile(backgroundImageSrc)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* Dark overlay — ensures white text is readable over any image */}
          <AbsoluteFill style={{ background: "rgba(0,0,0,0.50)" }} />
        </AbsoluteFill>
      ) : (
        // Gradient fallback — used when image generation was skipped or failed
        <AbsoluteFill
          style={{
            background: `linear-gradient(145deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
            transform: `scale(${bgScale})`,
          }}
        />
      )}
      {/* ── Voiceover audio track ──
          Audio plays from the start of the video. staticFile() resolves the path
          relative to the Remotion project's public/ folder.
          🔗 Remotion Audio: https://www.remotion.dev/docs/audio */}
      {voiceSrc && <Audio src={staticFile(voiceSrc)} />}

      {/* ── Vignette overlay — darkens edges for depth ── */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)",
          opacity: vignetteOpacity,
        }}
      />

      {/* ── Act 1 & Outro: Brand name ── */}
      {/* Show full-size during intro, small at top during outro */}
      {frame < MESSAGES_START && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
            opacity: brandOpacity,
            transform: `scale(${interpolate(brandScale, [0, 1], [0.7, 1])})`,
          }}
        >
          {/* Brand name */}
          <h1
            style={{
              color: textColor,
              fontSize: 96,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              textAlign: "center",
              lineHeight: 1,
              margin: 0,
              textShadow: "0 4px 40px rgba(0,0,0,0.4)",
            }}
          >
            {brandName}
          </h1>

          {/* Accent bar — slides in from left */}
          <div
            style={{
              height: "4px",
              width: accentBarWidth,
              backgroundColor: accentColor,
              borderRadius: "2px",
            }}
          />

          {/* Tagline */}
          <p
            style={{
              color: textColor,
              fontSize: 40,
              fontWeight: 400,
              fontStyle: "italic",
              textAlign: "center",
              opacity: taglineOpacity,
              transform: `translateY(${taglineY}px)`,
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            {tagline}
          </p>
        </div>
      )}

      {/* ── Act 2: Key messages ── */}
      {frame >= MESSAGES_START && frame < outroStart && keyMessages.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
            opacity: messageOpacity,
            padding: "0 80px",
            textAlign: "center",
          }}
        >
          {/* Message number indicator */}
          <div style={{ display: "flex", gap: "8px" }}>
            {keyMessages.map((_, i) => (
              <div
                key={i}
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: i === messageIndex ? accentColor : "rgba(255,255,255,0.3)",
                  transition: "background-color 0.3s",
                }}
              />
            ))}
          </div>

          {/* The current key message */}
          <p
            style={{
              color: textColor,
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.2,
              margin: 0,
              letterSpacing: "-0.02em",
              textShadow: "0 2px 20px rgba(0,0,0,0.3)",
            }}
          >
            {keyMessages[Math.max(0, messageIndex)]}
          </p>

          {/* Accent decoration below the message */}
          <div
            style={{
              width: "60px",
              height: "3px",
              backgroundColor: accentColor,
              borderRadius: "2px",
            }}
          />
        </div>
      )}

      {/* ── Act 3: Outro — CTA ── */}
      {frame >= outroStart && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "40px",
          }}
        >
          {/* Brand name — smaller, returns at top */}
          <p
            style={{
              color: textColor,
              fontSize: 42,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              opacity: outroBrandOpacity,
              margin: 0,
            }}
          >
            {brandName}
          </p>

          {/* CTA — springs in with bounce */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "24px",
              opacity: ctaOpacity,
              transform: `scale(${ctaScale})`,
            }}
          >
            <div
              style={{
                width: "60px",
                height: "3px",
                backgroundColor: accentColor,
                borderRadius: "2px",
              }}
            />
            <p
              style={{
                color: accentColor,
                fontSize: 64,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                textAlign: "center",
                margin: 0,
                textShadow: `0 0 40px ${accentColor}66`,
              }}
            >
              {cta}
            </p>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
