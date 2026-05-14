"use client";
// 📘 WHAT THIS FILE DOES: Displays a step-by-step progress indicator for pipeline features.
// Each step shows its status: pending, running, done, or error.
// When onRetry is provided, failed steps show a Retry button so the user can re-run
// just that step without restarting the whole pipeline from scratch.
// 🔗 React components: https://www.w3schools.com/react/react_components.asp

// 📘 A 'Step' describes one stage of the pipeline.
// status uses a union type — only these four values are valid.
export type Step = {
  id: string;                                          // unique identifier
  label: string;                                       // display name
  status: "pending" | "running" | "done" | "error";   // current state
  detail?: string;                                     // optional extra info (e.g. "47 words found")
};

type ProgressTrackerProps = {
  steps: Step[];
  // 📘 onRetry is optional. When provided, failed steps show a "Retry" button.
  // The parent page decides what "retry" means for that specific step — usually
  // it re-runs the pipeline from that step using the saved checkpoint data.
  onRetry?: (stepId: string) => void;
};

// 📘 Maps each status to a display icon so the user can read state at a glance.
const STATUS_ICON: Record<Step["status"], string> = {
  pending: "○",
  running: "⟳",
  done:    "✓",
  error:   "✕",
};

// 📘 Maps each status to a color using our CSS custom properties.
const STATUS_COLOR: Record<Step["status"], string> = {
  pending: "var(--color-muted)",
  running: "var(--color-accent-light)",
  done:    "#4ade80",  // green
  error:   "#f87171",  // red
};

// 📘 This component receives an array of steps and renders them as a vertical list.
// The parent page controls the step data — this component only displays it.
// This is the "single responsibility" principle: display logic here, business logic in parent.
export default function ProgressTracker({ steps, onRetry }: ProgressTrackerProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* 📘 .map() renders one row per step. */}
      {steps.map((step, index) => (
        <div
          key={step.id}
          className="flex items-start gap-4 p-4 rounded-xl"
          style={{
            backgroundColor:
              step.status === "running"
                ? "rgba(124,58,237,0.08)"
                : "var(--color-surface)",
            border: `1px solid ${
              step.status === "running"
                ? "var(--color-accent)"
                : step.status === "error"
                ? "#7f1d1d"
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
            {/* 📘 Show step number while pending, icon once state changes. */}
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
            {/* 📘 Show detail text only when it exists ('&&' short-circuits if false). */}
            {step.detail && (
              <p className="text-xs mt-1" style={{ color: STATUS_COLOR[step.status] }}>
                {step.detail}
              </p>
            )}
          </div>

          {/* ── Right side: spinner (running) or retry button (error) ── */}
          {step.status === "running" && (
            <div
              className="flex-shrink-0 w-4 h-4 rounded-full border-2 animate-spin"
              style={{ borderColor: "var(--color-accent-light)", borderTopColor: "transparent" }}
            />
          )}

          {/* 📘 Retry button — only shown when step failed AND parent passed onRetry.
              Clicking calls onRetry(step.id) so the parent knows WHICH step to re-run.
              The parent uses the saved checkpoint to skip already-completed steps. */}
          {step.status === "error" && onRetry && (
            <button
              onClick={() => onRetry(step.id)}
              className="flex-shrink-0 text-xs px-3 py-1 rounded-lg font-medium transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "rgba(248,113,113,0.15)",
                color: "#f87171",
                border: "1px solid #7f1d1d",
              }}
            >
              Retry
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
