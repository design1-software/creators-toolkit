"use client";
// 📘 '"use client"' is required here because SkillCard uses event handlers (onMouseEnter,
// onMouseLeave) — those only work in the browser, not on the server.
// 🔗 Client vs Server components: https://nextjs.org/docs/app/building-your-application/rendering

// 📘 WHAT THIS FILE DOES: The SkillCard component — one card on the dashboard grid.
// A "component" is a reusable building block. This one takes data (props) and returns
// a styled card UI. We use it 6 times on the home page, once per skill.
// 🔗 React components: https://www.w3schools.com/react/react_components.asp

// 📘 'import Link' pulls in Next.js's client-side navigation component.
// Link wraps a URL and makes clicking it instant (no full page reload).
import Link from "next/link";

// 📘 This 'type' defines the shape of the data this component expects.
// TypeScript uses types to catch mistakes — if you forget a required prop, it'll warn you.
// 'Props' is short for "properties" — data passed into a component from outside.
type SkillCardProps = {
  title: string;       // the skill's display name
  description: string; // one-sentence explanation
  href: string;        // the URL this card links to (e.g. "/promo")
  icon: string;        // an emoji icon
  phase: string;       // which build phase (e.g. "Phase 1")
  ready: boolean;      // true = live; false = coming soon
};

// 📘 This is the component function. It receives 'props' (the data above) and
// returns JSX — HTML-like syntax that React compiles into real DOM elements.
// The curly braces in the parameter '{ title, description... }' is called "destructuring."
// It pulls each property out of the props object so we can use them directly.
// 🔗 Destructuring: https://www.w3schools.com/react/react_es6_destructuring.asp
export default function SkillCard({
  title,
  description,
  href,
  icon,
  phase,
  ready,
}: SkillCardProps) {
  // 📘 If 'ready' is false, we wrap in a div instead of a Link (no clicking).
  // The 'const' here stores the card's inner content so we only write it once.
  const cardContent = (
    <>
      {/* ── Card top row: icon + phase badge ── */}
      <div className="flex items-start justify-between mb-4">
        {/* 📘 'role="img"' and aria-label help screen readers describe the emoji. */}
        <span className="text-3xl" role="img" aria-label={title}>
          {icon}
        </span>
        {/* 📘 Conditional rendering: show a badge based on the 'ready' value.
            The ternary operator works like: condition ? "if true" : "if false"
            🔗 Ternary: https://www.w3schools.com/react/react_es6.asp */}
        <span
          className="text-xs font-semibold px-2 py-1 rounded-full"
          style={{
            backgroundColor: ready ? "rgba(124,58,237,0.2)" : "rgba(100,116,139,0.2)",
            color: ready ? "var(--color-accent-light)" : "var(--color-muted)",
          }}
        >
          {ready ? phase : "Coming Soon"}
        </span>
      </div>

      {/* ── Title ── */}
      <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text)" }}>
        {title}
      </h2>

      {/* ── Description ── */}
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
        {description}
      </p>

      {/* ── CTA arrow (only for ready skills) ── */}
      {/* 📘 '&& expression' renders the expression only when the left side is true.
          This is React's shorthand for "if ready, show this." */}
      {ready && (
        <div className="mt-4 text-sm font-medium flex items-center gap-1"
          style={{ color: "var(--color-accent-light)" }}>
          Open skill →
        </div>
      )}
    </>
  );

  // 📘 Shared styles for the card container — same visual for linked and disabled cards.
  const baseStyle: React.CSSProperties = {
    backgroundColor: "var(--color-surface)",
    border: `1px solid var(--color-border)`,
    borderRadius: "12px",
    padding: "24px",
    transition: "border-color 0.2s, transform 0.2s", // smooth hover animation
  };

  // 📘 If the skill is ready, render it as a clickable Link.
  // If not, render it as a plain div (non-interactive, visually dimmed).
  if (ready) {
    return (
      // 📘 'className' is React's version of HTML's 'class' attribute.
      // We can't use 'class' because it's a reserved word in JavaScript.
      <Link
        href={href}
        className="block group"   // 'group' lets child elements respond to hover via group-hover:
        style={baseStyle}
        onMouseEnter={(e) => {
          // 📘 onMouseEnter fires when the cursor moves over the element.
          // We use it to add a visual lift effect on hover.
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-accent)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        }}
      >
        {cardContent}
      </Link>
    );
  }

  // 📘 'opacity-60' makes the card semi-transparent — a visual cue it's not yet clickable.
  return (
    <div className="opacity-60 cursor-not-allowed" style={baseStyle}>
      {cardContent}
    </div>
  );
}
