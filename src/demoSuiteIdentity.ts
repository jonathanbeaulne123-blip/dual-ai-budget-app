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

/**
 * The seat the person pressing "Create Demo Suite" (or a habitat) takes in the
 * generated household. The showcase keeps its own two members and their fixed
 * ids so the seed replays byte-for-byte; the person steps into the seat with
 * their name, or into Jonathan's (`MEM-002`) when no name matches. Replacing an
 * existing fixture keeps the seat they already hold. Never a seat that is not in
 * the household — that is what "Household member is no longer active" meant when
 * a household with its own member ids pressed the button.
 */
export function demoSuiteSeatFor(current: Household, memberId: string, generated: Household): string {
  const active = generated.members.filter((row) => row.active);
  if (current.syntheticFixture?.kind === "hearth-demo-suite" && active.some((row) => row.id === memberId)) return memberId;
  const name = (current.members.find((row) => row.id === memberId)?.name ?? "").trim().toLowerCase();
  const byName = name ? active.find((row) => row.name.trim().toLowerCase() === name) : undefined;
  const seat = byName ?? active.find((row) => row.id === "MEM-002") ?? active[0];
  if (!seat) throw new Error("The synthetic household has no active member to step into.");
  return seat.id;
}
