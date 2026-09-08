import { isFundWidgetId } from "./fundRail.ts";
import type { Environment, FundWidgetId } from "./types.ts";

export function fundStageStorageKey(environment: Environment, householdId: string, memberId: string, today: string): string {
  return `hearth:fund-stage:${environment}:${householdId}:${memberId}:${today}`;
}

export function storedFundStage(environment: Environment, householdId: string, memberId: string, today: string): FundWidgetId {
  try {
    const stored = sessionStorage.getItem(fundStageStorageKey(environment, householdId, memberId, today));
    return isFundWidgetId(stored) ? stored : "level";
  } catch {
    return "level";
  }
}

