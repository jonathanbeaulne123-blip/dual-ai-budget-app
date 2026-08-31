import { useEffect, useRef } from "react";

export type AsyncScopeToken = { key: string; generation: number };

/** Invalidates delayed UI work on scope changes, A to B to A switches, and unmount. */
export function useAsyncScope(scopeKey: string): {
  capture: () => AsyncScopeToken;
  isCurrent: (token: AsyncScopeToken) => boolean;
} {
  const state = useRef({ key: scopeKey, generation: 0, mounted: true });
  if (state.current.key !== scopeKey) {
    state.current = {
      key: scopeKey,
      generation: state.current.generation + 1,
      mounted: true,
    };
  }

  useEffect(() => {
    const generation = state.current.generation;
    state.current.mounted = true;
    return () => {
      if (state.current.generation === generation) {
        state.current = {
          ...state.current,
          generation: generation + 1,
          mounted: false,
        };
      }
    };
  }, [scopeKey]);

  return {
    capture: () => ({ key: state.current.key, generation: state.current.generation }),
    isCurrent: (token) => Boolean(
      state.current.mounted
      && state.current.key === token.key
      && state.current.generation === token.generation
    ),
  };
}
