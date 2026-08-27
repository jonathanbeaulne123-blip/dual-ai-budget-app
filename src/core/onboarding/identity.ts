import type { OnboardingProgressIdentity, OnboardingShellKind } from "./types.ts";

export function buildProgressIdentity(input: {
  environment: "development" | "production";
  householdId: string;
  memberKey: string;
  registryVersion: string;
  shell: OnboardingShellKind;
}): OnboardingProgressIdentity {
  return {
    environment: input.environment,
    householdId: input.householdId,
    memberKey: input.memberKey,
    registryVersion: input.registryVersion,
    shell: input.shell,
  };
}

/** Stable storage key — never includes amounts, notes, or journal content. */
export function progressStorageKey(identity: OnboardingProgressIdentity): string {
  const parts = [
    "hearth:onboarding:v1",
    identity.environment,
    encodeURIComponent(identity.householdId),
    encodeURIComponent(identity.memberKey),
    encodeURIComponent(identity.registryVersion),
    identity.shell,
  ];
  return parts.join(":");
}

/**
 * Concept progress is shared across phone/desktop for the same member.
 * Layout-only lessons stay shell-specific via the full identity key.
 */
export function conceptProgressKey(identity: OnboardingProgressIdentity): string {
  const parts = [
    "hearth:onboarding-concept:v1",
    identity.environment,
    encodeURIComponent(identity.householdId),
    encodeURIComponent(identity.memberKey),
    encodeURIComponent(identity.registryVersion),
  ];
  return parts.join(":");
}

export function identitiesMatch(
  a: OnboardingProgressIdentity,
  b: OnboardingProgressIdentity,
): boolean {
  return (
    a.environment === b.environment &&
    a.householdId === b.householdId &&
    a.memberKey === b.memberKey &&
    a.registryVersion === b.registryVersion &&
    a.shell === b.shell
  );
}

export function sameMemberHousehold(
  a: OnboardingProgressIdentity,
  b: Pick<OnboardingProgressIdentity, "environment" | "householdId" | "memberKey">,
): boolean {
  return (
    a.environment === b.environment &&
    a.householdId === b.householdId &&
    a.memberKey === b.memberKey
  );
}
