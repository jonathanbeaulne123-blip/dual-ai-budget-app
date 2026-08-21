import {
  assembleHousehold,
  mergePersonal,
  mergeShared,
  splitForSync,
} from "./core/sync.ts";
import type { Household } from "./core/types.ts";

export function apiUrl(): string {
  return import.meta.env.VITE_HEARTH_API || "/.netlify/functions/hearth";
}

async function post(body: unknown): Promise<Household> {
  const response = await fetch(apiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: { error?: string; household?: Household } = {};
  try {
    data = await response.json() as { error?: string; household?: Household };
  } catch {
    data = {};
  }
  if (!response.ok || !data.household) {
    throw new Error(data.error || "Could not reach the shared household. Try the hosted Hearth link.");
  }
  return data.household;
}

export async function createSharedHousehold(household: Household, memberId: string): Promise<Household> {
  return post({ action: "create", household, memberId });
}

export async function joinSharedHousehold(inviteCode: string, memberId?: string): Promise<Household> {
  return post({ action: "join", inviteCode, memberId });
}

export async function pullSharedHousehold(inviteCode: string, memberId: string): Promise<Household> {
  return post({ action: "pull", inviteCode, memberId });
}

export async function pushSharedHousehold(household: Household, memberId: string): Promise<Household> {
  return post({
    action: "push",
    inviteCode: household.inviteCode,
    memberId,
    household,
  });
}

export async function reconcileHousehold(local: Household, memberId: string): Promise<Household> {
  const remote = await pullSharedHousehold(local.inviteCode, memberId);
  const localParts = splitForSync(local, memberId);
  const remoteParts = splitForSync(remote, memberId);
  return assembleHousehold(
    mergeShared(remoteParts.shared, localParts.shared),
    mergePersonal(remoteParts.personal, localParts.personal),
  );
}

export function hostingHint(): string {
  if (typeof window === "undefined") return "";
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "Shared sync runs on the hosted Hearth site. This local copy stays on the device until you open that link.";
  }
  return "Invite the other person with the household code. Each phone keeps its own personal ledger plus the shared one.";
}
