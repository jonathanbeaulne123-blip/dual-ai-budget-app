import { getScene, nextSceneId } from "./registry.ts";
import type {
  OnboardingCoordinatorState,
  OnboardingEvent,
  OnboardingExpectedAction,
  OnboardingRegistry,
} from "./types.ts";

export type CoordinatorContext = {
  registry: OnboardingRegistry;
  state: OnboardingCoordinatorState;
  activeSceneId: string | null;
};

export function initialCoordinatorState(): OnboardingCoordinatorState {
  return { kind: "idle" };
}

function actionsMatch(expected: OnboardingExpectedAction, actual: OnboardingExpectedAction): boolean {
  if (expected.kind !== actual.kind) return false;
  switch (expected.kind) {
    case "tap-target":
      return actual.kind === "tap-target" && expected.targetId === actual.targetId;
    case "nav-tab":
      return actual.kind === "nav-tab" && expected.tab === actual.tab;
    case "semantic":
      return actual.kind === "semantic" && expected.code === actual.code;
    case "reveal-only":
    case "finish-practice":
    case "ready-for-september":
    case "skip":
      return true;
    default:
      return false;
  }
}

/**
 * Pure coordinator transition. Timers, toasts, arbitrary clicks, and model
 * replies are never accepted as completion — only typed semantic events.
 */
export function reduceOnboarding(
  ctx: CoordinatorContext,
  event: OnboardingEvent,
): CoordinatorContext {
  const { registry, state } = ctx;
  let activeSceneId = ctx.activeSceneId;

  const withState = (next: OnboardingCoordinatorState, sceneId = activeSceneId): CoordinatorContext => ({
    registry,
    state: next,
    activeSceneId: sceneId,
  });

  switch (event.type) {
    case "CHECK_ELIGIBILITY":
      return withState({ kind: "eligibility", eligible: event.eligible, reason: event.reason }, null);

    case "START": {
      if (!getScene(registry, event.sceneId)) {
        return withState({ kind: "target-missing", sceneId: event.sceneId, targetId: "" }, event.sceneId);
      }
      return withState({ kind: "entering", sceneId: event.sceneId }, event.sceneId);
    }

    case "ROUTE_SEGMENT_DONE": {
      if (state.kind !== "entering" && state.kind !== "routing") return ctx;
      const sceneId = state.sceneId;
      const scene = getScene(registry, sceneId);
      if (!scene) return withState({ kind: "target-missing", sceneId, targetId: "" }, sceneId);
      const segmentIndex = state.kind === "routing" ? state.segmentIndex + 1 : 0;
      if (segmentIndex < scene.routePlan.length) {
        return withState({ kind: "routing", sceneId, segmentIndex }, sceneId);
      }
      return withState({ kind: "focusing", sceneId }, sceneId);
    }

    case "FOCUS_DONE": {
      if (state.kind !== "focusing" && state.kind !== "entering") return ctx;
      const sceneId = state.kind === "focusing" || state.kind === "entering" ? state.sceneId : activeSceneId;
      if (!sceneId) return ctx;
      return withState({ kind: "typing", sceneId, revealed: false }, sceneId);
    }

    case "TYPE_DONE": {
      if (state.kind !== "typing") return ctx;
      return withState({ kind: "waiting-action", sceneId: state.sceneId }, state.sceneId);
    }

    case "REVEAL_DIALOGUE": {
      if (state.kind !== "typing") return ctx;
      return withState({ kind: "typing", sceneId: state.sceneId, revealed: true }, state.sceneId);
    }

    case "SEMANTIC_ACTION": {
      if (state.kind !== "waiting-action" && state.kind !== "typing") return ctx;
      const sceneId = state.sceneId;
      if (event.sceneId !== sceneId) return ctx;
      const scene = getScene(registry, sceneId);
      if (!scene) return withState({ kind: "target-missing", sceneId, targetId: "" }, sceneId);

      // Stale identity — household/member/env switch invalidates the scene.
      // Caller must pass matching identity; mismatch is treated as conflict pause.
      if (
        !event.memberKey ||
        !event.householdId ||
        !event.environment
      ) {
        return withState({ kind: "paused-conflict", sceneId, reason: "missing-identity" }, sceneId);
      }

      if (event.action.kind === "skip") {
        return withState({ kind: "skipped" }, sceneId);
      }

      if (!actionsMatch(scene.expectedAction, event.action)) {
        return withState({ kind: "reacting", sceneId, outcome: "mistake" }, sceneId);
      }

      return withState({ kind: "reacting", sceneId, outcome: "success" }, sceneId);
    }

    case "MISTAKE": {
      if (state.kind !== "waiting-action") return ctx;
      return withState({ kind: "reacting", sceneId: state.sceneId, outcome: "mistake" }, state.sceneId);
    }

    case "REACTION_DONE": {
      if (state.kind !== "reacting") return ctx;
      if (state.outcome === "mistake") {
        return withState({ kind: "waiting-action", sceneId: state.sceneId }, state.sceneId);
      }
      return withState({ kind: "saving-progress", sceneId: state.sceneId }, state.sceneId);
    }

    case "PROGRESS_SAVED": {
      if (state.kind !== "saving-progress") return ctx;
      if (!event.nextSceneId) {
        return withState({ kind: "completed" }, state.sceneId);
      }
      return withState({ kind: "entering", sceneId: event.nextSceneId }, event.nextSceneId);
    }

    case "TARGET_MISSING": {
      const sceneId = activeSceneId ?? (state.kind !== "idle" && "sceneId" in state ? state.sceneId : "");
      if (!sceneId) return ctx;
      return withState({ kind: "target-missing", sceneId, targetId: event.targetId }, sceneId);
    }

    case "TARGET_RECOVERED": {
      if (state.kind !== "target-missing") return ctx;
      return withState({ kind: "entering", sceneId: state.sceneId }, state.sceneId);
    }

    case "PAUSE_CONFLICT": {
      const sceneId = activeSceneId;
      if (!sceneId) return ctx;
      return withState({ kind: "paused-conflict", sceneId, reason: event.reason }, sceneId);
    }

    case "RESUME_AFTER_CONFLICT": {
      if (state.kind !== "paused-conflict") return ctx;
      return withState({ kind: "waiting-action", sceneId: state.sceneId }, state.sceneId);
    }

    case "SKIP":
      return withState({ kind: "skipped" }, activeSceneId);

    case "REPLAY": {
      const first = registry.chapters[0]?.sceneIds[0];
      if (!first) return withState({ kind: "idle" }, null);
      return withState({ kind: "entering", sceneId: first }, first);
    }

    case "COMPLETE":
      return withState({ kind: "completed" }, activeSceneId);

    default:
      return ctx;
  }
}

/** Advance helper after a successful semantic action + save. */
export function resolveNextAfterScene(registry: OnboardingRegistry, sceneId: string): string | null {
  return nextSceneId(registry, sceneId);
}

/** Drain route segments until focusing (foundation may skip walk animation). */
export function advanceRouteToFocus(ctx: CoordinatorContext): CoordinatorContext {
  let current = ctx;
  for (let i = 0; i < 16; i += 1) {
    if (current.state.kind === "focusing") return current;
    if (current.state.kind !== "entering" && current.state.kind !== "routing") return current;
    current = reduceOnboarding(current, { type: "ROUTE_SEGMENT_DONE" });
  }
  return current;
}

/** Whether an arbitrary UI event may be ignored (always true unless semantic). */
export function isNonsemanticNoise(kind: string): boolean {
  return ["click", "timer", "toast", "model-reply", "timeout"].includes(kind);
}
