import type { GoogleBridgeLink, GoogleService, Household, HouseholdGoogle, Tombstone } from "./types.ts";
import { ValidationError } from "./types.ts";

export type { GoogleService };

export const GOOGLE_SERVICES: GoogleService[] = ["identity", "calendar", "drive", "contacts", "gmail", "sheets"];
export const DEFAULT_GOOGLE_SERVICES: GoogleService[] = ["identity", "calendar"];
export const SENSITIVE_GOOGLE_SERVICES: GoogleService[] = ["drive", "contacts", "gmail", "sheets"];

export const GOOGLE_SERVICE_COPY: Record<GoogleService, { label: string; summary: string; sensitive: boolean }> = {
  identity: {
    label: "Google sign-in",
    summary: "Name and email so Hearth knows which person you are.",
    sensitive: false,
  },
  calendar: {
    label: "Calendar",
    summary: "Month overlay and bill reminders. Google never posts money.",
    sensitive: false,
  },
  drive: {
    label: "Drive (Hearth files only)",
    summary: "Hearth-owned files only: sit-down workbook and desk look. Not your whole Drive.",
    sensitive: true,
  },
  contacts: {
    label: "Contacts",
    summary: "Read names to match the household. Not a phone backup.",
    sensitive: true,
  },
  gmail: {
    label: "Gmail (read-only)",
    summary: "Hearth may read mail when a feature needs it. It never posts money from an email.",
    sensitive: true,
  },
  sheets: {
    label: "Sheets (read-only)",
    summary: "Not the old budget workbook. The books stay in Postgres.",
    sensitive: true,
  },
};

export const EMPTY_GOOGLE: HouseholdGoogle = {
  links: [],
  enabledServices: [...DEFAULT_GOOGLE_SERVICES],
  updatedAt: "",
};

export function isGoogleService(value: string): value is GoogleService {
  return (GOOGLE_SERVICES as string[]).includes(value);
}

export function uniqueGoogleServices(services: Iterable<string>): GoogleService[] {
  const wanted = new Set<string>();
  for (const service of services) {
    if (isGoogleService(service)) wanted.add(service);
  }
  wanted.add("identity");
  return GOOGLE_SERVICES.filter((service) => wanted.has(service));
}

export function normalizeGoogleEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function googleLinkTombstoneId(memberId: string): string {
  return `GGL-${memberId}`;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function isLink(value: unknown): value is GoogleBridgeLink {
  if (!value || typeof value !== "object") return false;
  const link = value as GoogleBridgeLink;
  return Boolean(link.memberId && typeof link.email === "string");
}

export function shapeGoogleLink(input: Partial<GoogleBridgeLink> & Pick<GoogleBridgeLink, "memberId">): GoogleBridgeLink {
  const linkedAt = input.linkedAt || input.updatedAt || "";
  return {
    memberId: input.memberId,
    email: normalizeGoogleEmail(input.email ?? ""),
    subject: (input.subject ?? "").trim(),
    displayName: (input.displayName ?? "").trim(),
    linkedAt,
    lastConfirmedAt: input.lastConfirmedAt || linkedAt,
    grantedScopes: asStringArray(input.grantedScopes),
    updatedAt: input.updatedAt || linkedAt,
    active: input.active !== false,
  };
}

export function shapeGoogle(input?: Partial<HouseholdGoogle> | null): HouseholdGoogle {
  const links = Array.isArray(input?.links)
    ? input.links.filter(isLink).map((link) => shapeGoogleLink(link))
    : [];
  const byMember = new Map<string, GoogleBridgeLink>();
  for (const link of links) {
    const existing = byMember.get(link.memberId);
    if (!existing || link.updatedAt >= existing.updatedAt) byMember.set(link.memberId, link);
  }
  return {
    links: [...byMember.values()].sort((left, right) => left.memberId.localeCompare(right.memberId)),
    enabledServices: uniqueGoogleServices(input?.enabledServices ?? DEFAULT_GOOGLE_SERVICES),
    updatedAt: input?.updatedAt || "",
  };
}

export function mergeGoogle(
  server: HouseholdGoogle | undefined,
  client: HouseholdGoogle | undefined,
  tombstones: Tombstone[],
): HouseholdGoogle {
  const left = shapeGoogle(server);
  const right = shapeGoogle(client);
  const dead = new Map<string, string>();
  for (const tombstone of tombstones) {
    if (tombstone.id.startsWith("GGL-")) dead.set(tombstone.id, tombstone.deletedAt);
  }
  const map = new Map<string, GoogleBridgeLink>();
  for (const link of [...left.links, ...right.links]) {
    const diedAt = dead.get(googleLinkTombstoneId(link.memberId));
    if (diedAt && diedAt >= (link.updatedAt || "")) continue;
    const existing = map.get(link.memberId);
    if (!existing || link.updatedAt >= existing.updatedAt) map.set(link.memberId, link);
  }
  const google = (right.updatedAt || "") >= (left.updatedAt || "") ? right : left;
  return {
    links: [...map.values()].sort((leftLink, rightLink) => leftLink.memberId.localeCompare(rightLink.memberId)),
    enabledServices: google.enabledServices,
    updatedAt: google.updatedAt,
  };
}

export function findGoogleLink(household: Household, memberId: string): GoogleBridgeLink | undefined {
  return shapeGoogle(household.google).links.find((link) => link.memberId === memberId);
}

export function findActiveGoogleLink(household: Household, memberId: string): GoogleBridgeLink | undefined {
  const link = findGoogleLink(household, memberId);
  return link?.active ? link : undefined;
}

export function findActiveGoogleLinkByEmail(household: Household, email: string): GoogleBridgeLink | undefined {
  const needle = normalizeGoogleEmail(email);
  if (!needle) return undefined;
  return shapeGoogle(household.google).links.find((link) => link.active && link.email === needle);
}

export function findActiveGoogleLinkBySubject(household: Household, subject: string): GoogleBridgeLink | undefined {
  const needle = subject.trim();
  if (!needle) return undefined;
  return shapeGoogle(household.google).links.find((link) => link.active && link.subject === needle);
}

export function memberNeedsGoogleStepUp(household: Household, memberId: string): boolean {
  return Boolean(findActiveGoogleLink(household, memberId));
}

export function assertServicesAllowed(enabled: Iterable<string>, requested: Iterable<string>): GoogleService[] {
  const allowed = new Set(uniqueGoogleServices(enabled));
  const needed = uniqueGoogleServices(requested);
  const blocked = needed.filter((service) => !allowed.has(service));
  if (blocked[0]) {
    const copy = GOOGLE_SERVICE_COPY[blocked[0]];
    throw new ValidationError(`${copy.label} is off for this household. Turn it on in More → Google household bridge first.`);
  }
  return needed;
}

export function scopesMissing(granted: Iterable<string>, needed: Iterable<string>): string[] {
  const have = new Set([...granted].map((scope) => scope.trim()).filter(Boolean));
  return [...needed].filter((scope) => scope && !have.has(scope));
}
