import { useLayoutEffect, useState } from "react";

/**
 * Comfort controls (Vision v2 §4.7, §13): independent, per-device choices for
 * the Quiet expression, celebration intensity, motion, haptics, and sound.
 * Theme stays a separate choice; choosing a rich theme never consents to
 * frequent ornament. These are device-local preferences — never account data,
 * never shared truth — and they change presentation only.
 */
export type CelebrationIntensity = "full" | "soft" | "off";
export type MotionPreference = "system" | "reduced";

export type Comfort = {
  quiet: boolean;
  celebration: CelebrationIntensity;
  motion: MotionPreference;
  haptics: boolean;
  sound: boolean;
};

export const DEFAULT_COMFORT: Comfort = { quiet: false, celebration: "full", motion: "system", haptics: true, sound: false };

export function comfortKey(environment: string): string {
  return `hearth:comfort:v1:${environment}`;
}

export function parseComfort(raw: unknown): Comfort {
  const value = raw && typeof raw === "object" ? raw as Partial<Comfort> : {};
  return {
    quiet: value.quiet === true,
    celebration: value.celebration === "soft" || value.celebration === "off" ? value.celebration : "full",
    motion: value.motion === "reduced" ? "reduced" : "system",
    haptics: value.haptics !== false,
    sound: value.sound === true,
  };
}

export function readComfort(environment: string, storage: Storage | null = safeStorage()): Comfort {
  try {
    const raw = storage?.getItem(comfortKey(environment));
    if (raw) return parseComfort(JSON.parse(raw));
    return { ...DEFAULT_COMFORT, sound: storage?.getItem(`hearth:v1:clink:${environment}`) === "on" };
  } catch {
    return DEFAULT_COMFORT;
  }
}

export function writeComfort(environment: string, comfort: Comfort, storage: Storage | null = safeStorage()): void {
  try { storage?.setItem(comfortKey(environment), JSON.stringify(comfort)); } catch { /* private browsing keeps the in-memory value */ }
}

/** Apply as root data attributes so CSS can honour each choice without colour-only meaning. */
export function applyComfort(comfort: Comfort, root: HTMLElement = document.documentElement): void {
  root.dataset.quiet = comfort.quiet ? "true" : "false";
  root.dataset.celebration = comfort.celebration;
  root.dataset.motion = comfort.motion;
  root.dataset.haptics = comfort.haptics ? "on" : "off";
  root.dataset.sound = comfort.sound ? "on" : "off";
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

const listeners = new Set<() => void>();

export function useComfort(environment: string): [Comfort, (patch: Partial<Comfort>) => void] {
  const [comfort, setComfort] = useState<Comfort>(() => readComfort(environment));
  useLayoutEffect(() => {
    const sync = () => setComfort(readComfort(environment));
    sync();
    listeners.add(sync);
    return () => { listeners.delete(sync); };
  }, [environment]);
  useLayoutEffect(() => { applyComfort(comfort); }, [comfort]);
  const update = (patch: Partial<Comfort>) => {
    const next = parseComfort({ ...readComfort(environment), ...patch });
    writeComfort(environment, next);
    for (const listener of listeners) listener();
  };
  return [comfort, update];
}
