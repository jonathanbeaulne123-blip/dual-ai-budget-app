export function planSystemV2Enabled(value: unknown = import.meta.env.VITE_PLAN_SYSTEM_V2): boolean {
  return !(value === "0" || value === "false");
}

/** Vision v2 Household Home (A3). It cannot outlive the Plan V2 room that its Chapter door opens. */
export function householdHomeV2Enabled(
  value: unknown = import.meta.env.VITE_HOUSEHOLD_HOME_V2,
  planValue: unknown = import.meta.env.VITE_PLAN_SYSTEM_V2,
): boolean {
  return planSystemV2Enabled(planValue) && !(value === "0" || value === "false");
}

/**
 * The Queen's Nest (Stage 1): Household Home as one body. Opt-in inside the
 * Plan V2 family — set `VITE_QUEENS_NEST=1` (or `true`) to compose Home as the
 * Queen; anything else keeps the approved panel composition. It cannot outlive
 * the Household Home it recomposes.
 */
export function queensNestEnabled(
  value: unknown = import.meta.env.VITE_QUEENS_NEST,
  homeValue: unknown = import.meta.env.VITE_HOUSEHOLD_HOME_V2,
  planValue: unknown = import.meta.env.VITE_PLAN_SYSTEM_V2,
): boolean {
  return householdHomeV2Enabled(homeValue, planValue) && (value === "1" || value === "true");
}
