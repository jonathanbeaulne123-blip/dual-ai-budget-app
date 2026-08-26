import type { RigClip } from "./types.ts";

const clipRegistry = new Map<string, RigClip>();

export function registerRigClip(clip: RigClip): void {
  clipRegistry.set(clip.id, clip);
}

export function unregisterRigClip(id: string): void {
  clipRegistry.delete(id);
}

export function getRigClip(id: string): RigClip | undefined {
  return clipRegistry.get(id);
}

export function listRigClips(): RigClip[] {
  return [...clipRegistry.values()];
}

export function clearRigClipRegistry(): void {
  clipRegistry.clear();
}

/** Seed built-in clips. Safe to call multiple times. */
export function installBuiltinClips(clips: Record<string, RigClip> | RigClip[]): void {
  const rows = Array.isArray(clips) ? clips : Object.values(clips);
  for (const clip of rows) registerRigClip(clip);
}
