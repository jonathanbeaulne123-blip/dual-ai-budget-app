import { continuityMemberId, type ContinuityIdentity } from "./continuity.ts";
import type { Household } from "./core/types.ts";

export function requireDemoSuiteContinuityIdentity(input: {
  household: Household;
  memberId: string;
  authRequired: boolean;
  authIdentity: ContinuityIdentity | null;
  fallbackIdentity: ContinuityIdentity | null;
}): ContinuityIdentity {
  const identity = input.authRequired
    ? input.authIdentity
    : input.authIdentity ?? input.fallbackIdentity;
  if (!identity || (!identity.email && !identity.subject)) {
    throw new Error("Sign in with Google first so the dedicated synthetic household can open in Hercules Pro.");
  }
  if (continuityMemberId(input.household, identity) !== input.memberId) {
    throw new Error("The signed-in Google account does not match the selected household member. Sign out, then continue with the correct account.");
  }
  return identity;
}
