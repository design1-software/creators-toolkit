"use client";
// 📘 WHAT THIS FILE DOES: Displays the compiled creative brief and handles user approval.
// Once the user approves the brief, the parent page can trigger the production phase.
// 🔗 React components: https://www.w3schools.com/react/react_components.asp

import { useState } from "react";

// 📘 Props this component receives from its parent.
type BriefDisplayProps = {
  brief: string;           // the raw brief text (markdown format from Claude)
  onApprove: () => void;   // called when user clicks "Approve & Start Production"
  onRevise: () => void;    // called when user wants to go back and adjust the brief
};

// 📘 This component renders the creative brief in a readable, formatted card.
// It also presents two action buttons: approve or revise.
export default function BriefDisplay({ brief, onApprove, onRevise }: BriefDisplayProps) {
  // 📘 Track whether the user has clicked Approve to prevent double-clicks.
  const [approved, setApproved] = useState(false);

  // 📘 This function handles the "Approve" click.
  // It updates local state first, then calls the parent's callback.
  function handleApprove() {
    setApproved(true);  // update state — triggers a re-render
    onApprove();        // notify the parent page
  }

  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-6"
      style={{
        backgroundColor: "var(--color-surface)",
        border: `1px solid var(--color-border)`,
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <span className="text-2xl" role="img" aria-label="brief">📋</span>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
            Creative Brief
          </h2>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Review this before we start production. You can revise or approve.
          </p>
        </div>
      </div>

      {/* ── Brief Content ── */}
      {/* 📘 We render the brief line-by-line. Lines starting with '##' are headings,
          lines starting with '-' are bullets, others are regular text.
          This is a simple manual markdown renderer — no library needed for this scope. */}
      <div
        className="rounded-xl p-5 overflow-y-auto max-h-96 text-sm space-y-2"
        style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
      >
        {brief.split("\n").map((line, i) => {
          // 📘 Check what kind of line this is and style it appropriately.
          // .startsWith() checks if a string begins with a given substring.
          // 🔗 String methods: https://www.w3schools.com/jsref/jsref_startswith.asp

          if (line.startsWith("# ")) {
            // H1 heading (the brief title)
            return (
              <h1 key={i} className="text-xl font-bold mt-2" style={{ color: "var(--color-text)" }}>
                {line.slice(2)} {/* .slice(2) removes the "# " prefix */}
              </h1>
            );
          }
          if (line.startsWith("## ")) {
            // H2 section heading
            return (
              <h2 key={i} className="text-base font-semibold mt-4 mb-1" style={{ color: "var(--color-accent-light)" }}>
                {line.slice(3)}
              </h2>
            );
          }
          if (line.startsWith("### ")) {
            // H3 scene heading
            return (
              <h3 key={i} className="text-sm font-semibold mt-3" style={{ color: "var(--color-text)" }}>
                {line.slice(4)}
              </h3>
            );
          }
          if (line.startsWith("- ")) {
            // Bullet point
            return (
              <p key={i} className="pl-4" style={{ color: "var(--color-muted)" }}>
                • {line.slice(2)}
              </p>
            );
          }
          if (line.startsWith("- [ ]")) {
            // Checkbox item (asset requirements)
            return (
              <p key={i} className="pl-4 flex items-center gap-2" style={{ color: "var(--color-muted)" }}>
                <span className="text-xs border rounded px-1" style={{ borderColor: "var(--color-border)" }}>
                  TODO
                </span>
                {line.slice(6)}
              </p>
            );
          }
          if (line.trim() === "") {
            // Empty line — add spacing
            return <div key={i} className="h-1" />;
          }
          // Default: regular paragraph text
          return (
            <p key={i} style={{ color: "var(--color-text)" }}>
              {line}
            </p>
          );
        })}
      </div>

      {/* ── Action Buttons ── */}
      {/* 📘 We show different content depending on whether the user has approved.
          This is conditional rendering using a ternary operator. */}
      {approved ? (
        // After approval — show a confirmation message
        <div
          className="rounded-xl p-4 text-center text-sm font-semibold"
          style={{ backgroundColor: "rgba(124,58,237,0.15)", color: "var(--color-accent-light)" }}
        >
          Brief approved! Starting production...
        </div>
      ) : (
        // Before approval — show approve and revise buttons
        <div className="flex gap-3">
          {/* 📘 The Revise button takes the user back to the chat to make changes. */}
          <button
            onClick={onRevise}
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-70"
            style={{
              border: `1px solid var(--color-border)`,
              color: "var(--color-muted)",
            }}
          >
            ← Revise
          </button>

          {/* 📘 The Approve button kicks off Phase 3 — production. */}
          <button
            onClick={handleApprove}
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--color-accent)", color: "white" }}
          >
            Approve & Start Production →
          </button>
        </div>
      )}
    </div>
  );
}
