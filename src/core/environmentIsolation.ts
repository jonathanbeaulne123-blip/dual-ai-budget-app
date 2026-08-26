import { inviteFromText } from "./invite.ts";
import type { Environment, Household, PersonalEnvelope, SharedEnvelope } from "./types.ts";
import { ValidationError } from "./types.ts";

/** Selected environment plus optional household, invite, and member scope. */
export type IdentityBinding = {
  environment: Environment;
  householdId?: string;
  inviteCode?: string;
  memberId?: string;
};

export type IsolationBoundary =
  | "join"
  | "pass"
  | "pull"
  | "persist"
  | "import"
  | "reconcile"
  | "outbox";

function normalizedInvite(value: string | undefined | null): string {
  return inviteFromText(String(value ?? ""));
}

export function assertEnvironmentMatch(
  payloadEnvironment: Environment | undefined,
  binding: Pick<IdentityBinding, "environment">,
  boundary: IsolationBoundary,
  options: { requirePresent?: boolean } = {},
): void {
  if (!payloadEnvironment) {
    if (options.requirePresent) {
      throw new ValidationError(
        boundary === "persist"
          ? "This snapshot is missing its environment and was not saved."
          : boundary === "outbox"
            ? "This outbox entry is missing its environment and was not replayed."
            : "That payload is missing its Development/Production environment. Nothing was imported.",
      );
    }
    return;
  }
  if (payloadEnvironment !== binding.environment) {
    throw new ValidationError(
      boundary === "pull"
        ? "That shared snapshot belongs to a different Development/Production pill."
        : boundary === "pass"
          ? "That Pass belongs to a different environment. Nothing was imported."
          : boundary === "persist"
            ? "This snapshot belongs to a different environment and was not saved."
            : boundary === "outbox"
              ? "This outbox entry belongs to a different environment and was not replayed."
              : `That ${boundary} payload belongs to a different Development/Production pill.`,
    );
  }
}

export function assertHouseholdIdMatch(
  payloadHouseholdId: string | undefined,
  binding: Pick<IdentityBinding, "householdId">,
  boundary: IsolationBoundary,
): void {
  if (!binding.householdId || !payloadHouseholdId) return;
  if (payloadHouseholdId !== binding.householdId) {
    throw new ValidationError(
      boundary === "pull"
        ? "Cloud returned a different household than this phone asked for."
        : boundary === "pass"
          ? "This Pass is a different household. Export or Confirm an import from More if you mean to replace these books."
          : boundary === "outbox"
            ? "This outbox entry belongs to a different household and was not replayed."
            : "That payload belongs to a different household.",
    );
  }
}

export function assertInviteMatch(
  payloadInvite: string | undefined,
  binding: Pick<IdentityBinding, "inviteCode">,
  boundary: IsolationBoundary,
): void {
  const expected = normalizedInvite(binding.inviteCode);
  if (!expected) return;
  const actual = normalizedInvite(payloadInvite);
  if (!actual) return;
  if (actual !== expected) {
    throw new ValidationError(
      boundary === "join" || boundary === "pull"
        ? "That snapshot does not match the invite you entered. Nothing was imported."
        : "That Pass invite does not match this household. Nothing was imported.",
    );
  }
}

export function assertMemberMatch(
  payloadMemberId: string | undefined,
  binding: Pick<IdentityBinding, "memberId">,
): void {
  if (!binding.memberId || !payloadMemberId) return;
  if (payloadMemberId !== binding.memberId) {
    throw new ValidationError("That personal snapshot belongs to a different member.");
  }
}

export function assertHouseholdBinding(
  household: Household,
  binding: IdentityBinding,
  boundary: IsolationBoundary,
): Household {
  assertEnvironmentMatch(household.environment, binding, boundary, { requirePresent: true });
  assertHouseholdIdMatch(household.householdId, binding, boundary);
  assertInviteMatch(household.inviteCode, binding, boundary);
  return household;
}

export function assertSharedEnvelopeBinding(
  shared: SharedEnvelope,
  binding: IdentityBinding,
  boundary: IsolationBoundary,
): void {
  assertEnvironmentMatch(shared.environment, binding, boundary, { requirePresent: true });
  assertHouseholdIdMatch(shared.householdId, binding, boundary);
  assertInviteMatch(shared.inviteCode, binding, boundary);
}

export function assertPersonalEnvelopeBinding(
  personal: PersonalEnvelope,
  binding: IdentityBinding,
): void {
  assertMemberMatch(personal.memberId, binding);
}

export function assertPassInviteConsistency(pass: { invite: string; shared: SharedEnvelope }): void {
  const top = normalizedInvite(pass.invite);
  const shared = normalizedInvite(pass.shared.inviteCode);
  if (top && shared && top !== shared) {
    throw new ValidationError("This Hearth Pass has conflicting invite codes. Nothing was imported.");
  }
}

export function bindingForHousehold(household: Household, memberId?: string): IdentityBinding {
  return {
    environment: household.environment,
    householdId: household.householdId,
    inviteCode: household.inviteCode,
    memberId,
  };
}

export function assertOutboxItemBinding(item: {
  environment: Environment;
  householdId: string;
  memberId: string;
  /** Present for memory tips and after resolve; slim durable rows omit it (D-144). */
  snapshot?: Household;
}): void {
  const binding: IdentityBinding = {
    environment: item.environment,
    householdId: item.householdId,
    memberId: item.memberId,
    inviteCode: item.snapshot?.inviteCode,
  };
  if (!item.snapshot) {
    assertEnvironmentMatch(item.environment, binding, "outbox", { requirePresent: true });
    assertHouseholdIdMatch(item.householdId, binding, "outbox");
    return;
  }
  assertEnvironmentMatch(item.snapshot.environment, binding, "outbox", { requirePresent: true });
  assertHouseholdIdMatch(item.snapshot.householdId, binding, "outbox");
}
