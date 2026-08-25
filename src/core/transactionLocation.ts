import type { TransactionLocation } from "./types.ts";

const MAX_ABS_LAT = 90;
const MAX_ABS_LNG = 180;

export function shapeTransactionLocation(raw: unknown): TransactionLocation | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const row = raw as Partial<TransactionLocation>;
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  if (Math.abs(latitude) > MAX_ABS_LAT || Math.abs(longitude) > MAX_ABS_LNG) return undefined;
  const capturedAt = typeof row.capturedAt === "string" && row.capturedAt.trim() ? row.capturedAt.trim() : null;
  if (!capturedAt || Number.isNaN(Date.parse(capturedAt))) return undefined;
  const accuracyMeters =
    row.accuracyMeters == null
      ? undefined
      : Number(row.accuracyMeters);
  const label = typeof row.label === "string" ? row.label.trim() : "";
  const out: TransactionLocation = {
    latitude,
    longitude,
    capturedAt,
  };
  if (Number.isFinite(accuracyMeters) && (accuracyMeters as number) >= 0) {
    out.accuracyMeters = accuracyMeters as number;
  }
  if (label) out.label = label;
  return out;
}

export function locationLabel(location: Pick<TransactionLocation, "latitude" | "longitude" | "label">): string {
  if (location.label?.trim()) return location.label.trim();
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
}

export function scrubLocationForModel(location: TransactionLocation | undefined): undefined {
  void location;
  return undefined;
}
