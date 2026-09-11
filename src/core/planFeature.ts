export function planSystemV2Enabled(value: unknown = import.meta.env.VITE_PLAN_SYSTEM_V2): boolean {
  return value === "1" || value === "true";
}
