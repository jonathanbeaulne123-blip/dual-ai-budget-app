import {
  DEFAULT_LOOK,
  defaultLayout,
  parseOfficeLayout,
  parseOfficeLook,
  type OfficeLayout,
  type OfficeLook,
} from "./officeLayout.ts";
import type { Environment } from "./types.ts";

export const DESK_FILE_NAME = "Hearth desk.json";

export type DeskSyncPayload = {
  v: 1;
  look: OfficeLook;
  phone: OfficeLayout;
  wide: OfficeLayout;
  savedAt: string;
};

export function deskFileIdKey(environment: Environment, memberId: string): string {
  return `hearth.desk.drive.${environment}.${memberId}`;
}

export function parseDeskSyncPayload(raw: unknown): DeskSyncPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.v !== 1) return null;
  if ("householdId" in record) {
    /* Identity is the Google account. Never require a household id to restore a desk. */
  }
  const look = parseOfficeLook(record.look ?? DEFAULT_LOOK);
  const phone = layoutForDeskSync(parseOfficeLayout(record.phone ?? defaultLayout()));
  const wide = layoutForDeskSync(parseOfficeLayout(record.wide ?? defaultLayout()));
  const savedAt = typeof record.savedAt === "string" && record.savedAt ? record.savedAt : new Date().toISOString();
  return { v: 1, look, phone, wide, savedAt };
}

export function layoutForDeskSync(layout: OfficeLayout): OfficeLayout {
  return parseOfficeLayout({ ...layout, expanded: null });
}

export function buildDeskSyncPayload(input: {
  look: OfficeLook;
  phone: OfficeLayout;
  wide: OfficeLayout;
  savedAt?: string;
}): DeskSyncPayload {
  return {
    v: 1,
    look: parseOfficeLook(input.look),
    phone: layoutForDeskSync(input.phone),
    wide: layoutForDeskSync(input.wide),
    savedAt: input.savedAt ?? new Date().toISOString(),
  };
}
