import type { Environment, Household } from "./core/types.ts";

const prefix = "hearth:v1:";

export function loadHousehold(environment: Environment): Household | null {
  const raw = localStorage.getItem(prefix + environment);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Household;
  } catch {
    return null;
  }
}

export function saveHousehold(household: Household): void {
  localStorage.setItem(prefix + household.environment, JSON.stringify(household));
}

export function exportHousehold(household: Household): string {
  return JSON.stringify(household, null, 2);
}

export function downloadJson(household: Household): void {
  const blob = new Blob([exportHousehold(household)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hearth-${household.environment}-${household.lastCommittedAt?.slice(0, 10) ?? "export"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
