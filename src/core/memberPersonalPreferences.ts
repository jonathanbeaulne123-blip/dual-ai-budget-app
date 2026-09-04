import type { Household } from "./types.ts";

export type MemberPersonalPreferenceKind =
  | "landing-surface-personal"
  | "glance-account-personal"
  | "hercules-permissions-personal";

/**
 * Fail closed unless the only changed fact belongs to the signed-in member's
 * named Personal preference. The App applies this before the cloud-authority
 * commit boundary; callers cannot smuggle unrelated Shared or Personal facts.
 */
export function memberPersonalPreferenceUpdateAllowed(
  current: Household,
  next: Household,
  memberId: string,
  commandKind: MemberPersonalPreferenceKind,
): boolean {
  if (
    current.environment !== next.environment
    || current.householdId !== next.householdId
    || current.revision !== next.revision
  ) return false;
  const currentMember = current.members.find((member) => member.id === memberId && member.active);
  const nextMember = next.members.find((member) => member.id === memberId && member.active);
  if (!currentMember || !nextMember) return false;

  const normalized = structuredClone(next);
  if (commandKind === "landing-surface-personal") {
    normalized.members = normalized.members.map((member) => member.id === memberId
      ? {
          ...member,
          landingSurface: currentMember.landingSurface,
          landingSurfaceUpdatedAt: currentMember.landingSurfaceUpdatedAt,
        }
      : member);
  } else if (commandKind === "glance-account-personal") {
    normalized.members = normalized.members.map((member) => member.id === memberId
      ? {
          ...member,
          glanceAccountId: currentMember.glanceAccountId,
          glanceAccountUpdatedAt: currentMember.glanceAccountUpdatedAt,
        }
      : member);
  } else {
    normalized.herculesProPermissions = current.herculesProPermissions;
  }
  return JSON.stringify(normalized) === JSON.stringify(current);
}
