/**
 * Thin App-facing controller: eligibility, progress, coordinator dispatch.
 * Practice and geometry stay in core; this never posts money.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  buildFoundationRegistry,
  buildProgressIdentity,
  createEmptyProgress,
  createLocalProgressStore,
  firstSceneId,
  getScene,
  initialCoordinatorState,
  isEligibleForAutoStart,
  isOnboardingFoundationEnabled,
  markCompleted,
  markSceneComplete,
  markSkipped,
  reduceOnboarding,
  requireValidRegistry,
  resolveNextAfterScene,
  resumeSceneId,
  advanceRouteToFocus,
  type OnboardingCoordinatorState,
  type OnboardingExpectedAction,
  type OnboardingProgressIdentity,
  type OnboardingRegistry,
} from "../core/onboarding/index.ts";
import { OnboardingShell } from "./OnboardingShell.tsx";
import { useOnboardingInteractionLock } from "./useOnboardingLock.ts";

type Env = "development" | "production";

function progressIdentityKey(identity: OnboardingProgressIdentity): string {
  return [
    identity.environment,
    identity.householdId,
    identity.memberKey,
    identity.registryVersion,
    identity.shell,
  ].join("|");
}

export type OnboardingControllerProps = {
  environment: Env;
  householdId: string;
  memberKey: string;
  shell: "phone" | "desktop";
  /** When false, do not auto-start (e.g. still booting). */
  ready: boolean;
  enabled?: boolean;
  onRequestTab?: (tab: string) => void;
};

type LocalState = {
  registry: OnboardingRegistry;
  coordinator: ReturnType<typeof reduceOnboarding>;
  identity: OnboardingProgressIdentity | null;
  runActive: boolean;
};

function buildInitial(registry: OnboardingRegistry): LocalState {
  return {
    registry,
    coordinator: {
      registry,
      state: initialCoordinatorState(),
      activeSceneId: null,
    },
    identity: null,
    runActive: false,
  };
}

type Action =
  | { type: "RESET"; registry: OnboardingRegistry }
  | { type: "SET_IDENTITY"; identity: OnboardingProgressIdentity }
  | { type: "DISPATCH"; event: Parameters<typeof reduceOnboarding>[1] }
  | { type: "SET_COORDINATOR"; coordinator: ReturnType<typeof reduceOnboarding> }
  | { type: "SET_ACTIVE"; active: boolean };

function reducer(state: LocalState, action: Action): LocalState {
  switch (action.type) {
    case "RESET":
      return buildInitial(action.registry);
    case "SET_IDENTITY":
      return { ...state, identity: action.identity };
    case "SET_ACTIVE":
      return { ...state, runActive: action.active };
    case "SET_COORDINATOR":
      return { ...state, coordinator: action.coordinator };
    case "DISPATCH":
      return {
        ...state,
        coordinator: reduceOnboarding(state.coordinator, action.event),
      };
    default:
      return state;
  }
}

function enterSceneWaiting(registry: OnboardingRegistry, sceneId: string) {
  let next = reduceOnboarding(
    { registry, state: initialCoordinatorState(), activeSceneId: null },
    { type: "START", sceneId },
  );
  next = advanceRouteToFocus(next);
  next = reduceOnboarding(next, { type: "FOCUS_DONE" });
  next = reduceOnboarding(next, { type: "TYPE_DONE" });
  return next;
}

export function OnboardingController(props: OnboardingControllerProps) {
  const enabled = props.enabled ?? isOnboardingFoundationEnabled();
  const registry = useMemo(() => requireValidRegistry(buildFoundationRegistry()), []);
  const store = useMemo(
    () =>
      createLocalProgressStore(
        typeof localStorage !== "undefined"
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            },
      ),
    [],
  );
  const [state, dispatch] = useReducer(reducer, registry, buildInitial);
  const [portraitRequired, setPortraitRequired] = useState(false);
  const bootRef = useRef(false);

  const identity = useMemo(
    () =>
      buildProgressIdentity({
        environment: props.environment,
        householdId: props.householdId,
        memberKey: props.memberKey,
        registryVersion: registry.version,
        shell: props.shell,
      }),
    [props.environment, props.householdId, props.memberKey, props.shell, registry.version],
  );

  useEffect(() => {
    dispatch({ type: "SET_IDENTITY", identity });
  }, [identity]);

  const identityKeyRef = useRef(progressIdentityKey(identity));
  useEffect(() => {
    const nextKey = progressIdentityKey(identity);
    if (identityKeyRef.current === nextKey) return;
    identityKeyRef.current = nextKey;
    if (!state.runActive) {
      bootRef.current = false;
      return;
    }
    dispatch({ type: "DISPATCH", event: { type: "PAUSE_CONFLICT", reason: "identity-changed" } });
    bootRef.current = false;
  }, [identity, state.runActive]);

  useEffect(() => {
    if (!enabled || !props.ready || bootRef.current) return;
    let cancelled = false;
    (async () => {
      const record = await store.load(identity);
      const eligibility = isEligibleForAutoStart(record);
      if (cancelled) return;
      dispatch({
        type: "DISPATCH",
        event: { type: "CHECK_ELIGIBILITY", eligible: eligibility.eligible, reason: eligibility.reason },
      });
      if (!eligibility.eligible) return;
      const first = firstSceneId(registry);
      if (!first) return;
      const startId = resumeSceneId(record, first);
      bootRef.current = true;
      dispatch({ type: "SET_ACTIVE", active: true });
      dispatch({ type: "SET_COORDINATOR", coordinator: enterSceneWaiting(registry, startId) });
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, props.ready, identity, registry, store]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const mq = window.matchMedia("(orientation: landscape) and (max-width: 719px)");
    const sync = () => setPortraitRequired(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [enabled]);

  const coordState: OnboardingCoordinatorState = state.coordinator.state;
  const sceneId =
    coordState.kind !== "idle" &&
    coordState.kind !== "eligibility" &&
    coordState.kind !== "skipped" &&
    coordState.kind !== "completed" &&
    "sceneId" in coordState
      ? coordState.sceneId
      : null;
  const scene = sceneId ? getScene(registry, sceneId) : null;
  const lockTarget =
    scene?.expectedAction.kind === "tap-target"
      ? scene.expectedAction.targetId
      : scene?.expectedAction.kind === "nav-tab"
        ? `nav.${scene.expectedAction.tab === "ledger" ? "ledger" : scene.expectedAction.tab}`
        : scene?.targetId ?? null;

  useOnboardingInteractionLock({
    active: state.runActive && !portraitRequired && coordState.kind !== "skipped" && coordState.kind !== "completed",
    targetId: lockTarget,
  });

  const emitSemantic = useCallback(
    async (action: OnboardingExpectedAction) => {
      if (!sceneId || !state.identity) return;
      dispatch({
        type: "DISPATCH",
        event: {
          type: "SEMANTIC_ACTION",
          action,
          sceneId,
          memberKey: state.identity.memberKey,
          householdId: state.identity.householdId,
          environment: state.identity.environment,
        },
      });
    },
    [sceneId, state.identity],
  );

  // After success reaction, save progress and advance.
  useEffect(() => {
    if (coordState.kind !== "reacting" || coordState.outcome !== "success") return;
    const timer = window.setTimeout(() => {
      dispatch({ type: "DISPATCH", event: { type: "REACTION_DONE" } });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [coordState]);

  useEffect(() => {
    if (coordState.kind !== "reacting" || coordState.outcome !== "mistake") return;
    const timer = window.setTimeout(() => {
      dispatch({ type: "DISPATCH", event: { type: "REACTION_DONE" } });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [coordState]);

  useEffect(() => {
    if (coordState.kind !== "saving-progress" || !state.identity) return;
    const identity = state.identity;
    let cancelled = false;
    (async () => {
      const sceneLocal = getScene(registry, coordState.sceneId);
      if (!sceneLocal) return;
      const existing = (await store.load(identity)) ?? createEmptyProgress(identity, new Date().toISOString());
      const nextId = resolveNextAfterScene(registry, coordState.sceneId);
      const chapter = registry.chapters.find((c) => c.id === sceneLocal.chapterId);
      const chapterComplete = Boolean(
        chapter &&
          chapter.sceneIds.every(
            (id) => id === coordState.sceneId || existing.completedSceneIds.includes(id),
          ),
      );
      let record = markSceneComplete(existing, {
        sceneId: coordState.sceneId,
        chapterId: sceneLocal.chapterId,
        chapterComplete,
        safeCheckpoint: Boolean(sceneLocal.safeCheckpoint),
        nowIso: new Date().toISOString(),
      });
      if (!nextId) {
        record = markCompleted(identity, new Date().toISOString(), record);
      }
      await store.save(record);
      if (cancelled) return;
      if (!nextId) {
        dispatch({ type: "DISPATCH", event: { type: "PROGRESS_SAVED", nextSceneId: null } });
        dispatch({ type: "SET_ACTIVE", active: false });
        return;
      }
      dispatch({
        type: "SET_COORDINATOR",
        coordinator: enterSceneWaiting(registry, nextId),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [coordState, registry, state.identity, store]);

  useEffect(() => {
    if (coordState.kind === "skipped" || coordState.kind === "completed") {
      dispatch({ type: "SET_ACTIVE", active: false });
    }
  }, [coordState.kind]);

  // Bridge: listen for semantic actions from anchored controls.
  useEffect(() => {
    if (!state.runActive || !scene) return;
    const onClick = (event: MouseEvent) => {
      const el = event.target;
      if (!(el instanceof Element)) return;
      const anchor = el.closest("[data-onboarding-id]");
      if (!anchor) return;
      const id = anchor.getAttribute("data-onboarding-id");
      if (!id || id === "onboarding.skip") return;

      if (scene.expectedAction.kind === "tap-target" && id === scene.expectedAction.targetId) {
        void emitSemantic({ kind: "tap-target", targetId: id });
        return;
      }
      if (scene.expectedAction.kind === "nav-tab") {
        const map: Record<string, typeof scene.expectedAction.tab> = {
          "nav.home": "home",
          "nav.calendar": "calendar",
          "nav.plan": "plan",
          "nav.ledger": "ledger",
          "nav.more": "more",
          "nav.add": "add",
        };
        const tab = map[id];
        if (tab && tab === scene.expectedAction.tab) {
          void emitSemantic({ kind: "nav-tab", tab });
          props.onRequestTab?.(tab === "add" ? "home" : tab);
        }
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [state.runActive, scene, emitSemantic, props]);

  const onSkip = useCallback(async () => {
    if (!state.identity) return;
    const existing = await store.load(state.identity);
    await store.save(markSkipped(state.identity, new Date().toISOString(), existing));
    dispatch({ type: "DISPATCH", event: { type: "SKIP" } });
  }, [state.identity, store]);

  const onReplay = useCallback(async () => {
    if (!state.identity) return;
    await store.clear(state.identity);
    bootRef.current = true;
    dispatch({ type: "SET_ACTIVE", active: true });
    const first = firstSceneId(registry);
    if (!first) return;
    dispatch({ type: "SET_COORDINATOR", coordinator: enterSceneWaiting(registry, first) });
  }, [state.identity, store, registry]);

  // Expose replay via custom event from More card.
  useEffect(() => {
    if (!enabled) return;
    const handler = () => {
      void onReplay();
    };
    window.addEventListener("hearth:onboarding-replay", handler);
    return () => window.removeEventListener("hearth:onboarding-replay", handler);
  }, [enabled, onReplay]);

  if (!enabled) return null;

  return (
    <OnboardingShell
      active={state.runActive}
      registry={registry}
      state={coordState}
      onSkip={() => void onSkip()}
      onReveal={() => dispatch({ type: "DISPATCH", event: { type: "REVEAL_DIALOGUE" } })}
      onReadyForSeptember={() => void emitSemantic({ kind: "ready-for-september" })}
      portraitRequired={portraitRequired}
    />
  );
}

export function requestOnboardingReplay(): void {
  window.dispatchEvent(new Event("hearth:onboarding-replay"));
}
