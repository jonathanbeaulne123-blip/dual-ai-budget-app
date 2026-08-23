import { TIMEZONE } from "./calendar.ts";
import type { HouseholdKitchen, OpenShift, OpenShiftStatus } from "./types.ts";

/** One household punch clock. Hours are a live preview until sign-out Confirm. */
export function shapeOpenShift(input?: Partial<OpenShift> | null): OpenShift | null {
  if (!input || typeof input !== "object") return null;
  const memberId = String(input.memberId || "").trim();
  const startedAt = String(input.startedAt || "").trim();
  const updatedAt = String(input.updatedAt || startedAt || "").trim();
  const status: OpenShiftStatus = input.status === "cleared" ? "cleared" : input.status === "open" ? "open" : "cleared";
  if (!memberId || !startedAt || Number.isNaN(Date.parse(startedAt))) return null;
  return { memberId, startedAt, updatedAt: updatedAt || startedAt, status };
}

export function activeOpenShift(kitchen?: Pick<HouseholdKitchen, "openShift"> | null): OpenShift | null {
  const row = kitchen?.openShift ?? null;
  if (!row || row.status !== "open") return null;
  return row;
}

export function mergeOpenShift(server: OpenShift | null, client: OpenShift | null): OpenShift | null {
  if (!server) return client;
  if (!client) return server;
  return (client.updatedAt || "") >= (server.updatedAt || "") ? client : server;
}

/** Exact elapsed hours in America/Toronto wall time, two decimals. Not posted. */
export function previewHoursExact(startedAt: string, nowMs = Date.now()): number {
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return 0;
  const hours = Math.max(0, (nowMs - start) / 3_600_000);
  return Math.round(hours * 100) / 100;
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
