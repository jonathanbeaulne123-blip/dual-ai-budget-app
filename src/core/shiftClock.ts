import { TIMEZONE } from "./calendar.ts";
import type { HouseholdKitchen, OpenShift, OpenShiftStatus, ShiftBreak } from "./types.ts";

function validIso(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function shapeBreak(input: Partial<ShiftBreak>, index: number, fallbackIso: string): ShiftBreak | null {
  if (!validIso(input.startedAt)) return null;
  const endedAt = validIso(input.endedAt) && Date.parse(input.endedAt) >= Date.parse(input.startedAt) ? input.endedAt : null;
  return {
    id: String(input.id || `BREAK-${index + 1}-${input.startedAt}`),
    kind: input.kind === "paid" || input.kind === "custom" ? input.kind : "unpaid",
    label: String(input.label || (input.kind === "paid" ? "Paid break" : "Break")).trim().slice(0, 40),
    startedAt: input.startedAt,
    endedAt,
    updatedAt: validIso(input.updatedAt) ? input.updatedAt : endedAt || input.startedAt || fallbackIso,
  };
}

/** Legacy single punches receive a stable id and become member-keyed rows during shaping. */
export function shapeOpenShift(input?: Partial<OpenShift> | null): OpenShift | null {
  if (!input || typeof input !== "object") return null;
  const memberId = String(input.memberId || "").trim();
  const startedAt = String(input.startedAt || "").trim();
  const updatedAt = String(input.updatedAt || startedAt || "").trim();
  const status: OpenShiftStatus = input.status === "cleared" ? "cleared" : input.status === "confirming" ? "confirming" : input.status === "open" ? "open" : "cleared";
  if (!memberId || !startedAt || Number.isNaN(Date.parse(startedAt))) return null;
  const endedAt = validIso(input.endedAt) && Date.parse(input.endedAt) >= Date.parse(startedAt) ? input.endedAt : null;
  const breaks = Array.isArray(input.breaks)
    ? input.breaks.map((row, index) => shapeBreak(row, index, updatedAt || startedAt)).filter((row): row is ShiftBreak => Boolean(row))
    : [];
  return {
    id: String(input.id || `OPEN-${memberId}-${startedAt}`),
    memberId,
    startedAt,
    endedAt,
    breaks,
    scheduledItemId: String(input.scheduledItemId || "") || null,
    sourceDeviceId: String(input.sourceDeviceId || "") || null,
    updatedAt: updatedAt || startedAt,
    status,
  };
}

export function shapeOpenShifts(input?: Partial<HouseholdKitchen> | null): OpenShift[] {
  const rows = Array.isArray(input?.openShifts) ? input!.openShifts : [];
  const legacy = shapeOpenShift(input?.openShift);
  const byId = new Map<string, OpenShift>();
  for (const candidate of [...rows, ...(legacy ? [legacy] : [])]) {
    const row = shapeOpenShift(candidate);
    if (!row) continue;
    const existing = byId.get(row.id);
    if (!existing || row.updatedAt >= existing.updatedAt) byId.set(row.id, row);
  }
  return [...byId.values()].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
}

/** Active includes a clocked-out row waiting for Confirm; a worker cannot start another until it is resolved. */
export function activeOpenShift(kitchen?: Pick<HouseholdKitchen, "openShift" | "openShifts"> | null, memberId?: string): OpenShift | null {
  const rows = shapeOpenShifts(kitchen).filter((row) => row.status !== "cleared" && (!memberId || row.memberId === memberId));
  return rows.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}

export function openShiftConflicts(kitchen: Pick<HouseholdKitchen, "openShift" | "openShifts">, memberId: string): OpenShift[] {
  return shapeOpenShifts(kitchen).filter((row) => row.memberId === memberId && row.status !== "cleared");
}

export function mergeOpenShift(server: OpenShift | null, client: OpenShift | null): OpenShift | null {
  if (!server) return client;
  if (!client) return server;
  return (client.updatedAt || "") >= (server.updatedAt || "") ? client : server;
}

export function mergeOpenShifts(server: OpenShift[] | null | undefined, client: OpenShift[] | null | undefined): OpenShift[] {
  const byId = new Map<string, OpenShift>();
  for (const candidate of [...(server ?? []), ...(client ?? [])]) {
    const row = shapeOpenShift(candidate);
    if (!row) continue;
    const existing = byId.get(row.id);
    if (!existing || row.updatedAt >= existing.updatedAt) byId.set(row.id, row);
  }
  return [...byId.values()].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
}

/** Exact elapsed hours in America/Toronto wall time, two decimals. Not posted. */
export function previewHoursExact(startedAt: string, nowMs = Date.now()): number {
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return 0;
  const hours = Math.max(0, (nowMs - start) / 3_600_000);
  return Math.round(hours * 100) / 100;
}

export function openShiftElapsedHours(row: OpenShift, nowMs = Date.now()): number {
  const stop = row.endedAt ? Date.parse(row.endedAt) : nowMs;
  return previewHoursExact(row.startedAt, stop);
}

export function breakHours(row: OpenShift, kind?: "paid" | "unpaid", nowMs = Date.now()): number {
  const total = row.breaks
    .filter((item) => !kind || item.kind === kind)
    .reduce((sum, item) => {
      const end = item.endedAt ? Date.parse(item.endedAt) : row.endedAt ? Date.parse(row.endedAt) : nowMs;
      const start = Date.parse(item.startedAt);
      return sum + (Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0);
    }, 0);
  return Math.round((total / 3_600_000) * 100) / 100;
}

export function workedHoursFromOpenShift(row: OpenShift, nowMs = Date.now()): { workedHours: number; paidBreakHours: number; unpaidBreakHours: number; elapsedHours: number } {
  const elapsedHours = openShiftElapsedHours(row, nowMs);
  const paidBreakHours = breakHours(row, "paid", nowMs);
  const unpaidBreakHours = breakHours(row, "unpaid", nowMs) + row.breaks.filter((item) => item.kind === "custom").reduce((sum, item) => {
    const end = item.endedAt ? Date.parse(item.endedAt) : row.endedAt ? Date.parse(row.endedAt) : nowMs;
    return sum + Math.max(0, end - Date.parse(item.startedAt)) / 3_600_000;
  }, 0);
  return {
    elapsedHours,
    paidBreakHours,
    unpaidBreakHours: Math.round(unpaidBreakHours * 100) / 100,
    workedHours: Math.max(0, Math.round((elapsedHours - paidBreakHours - unpaidBreakHours) * 100) / 100),
  };
}

/** Restaurant quarter-hour for the sign-out pad. Still a preview until Confirm. */
export function previewHoursQuarter(startedAt: string, nowMs = Date.now()): number {
  return Math.round(previewHoursExact(startedAt, nowMs) * 4) / 4;
}

export function formatPreviewHours(hours: number): string {
  const safe = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  return safe.toFixed(2);
}

export function previewHoursLabel(startedAt: string, nowMs = Date.now()): string {
  const exact = previewHoursExact(startedAt, nowMs);
  const quarter = previewHoursQuarter(startedAt, nowMs);
  if (exact < 0.01) return "just punched in";
  const clock = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(startedAt));
  return `${formatPreviewHours(exact)} h since ${clock} · pad ${formatPreviewHours(quarter)} h`;
}

export type ShiftGate = "choose" | "clocked" | "signOut" | "finished";
export type ShiftField = "sales" | "hours" | "cashTips" | "ccTips";

export const SIGN_OUT_FIELDS: ShiftField[] = ["hours", "sales", "cashTips", "ccTips"];
export const FINISHED_FIELDS: ShiftField[] = ["sales", "cashTips", "ccTips", "hours"];

export function ceremonyFields(gate: ShiftGate): ShiftField[] {
  if (gate === "signOut") return SIGN_OUT_FIELDS;
  if (gate === "finished") return FINISHED_FIELDS;
  return [];
}

export function shiftFieldLabel(field: ShiftField): string {
  if (field === "hours") return "Hours";
  if (field === "sales") return "Sales";
  if (field === "cashTips") return "Cash tips";
  return "Credit-card tips";
}

export function isLastCeremonyStep(gate: ShiftGate, index: number): boolean {
  const fields = ceremonyFields(gate);
  return fields.length > 0 && index >= fields.length - 1;
}

export function ceremonyCopy(gate: ShiftGate, field?: ShiftField): { title: string; hint: string } {
  if (gate === "choose") {
    return {
      title: "Add shift",
      hint: "Clock in starts a preview. Hours post when you sign out and Confirm. Already off skips the punch clock.",
    };
  }
  if (gate === "clocked") {
    return {
      title: "On the clock",
      hint: "Hours are a live preview. Sign out when you know them. Never mind wipes the punch — it is not a reverse.",
    };
  }
  if (gate === "signOut") {
    if (field === "hours") {
      return {
        title: "Confirm hours",
        hint: "The pad is the preview, rounded to a quarter hour. Change it if the clock is wrong. Then sales and tips.",
      };
    }
    return {
      title: "Sign out",
      hint: "Tip math uses the same postShift path. Confirm still writes.",
    };
  }
  if (field === "hours") {
    return {
      title: "Hours last",
      hint: "You already know sales and tips. Hours are the last confirmation, not a guess of 4.00.",
    };
  }
  return {
    title: "Finished shift",
    hint: "Sales, cash, then credit-card tips. Hours wait until you know them.",
  };
}
