import { useMemo } from "react";
import {
  getDialogue,
  getScene,
  type DialogueTone,
  type OnboardingCoordinatorState,
  type OnboardingRegistry,
} from "../core/onboarding/index.ts";
import { onboardingTargetProps } from "../core/onboarding/targets.ts";

export type OnboardingShellProps = {
  active: boolean;
  registry: OnboardingRegistry;
  state: OnboardingCoordinatorState;
  tone?: DialogueTone;
  onSkip: () => void;
  onReveal: () => void;
  onReadyForSeptember: () => void;
  portraitRequired?: boolean;
};

/**
 * Persistent Skip + dialogue chrome. Scene content stays foundation-thin.
 * Full motion choreography is Slice B+.
 */
export function OnboardingShell({
  active,
  registry,
  state,
  tone = "classic",
  onSkip,
  onReveal,
  onReadyForSeptember,
  portraitRequired = false,
}: OnboardingShellProps) {
  const sceneId =
    state.kind !== "idle" &&
    state.kind !== "eligibility" &&
    state.kind !== "skipped" &&
    state.kind !== "completed" &&
    "sceneId" in state
      ? state.sceneId
      : null;

  const scene = sceneId ? getScene(registry, sceneId) : null;
  const dialogue = scene ? getDialogue(registry, scene.dialogueKey) : null;
  const line = useMemo(() => {
    if (!dialogue) return "";
    return dialogue.tones[tone] ?? dialogue.meaning;
  }, [dialogue, tone]);

  const revealed = state.kind === "typing" ? state.revealed : state.kind === "waiting-action" || state.kind === "reacting";
  const showReady = state.kind === "waiting-action" && scene?.expectedAction.kind === "ready-for-september";

  if (!active) return null;

  return (
    <div
      className="onboarding-shell"
      data-onboarding-shell="1"
      role="region"
      aria-label="Tutorial"
    >
      <button
        type="button"
        className="onboarding-skip"
        {...onboardingTargetProps("onboarding.skip")}
        onClick={onSkip}
      >
        Skip tutorial
      </button>

      {portraitRequired && (
        <p className="onboarding-portrait" role="status">
          Turn the phone upright to continue.
        </p>
      )}

      {state.kind === "target-missing" && (
        <p className="onboarding-status" role="alert">
          That control is missing. Unlocking safely.
        </p>
      )}

      {state.kind === "paused-conflict" && (
        <p className="onboarding-status" role="status">
          Tutorial paused — household or member changed.
        </p>
      )}

      {dialogue && (state.kind === "typing" || state.kind === "waiting-action" || state.kind === "reacting") && (
        <button
          type="button"
          className="onboarding-dialogue"
          onClick={() => {
            if (state.kind === "typing" && !state.revealed) onReveal();
          }}
        >
          <span className="onboarding-dialogue__label">Hercules</span>
          <span>{revealed ? line : `${line.slice(0, Math.max(12, Math.floor(line.length / 3)))}…`}</span>
        </button>
      )}

      {showReady && (
        <button type="button" className="onboarding-ready" onClick={onReadyForSeptember}>
          Ready for September
        </button>
      )}

      {state.kind === "reacting" && state.outcome === "mistake" && (
        <p className="onboarding-status" role="status">
          Not that one — try the highlighted control.
        </p>
      )}
    </div>
  );
}
