import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { bindHerculesRigEngine, createHerculesRigEngine, exposeHerculesRigConsole } from "./controller.ts";
import type { HerculesRigEngine } from "./engine.ts";
import type { HerculesRigCommand, HerculesRigMood, HerculesRigPose, RigEngineState } from "./types.ts";
import { startHerculesRigPoller } from "./transport.ts";
import "./macros.ts";

type RigContextValue = {
  engine: HerculesRigEngine;
  state: RigEngineState;
  dispatch: (command: HerculesRigCommand) => void;
  playPose: (pose: HerculesRigPose, loop?: boolean) => void;
  setMood: (mood: HerculesRigMood) => void;
};

const RigContext = createContext<RigContextValue | null>(null);

export function HerculesRigProvider({
  children,
  mood = "content",
  reducedMotion = false,
}: {
  children: ReactNode;
  mood?: HerculesRigMood;
  reducedMotion?: boolean;
}) {
  const engine = useMemo(() => createHerculesRigEngine(), []);
  const [state, setState] = useState<RigEngineState>(() => engine.getState());

  useEffect(() => {
    exposeHerculesRigConsole();
    bindHerculesRigEngine(engine);
    const stop = engine.subscribe(setState);
    engine.start();
    const stopPoll = startHerculesRigPoller((command) => engine.dispatch(command));
    return () => {
      stopPoll();
      stop();
      bindHerculesRigEngine(null);
      engine.destroy();
    };
  }, [engine]);

  useEffect(() => {
    engine.setReducedMotion(reducedMotion);
  }, [engine, reducedMotion]);

  useEffect(() => {
    engine.setMood(mood);
  }, [engine, mood]);

  const value = useMemo<RigContextValue>(() => ({
    engine,
    state,
    dispatch: (command) => engine.dispatch(command),
    playPose: (pose, loop) => engine.playPose(pose, loop),
    setMood: (next) => engine.setMood(next),
  }), [engine, state]);

  return <RigContext.Provider value={value}>{children}</RigContext.Provider>;
}

export function useHerculesRig(): RigContextValue {
  const ctx = useContext(RigContext);
  if (!ctx) throw new Error("useHerculesRig requires HerculesRigProvider");
  return ctx;
}

export function useOptionalHerculesRig(): RigContextValue | null {
  return useContext(RigContext);
}
