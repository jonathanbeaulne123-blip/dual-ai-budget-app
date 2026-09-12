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
