import type { HerculesRigEngine } from "./engine.ts";
import type { HerculesRigCommand, HerculesRigPose, RigEngineState, RigPartId, RigPartTransform } from "./types.ts";
import { rigSessionId } from "./transport.ts";

let activeEngine: HerculesRigEngine | null = null;

/** Attach the live engine instance from React. */
export function bindHerculesRigEngine(engine: HerculesRigEngine | null): void {
  activeEngine = engine;
  if (typeof window !== "undefined") {
    window.__hearthHerculesRig = engine;
  }
}

export function getHerculesRigEngine(): HerculesRigEngine | null {
  return activeEngine;
}

/** Primary AI entry point — enqueue rig commands on the live cat. */
export function dispatchHerculesRig(command: HerculesRigCommand): boolean {
  if (!activeEngine) return false;
  activeEngine.dispatch(command);
  return true;
}

export function readHerculesRigState(): RigEngineState | null {
  return activeEngine?.getState() ?? null;
}

export type HearthRigConsole = {
  dispatch: (command: HerculesRigCommand) => boolean;
  state: () => RigEngineState | null;
  parts: () => RigEngineState["parts"] | null;
  sessionId: () => string;
  playPose: (pose: HerculesRigPose) => boolean;
  setPart: (part: RigPartId, transform: Partial<RigPartTransform>) => boolean;
};

/** Dev/console helper: `hearthRig().playPose('beg')` */
export function exposeHerculesRigConsole(): void {
  if (typeof window === "undefined" || window.hearthRig) return;
  window.hearthRig = (): HearthRigConsole => ({
    dispatch: (command) => dispatchHerculesRig(command),
    state: () => readHerculesRigState(),
    parts: () => readHerculesRigState()?.parts ?? null,
    sessionId: () => rigSessionId(),
    playPose: (pose) => dispatchHerculesRig({ type: "playPose", pose }),
    setPart: (part, transform) => dispatchHerculesRig({ type: "setPart", part, transform }),
  });
}

declare global {
  interface Window {
    __hearthHerculesRig?: HerculesRigEngine | null;
    hearthRig?: () => HearthRigConsole;
  }
}

export { createHerculesRigEngine } from "./engine.ts";
