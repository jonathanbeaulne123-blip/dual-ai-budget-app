import { createContext, useContext } from "react";

/**
 * The Plan Studio tent's way back to the island (D-277). Our Path provides it
 * around the tent's room; anything inside the tent (Plan Studio v3's island
 * door) may use it. Outside the tent it is null, and such doors do not show.
 * A link only: it moves focus and view, never data.
 */
export type PathTent = { leaveTent: () => void };
export const PathTentContext = createContext<PathTent | null>(null);
export function usePathTent(): PathTent | null {
  return useContext(PathTentContext);
}
