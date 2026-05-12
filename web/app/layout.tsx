// 📘 WHAT THIS FILE DOES: The root layout — the wrapper that surrounds EVERY page.
// In Next.js App Router, layout.tsx is like the outer shell of your site.
// Anything you put here (navbar, fonts, global styles) appears on every page.
// 🔗 Next.js layouts: https://nextjs.org/docs/app/building-your-application/routing/layouts-and-templates

// 📘 'Metadata' is a TypeScript type from Next.js that shapes the <head> tags
// (title, description) — the info shown in browser tabs and search results.
import type { Metadata } from "next";
import "./globals.css"; // pulls in our global CSS (dark theme, custom properties, etc.)

// 📘 'export const metadata' tells Next.js what to put in the <head> of every page.
// This controls what shows up in the browser tab and in search engine results.
export const metadata: Metadata = {
  title: "Creators Toolkit",
  description: "AI-powered content creation — promo videos, captions, voiceover, and more.",
};

// 📘 This is a React component — a function that returns HTML-like JSX.
// 'children' is whatever page content should appear inside this layout.
// Every page you create becomes the 'children' here automatically.
// 🔗 React components: https://www.w3schools.com/react/react_components.asp
export default function RootLayout({
  children,
}: {
  children: React.ReactNode; // React.ReactNode = any valid React content (JSX, text, etc.)
}) {
  return (
    // 📘 <html> is the outermost element. 'lang="en"' helps screen readers and search engines.
    <html lang="en" className="h-full">
      {/* 📘 <body> is what users see. 'min-h-full' ensures it fills the screen height. */}
      <body className="min-h-full flex flex-col antialiased">
        {children}
        {/* ↑ Every page's content is injected here */}
      </body>
    </html>
  );
}
