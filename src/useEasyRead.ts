import { useState } from "react";
/** A local visual preference, scoped to this person and ledger environment. */
export function useEasyRead(scope: string) {
  const key = `hearth:hercules-easy-read:${scope}`;
  const read = () => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  };
  const [state, setState] = useState(() => ({ key, value: read() }));
  const value = state.key === key ? state.value : read();
  return [
    value,
    (next: boolean) => {
      setState({ key, value: next });
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* Visual preference still works for this visit. */
      }
    },
  ] as const;
}
