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

/**
 * The Standing Book: the Fund board presented as a book whose fore-edge is
 * the tablist. Opt-in inside the Plan V2 family — set
 * `VITE_FUND_STANDING_BOOK=1` (or `true`) to stand the book in place of the
 * board; anything else keeps the approved board. It cannot outlive the
 * Household Home whose Fund it presents.
 */
export function fundStandingBookEnabled(
  value: unknown = import.meta.env.VITE_FUND_STANDING_BOOK,
  homeValue: unknown = import.meta.env.VITE_HOUSEHOLD_HOME_V2,
  planValue: unknown = import.meta.env.VITE_PLAN_SYSTEM_V2,
): boolean {
  return householdHomeV2Enabled(homeValue, planValue) && (value === "1" || value === "true");
}
