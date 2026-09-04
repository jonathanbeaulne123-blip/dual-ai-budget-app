import { ValidationError, type Household, type LandingSurface, type Member } from "./types.ts";

export const LANDING_SURFACES = ["desk", "till"] as const satisfies readonly LandingSurface[];

export function isLandingSurface(value: unknown): value is LandingSurface {
  return value === "desk" || value === "till";
}

export function requireLandingSurface(value: unknown): LandingSurface {
  if (!isLandingSurface(value)) throw new ValidationError("Choose the desk or the Till as your landing surface.");
  return value;
}

export function memberWithoutLandingSurface(member: Member): Member {
  const {
    landingSurface: _personal,
    landingSurfaceUpdatedAt: _personalUpdatedAt,
    fundRail: _personalFundRail,
    onboardingProgress: _personalOnboardingProgress,
    glanceAccountId: _personalGlanceAccountId,
    glanceAccountUpdatedAt: _personalGlanceAccountUpdatedAt,
    fundCardAccountId: _personalFundCardAccountId,
    fundCardAccountUpdatedAt: _personalFundCardAccountUpdatedAt,
    ...sharedMember
  } = member;
  return sharedMember;
}

export function landingSurfaceForMember(household: Household, memberId: string): LandingSurface {
  const member = household.members.find((row) => row.id === memberId);
  if (isLandingSurface(member?.landingSurface)) return member.landingSurface;
  return household.householdFund?.custodianMemberId === memberId ? "till" : "desk";
}

export function cloneHousehold(household: Household): Household {
  return structuredClone(household);
}
