import { TIMEZONE } from "./calendar.ts";
import { charterActivePermissions, charterCeilingLabel } from "./charter.ts";
import type { HouseholdCharter, Member } from "./types.ts";

export const SIGNATURE_VIEW = { ruleWidth: 260, ruleGap: 10, nameSize: 12 } as const;

export const CHARTER_SPLIT_HEADING = {
  even: "Evenly",
  proportional: "By what we each earn",
  remainder: "One of us covers what's left",
} as const;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type CharterSignatureLine = {
  memberId: string;
  name: string;
  signedAt: string | null;
};

export function signatureLines(
  charter: HouseholdCharter,
  members: readonly Pick<Member, "id" | "name">[],
): CharterSignatureLine[] {
  const names = new Map(members.map((member) => [member.id, member.name]));
  return charter.signatures.map((signature) => ({
    memberId: signature.memberId,
    name: names.get(signature.memberId) ?? signature.memberId,
    signedAt: signature.signedAt,
  }));
}

export function charterSignatureDateLabel(signedAt: string, timeZone: string = TIMEZONE): string {
  const date = new Date(signedAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function charterCadenceLabel(charter: HouseholdCharter): string {
  if (charter.cadence === "none") return "We don't yet.";
  const weekday = WEEKDAYS[charter.cadenceWeekday] ?? "Sunday";
  if (charter.cadence === "weekly") return `Every ${weekday}.`;
  if (charter.cadence === "biweekly") return `Every other ${weekday}.`;
  return "Monthly.";
}

export function charterCustodianLine(name: string): string {
  return `${name} holds the money. Hearth can't move it.`;
}

export function charterPermissionSentences(charter: HouseholdCharter) {
  return charterActivePermissions(charter);
}

export type CharterAmendmentLine = {
  id: string;
  body: string;
  note: string;
};

export function charterAmendmentLines(
  charter: HouseholdCharter,
  members: readonly Pick<Member, "id" | "name">[],
): CharterAmendmentLine[] {
  const names = new Map(members.map((member) => [member.id, member.name]));
  return [...charter.amendments]
    .sort((left, right) => right.raisedAt.localeCompare(left.raisedAt) || right.id.localeCompare(left.id))
    .map((amendment) => {
      const raiser = names.get(amendment.raisedByMemberId) ?? amendment.raisedByMemberId;
      const date = charterSignatureDateLabel(amendment.resolvedAt ?? amendment.raisedAt);
      if (amendment.confirmedByMemberId) {
        const confirmer = names.get(amendment.confirmedByMemberId) ?? amendment.confirmedByMemberId;
        return {
          id: amendment.id,
          body: `${confirmer} confirmed a change to ${amendment.field} on ${date}.`,
          note: "",
        };
      }
      if (amendment.heldByMemberId) {
        const holder = names.get(amendment.heldByMemberId) ?? amendment.heldByMemberId;
        return {
          id: amendment.id,
          body: `${holder} held this on ${charterSignatureDateLabel(amendment.raisedAt)}.`,
          note: amendment.heldNote,
        };
      }
      return {
        id: amendment.id,
        body: `${raiser} raised a change to ${amendment.field} on ${charterSignatureDateLabel(amendment.raisedAt)}.`,
        note: "",
      };
    });
}

export function charterPageCeilingLabel(charter: HouseholdCharter): string {
  return charterCeilingLabel(charter);
}
