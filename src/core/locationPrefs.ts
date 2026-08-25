import { DEFAULT_TIMEZONE, isValidIanaTimeZone } from "./calendar.ts";
import { detectDeviceTimeZone } from "./timeZones.ts";
import type { Environment } from "./types.ts";

/** Phone-local clock + location prefs (D-126 Q2 C / Q3–Q7). Never on the household snapshot. */
export type PhonePlacePrefs = {
  /** Display / wall-clock zone on this phone. Books civil dates stay America/Toronto. */
  displayTimeZone: string;
  locationAllowed: boolean;
  /** Q3 B: first Add already offered the enable prompt. */
  addPromptSeen: boolean;
  /** Q4 C: stamp wall time onto Add when requested. */
  stampTime: boolean;
  /** Q4 C: stamp coordinates onto Add when requested. */
  stampCoords: boolean;
  /** Q6 C: include coords in Hercules model payload when true. */
  shareCoordsWithModel: boolean;
  updatedAt: string;
};

export type LocationServicesPrefs = PhonePlacePrefs;

function key(environment: Environment): string {
  return `hearth:phonePlace:${environment}`;
}

function legacyKey(environment: Environment): string {
  return `hearth:locationServices:${environment}`;
}

function defaults(now = new Date()): PhonePlacePrefs {
  return {
    displayTimeZone: detectDeviceTimeZone(now),
    locationAllowed: false,
    addPromptSeen: false,
    stampTime: true,
    stampCoords: true,
    shareCoordsWithModel: false,
    updatedAt: new Date(0).toISOString(),
  };
}

function shape(raw: Partial<PhonePlacePrefs> | null | undefined, now = new Date()): PhonePlacePrefs {
  const base = defaults(now);
  if (!raw || typeof raw !== "object") return base;
  const zone = typeof raw.displayTimeZone === "string" && isValidIanaTimeZone(raw.displayTimeZone, now)
    ? raw.displayTimeZone.trim()
    : base.displayTimeZone;
  return {
    displayTimeZone: zone || DEFAULT_TIMEZONE,
    locationAllowed: Boolean(raw.locationAllowed),
    addPromptSeen: Boolean(raw.addPromptSeen),
    stampTime: raw.stampTime !== false,
    stampCoords: raw.stampCoords !== false,
    shareCoordsWithModel: Boolean(raw.shareCoordsWithModel),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,
  };
}

function parse(raw: string | null): PhonePlacePrefs | null {
  if (!raw) return null;
  try {
    return shape(JSON.parse(raw) as Partial<PhonePlacePrefs>);
  } catch {
    return null;
  }
}

function defaultStore(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Phone-local only. Never part of the household snapshot or hosted books. */
export function loadPhonePlacePrefs(environment: Environment, store: Storage | null = defaultStore()): PhonePlacePrefs {
  const modern = parse(store?.getItem(key(environment)) ?? null);
  if (modern) return modern;
  // Migrate the first-pass location-only key if present.
  const legacyRaw = store?.getItem(legacyKey(environment));
  if (legacyRaw) {
    try {
      const legacy = JSON.parse(legacyRaw) as { allowed?: boolean; updatedAt?: string };
      const migrated = shape({
        locationAllowed: Boolean(legacy.allowed),
        updatedAt: legacy.updatedAt,
      });
      savePhonePlacePrefs(environment, migrated, store);
      return migrated;
    } catch {
      // fall through
    }
  }
  return defaults();
}

/** @deprecated Prefer loadPhonePlacePrefs. */
export function loadLocationServicesPrefs(environment: Environment, store: Storage | null = defaultStore()): PhonePlacePrefs {
  return loadPhonePlacePrefs(environment, store);
}

export function savePhonePlacePrefs(
  environment: Environment,
  patch: Partial<PhonePlacePrefs>,
  store: Storage | null = defaultStore(),
  now = new Date(),
): PhonePlacePrefs {
  const current = loadPhonePlacePrefs(environment, store);
  const next = shape({ ...current, ...patch, updatedAt: now.toISOString() }, now);
  try {
    store?.setItem(key(environment), JSON.stringify(next));
  } catch {
    // Private mode / quota — preference stays in-memory for this session only.
  }
  return next;
}

/** @deprecated Prefer savePhonePlacePrefs. */
export function saveLocationServicesPrefs(
  environment: Environment,
  allowed: boolean,
  store: Storage | null = defaultStore(),
  now = new Date(),
): PhonePlacePrefs {
  return savePhonePlacePrefs(environment, { locationAllowed: allowed }, store, now);
}
