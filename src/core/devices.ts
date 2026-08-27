import type { Environment, HouseholdDevice } from "./types.ts";

const DEVICE_ID_KEY = "hearth.device.id";

function randomDeviceId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return `DEV-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function localDeviceId(storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void }): string {
  const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
  if (!store) return randomDeviceId();
  const existing = store.getItem(DEVICE_ID_KEY);
  if (existing && existing.startsWith("DEV-")) return existing;
  const id = randomDeviceId();
  store.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function describeDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Kitchen phone";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad/i.test(ua)) return "iPhone / iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "This device";
}

export function shapeDevices(list: HouseholdDevice[] | undefined, fallbackIso: string): HouseholdDevice[] {
  return (list ?? []).filter((row) => row && typeof row.id === "string" && row.id).map((row) => {
    const seenAt = row.seenAt || row.updatedAt || fallbackIso;
    return {
      id: row.id,
      label: String(row.label || "Device").slice(0, 48),
      memberId: typeof row.memberId === "string" && row.memberId ? row.memberId : null,
      environment: row.environment === "production" ? "production" : "development",
      seenAt,
      updatedAt: row.updatedAt || seenAt,
      active: row.active !== false,
    };
  });
}

export function mergeDevices(server: HouseholdDevice[], client: HouseholdDevice[]): HouseholdDevice[] {
  const map = new Map<string, HouseholdDevice>();
  for (const row of [...server, ...client]) {
    if (!row?.id) continue;
    const existing = map.get(row.id);
    if (!existing || (row.updatedAt || "") >= (existing.updatedAt || "")) map.set(row.id, row);
  }
  // Keep inactive rows so opt-out / forget can LWW-propagate to partners (T3-S2).
  // UI and soft-presence peers filter active === false.
  return [...map.values()].sort((a, b) => b.seenAt.localeCompare(a.seenAt));
}

export function touchDevicePresence(input: {
  devices: HouseholdDevice[];
  deviceId: string;
  label: string;
  memberId: string | null;
  environment: Environment;
  at?: string;
}): HouseholdDevice[] {
  const at = input.at ?? new Date().toISOString();
  const next: HouseholdDevice = {
    id: input.deviceId,
    label: input.label.slice(0, 48),
    memberId: input.memberId,
    environment: input.environment,
    seenAt: at,
    updatedAt: at,
    active: true,
  };
  return mergeDevices(input.devices, [next]);
}
