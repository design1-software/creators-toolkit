// 📘 WHAT THIS FILE DOES: The home page — the first thing users see at localhost:3000.
// In Next.js, app/page.tsx = the "/" route. Every folder with a page.tsx is a URL.
// This page shows the dashboard: a grid of skill cards the user can click into.
// 🔗 Next.js pages: https://nextjs.org/docs/app/building-your-application/routing/pages

// 📘 'import' pulls in code from another file so we can use it here.
// Link is Next.js's version of <a> — it navigates without reloading the page.
import SkillCard from "@/components/SkillCard"; // '@/' is an alias for the project root

// 📘 This defines the data for each skill card on the dashboard.
// An 'array' is an ordered list of items — here, each item is an object describing a skill.
// 🔗 JavaScript arrays: https://www.w3schools.com/js/js_arrays.asp
const SKILLS = [
  {
    title: "Promo Video",
    description: "Go from a URL or idea to a finished brand video. Claude guides you through discovery, generates assets, and renders the final MP4.",
    href: "/promo",
    icon: "🎬",
    phase: "Phase 1", // which build phase this skill is in
    ready: true,      // true = built and usable; false = coming soon
  },
  {
    title: "Short-Form Enhancement",
    description: "Upload any video — Claude adds word-highlighted captions, Ken Burns zoom, kinetic text pops, and audio cleanup.",
    href: "/short-form",
    icon: "⚡",
    phase: "Phase 2",
    ready: true,
  },
  {
    title: "Animated Quotes",
    description: "Turn any quote into a shareable 15–30s social video with AI background, spring-animated text, and background music.",
    href: "/quotes",
    icon: "💬",
    phase: "Phase 3",
    ready: true,
  },
  {
    title: "Copywriting",
    description: "Generate captions, hooks, hashtags, CTAs, and bio copy tailored to your platform and voice.",
    href: "/copy",
    icon: "✍️",
    phase: "Phase 3",
    ready: true,
  },
  {
    title: "Thumbnail A/B",
    description: "Generate 3–5 thumbnail variants automatically after any video delivery. Pick your winner.",
    href: "/thumbnails",
    icon: "🖼️",
    phase: "Phase 3",
    ready: true,
  },
  {
    title: "Content Repurposer",
    description: "Take one piece of content and multiply it across formats and platforms automatically.",
    href: "/repurpose",
    icon: "♻️",
    phase: "Phase 3",
    ready: true,
  },
];

// 📘 This is the Home component — a React function that returns the page's HTML (JSX).
// 'export default' means this is the main thing this file exports (Next.js requires it).
// 🔗 React components: https://www.w3schools.com/react/react_components.asp
export default function Home() {
  return (
    // 📘 <main> is a semantic HTML tag — it tells browsers and screen readers
    // "this is the primary content of the page." Good for accessibility.
    <main className="min-h-screen px-6 py-12 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-12 text-center">
        {/* 📘 <h1> is the most important heading — use only one per page.
            Tailwind classes: text-5xl = large font, font-bold = bold, mb-4 = margin-bottom */}
        <h1 className="text-5xl font-bold mb-4" style={{ color: "var(--color-text)" }}>
          Creators Toolkit
        </h1>
        <p className="text-lg max-w-xl mx-auto" style={{ color: "var(--color-muted)" }}>
          AI-powered content production. Pick a skill below to get started.
        </p>
      </div>

      {/* ── Skill Grid ── */}
      {/* 📘 CSS Grid lays out elements in rows and columns.
          'grid-cols-1' = one column on small screens, 'md:grid-cols-2' = two on medium,
          'lg:grid-cols-3' = three on large screens. This is called "responsive design."
          🔗 Learn CSS Grid: https://www.w3schools.com/css/css_grid.asp */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 📘 '.map()' loops over an array and returns a new array of JSX elements.
            It's how React renders lists — one component per item.
            🔗 Array map: https://www.w3schools.com/jsref/jsref_map.asp */}
        {SKILLS.map((skill) => (
          // 📘 'key' is required by React when rendering lists.
          // It helps React track which items changed — use a unique value.
          <SkillCard key={skill.title} {...skill} />
          // ↑ '{...skill}' is the "spread operator" — it passes all skill properties as props
        ))}
      </div>

      {/* ── Footer note ── */}
      <p className="text-center mt-16 text-sm" style={{ color: "var(--color-muted)" }}>
        All 6 skills are live. Select one above to get started.
        {/* 🔗 Learn about Next.js routing: https://nextjs.org/docs/app/building-your-application/routing */}
      </p>
    </main>
  );
}
