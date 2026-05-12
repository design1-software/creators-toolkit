"use client";
// 📘 WHAT THIS FILE DOES: Displays a step-by-step progress indicator for the
// short-form enhancement pipeline. Each step shows its status: pending, running, done, or error.
// 🔗 React components: https://www.w3schools.com/react/react_components.asp

// 📘 A 'Step' describes one stage of the enhancement pipeline.
// status uses a union type — only these four values are valid.
export type Step = {
  id: string;                                          // unique identifier
  label: string;                                       // display name
  status: "pending" | "running" | "done" | "error";   // current state
  detail?: string;                                     // optional extra info (e.g. "47 words found")
};

type ProgressTrackerProps = {
  steps: Step[];
};

// 📘 Maps each status to a display icon so the user can read state at a glance.
const STATUS_ICON: Record<Step["status"], string> = {
  pending: "○",
  running: "⟳",
  done: "✓",
  error: "✕",
};

// 📘 Maps each status to a color using our CSS custom properties.
const STATUS_COLOR: Record<Step["status"], string> = {
  pending: "var(--color-muted)",
  running: "var(--color-accent-light)",
  done: "#4ade80",   // green
  error: "#f87171",  // red
};

// 📘 This component receives an array of steps and renders them as a vertical list.
// The parent page controls the step data — this component only displays it.
// This is the "single responsibility" principle: display logic here, business logic in parent.
export default function ProgressTracker({ steps }: ProgressTrackerProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* 📘 .map() renders one row per step — same pattern as the dashboard skill grid. */}
      {steps.map((step, index) => (
        <div
          key={step.id}
          className="flex items-start gap-4 p-4 rounded-xl"
          style={{
            backgroundColor:
              step.status === "running"
                ? "rgba(124,58,237,0.08)" // subtle highlight for active step
                : "var(--color-surface)",
            border: `1px solid ${
              step.status === "running"
                ? "var(--color-accent)"
                : "var(--color-border)"
            }`,
            transition: "border-color 0.3s, background-color 0.3s",
          }}
        >
          {/* ── Step number / status icon ── */}
          <div
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{
              backgroundColor:
                step.status === "done"
                  ? "rgba(74,222,128,0.15)"
                  : step.status === "error"
                  ? "rgba(248,113,113,0.15)"
                  : "var(--color-border)",
              color: STATUS_COLOR[step.status],
            }}
          >
            {/* 📘 Show the step number while pending, icon once it's changed state. */}
            {step.status === "pending" ? index + 1 : STATUS_ICON[step.status]}
          </div>

          {/* ── Step label + detail ── */}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium"
              style={{
                color:
                  step.status === "pending"
                    ? "var(--color-muted)"
                    : "var(--color-text)",
              }}
            >
              {step.label}
            </p>
            {/* 📘 Show detail text only when it exists ('&&' short-circuit). */}
            {step.detail && (
              <p className="text-xs mt-1" style={{ color: STATUS_COLOR[step.status] }}>
                {step.detail}
              </p>
            )}
          </div>

          {/* ── Spinning animation for running steps ── */}
          {step.status === "running" && (
            <div
              className="flex-shrink-0 w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--color-accent-light)", borderTopColor: "transparent" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
