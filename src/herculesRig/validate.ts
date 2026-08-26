import type { HerculesRigCommand, HerculesRigPose, RigPartId, RigPartTransform, RigSnapshot } from "./types.ts";
import { RIG_PARTS } from "./parts.ts";

export const HERCULES_RIG_PATH = "/hercules/rig";
export const HERCULES_RIG_POLL_PATH = "/hercules/rig/poll";
export const MAX_RIG_COMMANDS = 16;
export const MAX_RIG_QUEUE = 64;

const POSES: HerculesRigPose[] = [
  "loaf", "walk", "jump", "stretch", "wash", "sleep", "hide",
  "pace", "celebrate", "pounce", "perch", "lick", "bump", "attack",
  "sit", "beg", "bag",
];

const PARTS = new Set<RigPartId>(RIG_PARTS);
const POSE_SET = new Set<string>(POSES);
const COMMAND_TYPES = new Set([
  "setPart", "setParts", "playPose", "playClip", "blendTo",
  "clearOverrides", "clearOverride", "queue", "wait", "reset",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
}

function sanitizeTransform(raw: unknown): RigPartTransform | null {
  if (!isObject(raw)) return null;
  const out: RigPartTransform = {};
  const rotate = boundedNumber(raw.rotate, -180, 180);
  const translateX = boundedNumber(raw.translateX, -120, 120);
  const translateY = boundedNumber(raw.translateY, -120, 120);
  const scaleX = boundedNumber(raw.scaleX, 0.2, 2.5);
  const scaleY = boundedNumber(raw.scaleY, 0.2, 2.5);
  const opacity = boundedNumber(raw.opacity, 0, 1);
  if (rotate != null) out.rotate = rotate;
  if (translateX != null) out.translateX = translateX;
  if (translateY != null) out.translateY = translateY;
  if (scaleX != null) out.scaleX = scaleX;
  if (scaleY != null) out.scaleY = scaleY;
  if (opacity != null) out.opacity = opacity;
  if (typeof raw.visible === "boolean") out.visible = raw.visible;
  return Object.keys(out).length ? out : null;
}

function sanitizeCommand(raw: unknown, depth = 0): HerculesRigCommand | null {
  if (depth > 4 || !isObject(raw) || typeof raw.type !== "string" || !COMMAND_TYPES.has(raw.type)) return null;
  switch (raw.type) {
    case "setPart": {
      if (typeof raw.part !== "string" || !PARTS.has(raw.part as RigPartId)) return null;
      const transform = sanitizeTransform(raw.transform);
      if (!transform) return null;
      const holdMs = boundedNumber(raw.holdMs, 0, 30_000);
      return { type: "setPart", part: raw.part as RigPartId, transform, ...(holdMs != null ? { holdMs } : {}) };
    }
    case "setParts": {
      if (!isObject(raw.parts)) return null;
      const parts: Partial<RigSnapshot> = {};
      for (const [part, transform] of Object.entries(raw.parts)) {
        if (!PARTS.has(part as RigPartId)) return null;
        const clean = sanitizeTransform(transform);
        if (!clean) return null;
        parts[part as RigPartId] = clean as RigPartTransform;
      }
      if (!Object.keys(parts).length) return null;
      const holdMs = boundedNumber(raw.holdMs, 0, 30_000);
      return { type: "setParts", parts, ...(holdMs != null ? { holdMs } : {}) };
    }
    case "playPose": {
      if (typeof raw.pose !== "string" || !POSE_SET.has(raw.pose)) return null;
      return { type: "playPose", pose: raw.pose as HerculesRigPose, loop: raw.loop === false ? false : true };
    }
    case "playClip": {
      if (typeof raw.clipId !== "string" || !/^[a-z0-9][a-z0-9._-]{0,47}$/i.test(raw.clipId)) return null;
      return { type: "playClip", clipId: raw.clipId, loop: raw.loop === true };
    }
    case "blendTo": {
      if (!isObject(raw.parts)) return null;
      const durationMs = boundedNumber(raw.durationMs, 16, 5000);
      if (durationMs == null) return null;
      const parts: Partial<RigSnapshot> = {};
      for (const [part, transform] of Object.entries(raw.parts)) {
        if (!PARTS.has(part as RigPartId)) return null;
        const clean = sanitizeTransform(transform);
        if (!clean) return null;
        parts[part as RigPartId] = clean as RigPartTransform;
      }
      if (!Object.keys(parts).length) return null;
      const ease = raw.ease === "linear" || raw.ease === "easeOut" || raw.ease === "spring" ? raw.ease : "easeInOut";
      return { type: "blendTo", parts, durationMs, ease };
    }
    case "clearOverrides":
      return { type: "clearOverrides" };
    case "clearOverride":
      if (typeof raw.part !== "string" || !PARTS.has(raw.part as RigPartId)) return null;
      return { type: "clearOverride", part: raw.part as RigPartId };
    case "queue": {
      if (!Array.isArray(raw.commands)) return null;
      const commands = raw.commands
        .map((item) => sanitizeCommand(item, depth + 1))
        .filter((item): item is HerculesRigCommand => item != null)
        .slice(0, MAX_RIG_COMMANDS);
      if (!commands.length) return null;
      return { type: "queue", commands };
    }
    case "wait": {
      const ms = boundedNumber(raw.ms, 0, 10_000);
      if (ms == null) return null;
      return { type: "wait", ms };
    }
    case "reset":
      return { type: "reset" };
    default:
      return null;
  }
}

export function sanitizeRigSessionId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(trimmed)) return null;
  return trimmed;
}

export function validateRigCommands(raw: unknown): HerculesRigCommand[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => sanitizeCommand(item))
    .filter((item): item is HerculesRigCommand => item != null)
    .slice(0, MAX_RIG_COMMANDS);
}

export function validateRigPayload(body: unknown): { sessionId: string; commands: HerculesRigCommand[] } | null {
  if (!isObject(body)) return null;
  const sessionId = sanitizeRigSessionId(body.sessionId);
  if (!sessionId) return null;
  const commands = validateRigCommands(body.commands);
  if (!commands.length) return null;
  return { sessionId, commands };
}
