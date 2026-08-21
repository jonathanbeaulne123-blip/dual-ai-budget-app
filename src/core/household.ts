import type { Household } from "./types.ts";

export function cloneHousehold(household: Household): Household {
  return structuredClone(household);
}
