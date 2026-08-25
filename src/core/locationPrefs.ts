import type { Environment } from "./types.ts";

export type LocationServicesPrefs = {
  allowed: boolean;
  updatedAt: string;
};

function key(environment: Environment): string {
  return `hearth:locationServices:${environment}`;
}

function parse(raw: string | null): LocationServicesPrefs | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<LocationServicesPrefs>;
    if (typeof data.allowed !== "boolean") return null;
    return {
      allowed: data.allowed,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

/** Phone-local only. Never part of the household snapshot or hosted books. */
export function loadLocationServicesPrefs(environment: Environment, store: Storage | null = defaultStore()): LocationServicesPrefs {
  const parsed = parse(store?.getItem(key(environment)) ?? null);
  return parsed ?? { allowed: false, updatedAt: new Date(0).toISOString() };
}

export function saveLocationServicesPrefs(
  environment: Environment,
  allowed: boolean,
  store: Storage | null = defaultStore(),
  now = new Date(),
): LocationServicesPrefs {
  const next: LocationServicesPrefs = { allowed, updatedAt: now.toISOString() };
  try {
    store?.setItem(key(environment), JSON.stringify(next));
  } catch {
    // Private mode / quota — preference stays in-memory for this session only.
  }
  return next;
}

function defaultStore(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
