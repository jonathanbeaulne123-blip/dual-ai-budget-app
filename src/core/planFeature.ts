export function planSystemV2Enabled(value: unknown = import.meta.env.VITE_PLAN_SYSTEM_V2): boolean {
  return value === "1" || value === "true";
}

/** Vision v2 Household Home (A3). Default on; set VITE_HOUSEHOLD_HOME_V2=0 to roll back to the Office-based Home. */
export function householdHomeV2Enabled(value: unknown = import.meta.env.VITE_HOUSEHOLD_HOME_V2): boolean {
  return !(value === "0" || value === "false");
}
