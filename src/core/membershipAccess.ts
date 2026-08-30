export type HouseholdMembershipRole = "owner" | "member";

export type MembershipAction =
  | "invite-owner"
  | "invite-member"
  | "revoke-member"
  | "revoke-device"
  | "leave";

export type MembershipActionDecision = {
  allowed: boolean;
  reason: "allowed" | "not-owner" | "co-owner-protected" | "last-owner" | "not-self";
};

/**
 * UI mirror of migration 017's state machine. SQL remains the authority.
 * This never grants access; it keeps consequences and disabled controls honest.
 */
export function membershipActionDecision(input: {
  action: MembershipAction;
  actorRole: HouseholdMembershipRole;
  actorMemberId: string;
  targetRole?: HouseholdMembershipRole;
  targetMemberId?: string;
  activeOwnerCount: number;
}): MembershipActionDecision {
  if (input.action === "leave") {
    if (input.actorRole === "owner" && input.activeOwnerCount <= 1) {
      return { allowed: false, reason: "last-owner" };
    }
    return { allowed: true, reason: "allowed" };
  }
  if (input.action === "revoke-device") {
    if (input.actorRole === "owner" || input.targetMemberId === input.actorMemberId) {
      return { allowed: true, reason: "allowed" };
    }
    return { allowed: false, reason: "not-self" };
  }
  if (input.actorRole !== "owner") {
    return { allowed: false, reason: "not-owner" };
  }
  if (input.action === "revoke-member" && input.targetRole === "owner") {
    return { allowed: false, reason: "co-owner-protected" };
  }
  return { allowed: true, reason: "allowed" };
}

export const LEAVE_HOUSEHOLD_CONSEQUENCE =
  "Cloud access ends immediately. Queued changes from this phone will not replay. "
  + "After the server confirms, Hearth clears this household from this phone. Rejoining needs a fresh invite.";

export function membershipReasonMessage(reason: MembershipActionDecision["reason"]): string {
  switch (reason) {
    case "last-owner":
      return "Add another co-owner before the last owner leaves.";
    case "co-owner-protected":
      return "A co-owner cannot silently remove another co-owner. That person can leave after another owner remains.";
    case "not-self":
      return "Members can revoke only their own device.";
    case "not-owner":
      return "Only a co-owner can manage household access.";
    default:
      return "";
  }
}
