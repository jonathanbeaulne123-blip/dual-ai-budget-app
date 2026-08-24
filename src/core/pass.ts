import { inviteFromText, isValidInviteToken } from "./invite.ts";
import { assembleHousehold, emptyPersonal, ensureHouseholdShape, splitForSync } from "./sync.ts";
import { moneyFactsChanged } from "./conflict.ts";
import type { Environment, Household, SharedEnvelope } from "./types.ts";
import { ValidationError } from "./types.ts";

export type HearthPass = {
  kind: "hearth-pass";
  version: 1;
  invite: string;
  shared: SharedEnvelope;
};

export function isHearthPass(value: unknown): value is HearthPass {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.kind === "hearth-pass" && record.version === 1 && typeof record.invite === "string" && Boolean(record.shared);
}

export function makeHearthPass(household: Household): HearthPass {
  const shaped = ensureHouseholdShape(household);
  const memberId = shaped.members.find((member) => member.active)?.id ?? shaped.members[0]?.id ?? "pending";
  const { shared } = splitForSync(shaped, memberId);
  return {
    kind: "hearth-pass",
    version: 1,
    invite: inviteFromText(shaped.inviteCode),
    shared: { ...shared, inviteCode: inviteFromText(shaped.inviteCode) },
  };
}

export function parseHearthPass(raw: string): HearthPass {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError("That does not look like a Hearth Pass. Ask for the file or the three-word phrase.");
  }
  if (!isHearthPass(parsed)) {
    throw new ValidationError("That file is not a Hearth Pass.");
  }
  if (!isValidInviteToken(parsed.invite) && !isValidInviteToken(parsed.shared.inviteCode)) {
    throw new ValidationError("This Hearth Pass is missing a usable household phrase.");
  }
  return parsed;
}

export function applyHearthPass(
  local: Household | null,
  pass: HearthPass,
  memberId?: string,
  operatingEnvironment?: Environment,
): Household {
  const invite = inviteFromText(pass.invite || pass.shared.inviteCode);
  const shared: SharedEnvelope = { ...pass.shared, inviteCode: invite, kind: "shared" };
  if (operatingEnvironment && shared.environment && shared.environment !== operatingEnvironment) {
    throw new ValidationError("That Pass belongs to a different environment. Nothing was imported.");
  }
  if (!local) {
    const assembled = assembleHousehold(shared, emptyPersonal(memberId || "pending"), { linked: false });
    if (operatingEnvironment) assembled.environment = operatingEnvironment;
    return assembled;
  }
  if (shared.environment && shared.environment !== local.environment) {
    throw new ValidationError("That Pass belongs to a different environment. Nothing was imported.");
  }
  const who = memberId || local.members.find((member) => member.active)?.id || "pending";
  if (local.householdId && shared.householdId && local.householdId === shared.householdId) {
    const localParts = splitForSync(local, who);
    if (
      moneyFactsChanged(
        {
          transactions: localParts.shared.transactions,
          shifts: localParts.shared.shifts,
          claims: localParts.shared.claims ?? [],
          sitDownSessions: localParts.shared.sitDownSessions ?? [],
        },
        {
          transactions: shared.transactions,
          shifts: shared.shifts,
          claims: shared.claims ?? [],
          sitDownSessions: shared.sitDownSessions ?? [],
        },
      )
    ) {
      throw new ValidationError(
        "This Pass has different journal facts than this phone. Import with Confirm from More, or keep the books already here.",
      );
    }
    const overlaid: SharedEnvelope = {
      ...shared,
      environment: local.environment,
      householdId: local.householdId,
      transactions: localParts.shared.transactions,
      shifts: localParts.shared.shifts,
      claims: localParts.shared.claims,
      sitDownSessions: localParts.shared.sitDownSessions,
    };
    const assembled = assembleHousehold(overlaid, localParts.personal, { linked: local.linked === true });
    assembled.commandReceipts = local.commandReceipts ?? [];
    assembled.conflicts = local.conflicts ?? [];
    assembled.booksAcceptedHash = local.booksAcceptedHash ?? null;
    assembled.revision = local.revision;
    assembled.baseRevision = local.baseRevision;
    return assembled;
  }
  if (local.transactions.length > 0 || local.shifts.length > 0) {
    throw new ValidationError(
      "This Pass is a different household. Export or Confirm an import from More if you mean to replace these books.",
    );
  }
  return assembleHousehold(shared, emptyPersonal(who), { linked: false });
}

export function passFilename(household: Household): string {
  const invite = inviteFromText(household.inviteCode) || "household";
  return `hearth-pass-${invite}.json`;
}
