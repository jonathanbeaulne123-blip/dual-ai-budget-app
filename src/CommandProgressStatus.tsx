import type { CommandProgressDisplay, CommandProgressStepState } from "./commandProgress.ts";

type Props = {
  display: CommandProgressDisplay;
};

function stepGlyph(state: CommandProgressStepState): string {
  if (state === "done") return "✓";
  if (state === "failed") return "!";
  if (state === "active") return "…";
  return "○";
}

export function CommandProgressStatus({ display }: Props) {
  if (!display.visible) return null;

  return (
    <div
      className="command-progress"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={display.summary}
    >
      <ol className="command-progress__steps">
        {display.steps.map((step) => (
          <li
            key={step.id}
            className={`command-progress__step command-progress__step--${step.state}`}
            aria-current={step.state === "active" ? "step" : undefined}
          >
            <span className="command-progress__glyph" aria-hidden="true">{stepGlyph(step.state)}</span>
            <span className="command-progress__label">{step.label}</span>
          </li>
        ))}
      </ol>
      <p className="command-progress__summary muted">{display.summary}</p>
    </div>
  );
}
