import { IDLE_CLIPS, MOOD_PARTS, POSE_CLIPS } from "./clips.ts";
import { ease, lerpTransform } from "./math.ts";
import { EMPTY_TRANSFORM, RIG_PARTS, emptySnapshot } from "./parts.ts";
import { getRigClip, installBuiltinClips } from "./registry.ts";
import type {
  HerculesRigCommand,
  HerculesRigMood,
  HerculesRigPose,
  RigClip,
  RigEase,
  RigEngineState,
  RigListener,
  RigPartId,
  RigPartTransform,
  RigSnapshot,
} from "./types.ts";

type ActiveClip = {
  clip: RigClip;
  startedAt: number;
  loop: boolean;
};

type Override = {
  transform: RigPartTransform;
  until: number | null;
};

type Blend = {
  from: RigSnapshot;
  to: Partial<RigSnapshot>;
  startedAt: number;
  durationMs: number;
  ease: RigEase;
};

function mergeTransform(base: RigPartTransform, patch?: Partial<RigPartTransform>): RigPartTransform {
  if (!patch) return base;
  return { ...base, ...patch };
}

function sampleClip(clip: RigClip, elapsedMs: number, reducedMotion: boolean): Partial<RigSnapshot> {
  const duration = Math.max(1, clip.durationMs);
  const raw = reducedMotion ? 0 : (elapsedMs / duration);
  const time = clip.loop ? raw % 1 : Math.min(1, raw);
  const parts: Partial<RigSnapshot> = {};
  const partIds = new Set<RigPartId>();
  for (const frame of clip.keyframes) {
    for (const part of Object.keys(frame.parts) as RigPartId[]) partIds.add(part);
  }
  for (const part of partIds) {
    const framesWithPart = clip.keyframes
      .filter((frame) => frame.parts[part])
      .sort((a, b) => a.t - b.t);
    if (!framesWithPart.length) continue;
    let rightIndex = framesWithPart.findIndex((frame) => frame.t >= time);
    if (rightIndex === -1) rightIndex = framesWithPart.length - 1;
    const right = framesWithPart[rightIndex]!;
    const left = framesWithPart[Math.max(0, rightIndex - 1)]!;
    const span = right.t - left.t || 1;
    const localT = right.t === left.t ? 0 : (time - left.t) / span;
    parts[part] = lerpTransform(
      mergeTransform(EMPTY_TRANSFORM, left.parts[part]),
      mergeTransform(EMPTY_TRANSFORM, right.parts[part]),
      ease(localT, "easeInOut"),
    );
  }
  return parts;
}

function clipOwnsPart(clip: RigClip | null, part: RigPartId): boolean {
  if (!clip) return false;
  return clip.keyframes.some((frame) => frame.parts[part] != null);
}

export class HerculesRigEngine {
  private pose: HerculesRigPose = "loaf";
  private mood: HerculesRigMood = "content";
  private reducedMotion = false;
  private poseClip: ActiveClip | null = null;
  private overrides = new Map<RigPartId, Override>();
  private blend: Blend | null = null;
  private commandQueue: HerculesRigCommand[] = [];
  private waitUntil = 0;
  private listeners = new Set<RigListener>();
  private raf = 0;
  private snapshot: RigSnapshot = emptySnapshot();
  private emitting = false;

  constructor() {
    installBuiltinClips({ ...POSE_CLIPS, ...IDLE_CLIPS });
    this.playPose("loaf");
  }

  subscribe(listener: RigListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  setReducedMotion(value: boolean): void {
    if (this.reducedMotion === value) return;
    this.reducedMotion = value;
    this.emit();
  }

  setMood(mood: HerculesRigMood): void {
    if (this.mood === mood) return;
    this.mood = mood;
    this.emit();
  }

  getState(): RigEngineState {
    return {
      pose: this.pose,
      mood: this.mood,
      clipId: this.poseClip?.clip.id ?? null,
      parts: { ...this.snapshot, ...Object.fromEntries(RIG_PARTS.map((part) => [part, { ...this.snapshot[part] }])) },
      reducedMotion: this.reducedMotion,
    };
  }

  dispatch(command: HerculesRigCommand): void {
    this.commandQueue.push(command);
    this.pumpCommands();
    this.ensureLoop();
  }

  playPose(pose: HerculesRigPose, loop = true): void {
    this.pose = pose;
    const clip = POSE_CLIPS[pose];
    this.poseClip = { clip, startedAt: performance.now(), loop: loop && Boolean(clip.loop) };
    this.emit();
  }

  tick(now = performance.now()): void {
    if (now < this.waitUntil) return;
    this.pumpCommands();
    this.snapshot = this.compose(now);
    this.emit();
  }

  destroy(): void {
    if (this.raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.listeners.clear();
  }

  /** Begin the animation frame loop. */
  start(): void {
    this.tick();
    this.ensureLoop();
  }

  private ensureLoop(): void {
    if (this.raf) return;
    if (typeof requestAnimationFrame !== "function") return;
    const frame = (now: number) => {
      this.tick(now);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private emit(): void {
    if (this.emitting) return;
    this.emitting = true;
    try {
      const state = this.getState();
      for (const listener of this.listeners) listener(state);
    } finally {
      this.emitting = false;
    }
  }

  private compose(now: number): RigSnapshot {
    const base = emptySnapshot();
    for (const part of RIG_PARTS) {
      let transform = { ...EMPTY_TRANSFORM };

      if (!clipOwnsPart(this.poseClip?.clip ?? null, part) && part === "body") {
        transform = mergeTransform(transform, sampleClip(IDLE_CLIPS.breathe, now, this.reducedMotion).body);
      }
      if (!clipOwnsPart(this.poseClip?.clip ?? null, part) && part === "tail") {
        transform = mergeTransform(transform, sampleClip(IDLE_CLIPS.tail, now, this.reducedMotion).tail);
      }
      if ((part === "eye" || part === "eyeShut") && !clipOwnsPart(this.poseClip?.clip ?? null, part)) {
        const blink = sampleClip(IDLE_CLIPS.blink, now, this.reducedMotion);
        if (blink[part]) transform = mergeTransform(transform, blink[part]);
      }

      const moodParts = MOOD_PARTS[this.mood];
      if (moodParts?.[part]) transform = mergeTransform(transform, moodParts[part]);

      if (this.poseClip) {
        const elapsed = now - this.poseClip.startedAt;
        const sampled = sampleClip(this.poseClip.clip, elapsed, this.reducedMotion);
        if (sampled[part]) transform = mergeTransform(transform, sampled[part]);
      }

      if (this.blend) {
        const t = ease((now - this.blend.startedAt) / Math.max(1, this.blend.durationMs), this.blend.ease);
        const target = this.blend.to[part];
        if (target) {
          transform = lerpTransform(this.blend.from[part], mergeTransform(EMPTY_TRANSFORM, target), Math.min(1, t));
        }
        if (t >= 1) this.blend = null;
      }

      const override = this.overrides.get(part);
      if (override && (override.until == null || now < override.until)) {
        transform = mergeTransform(transform, override.transform);
      } else if (override) {
        this.overrides.delete(part);
      }

      base[part] = transform;
    }
    return base;
  }

  private pumpCommands(): void {
    while (this.commandQueue.length) {
      const command = this.commandQueue.shift()!;
      this.runCommand(command);
      if (command.type === "wait") break;
    }
  }

  private runCommand(command: HerculesRigCommand): void {
    switch (command.type) {
      case "setPart": {
        this.overrides.set(command.part, {
          transform: mergeTransform(EMPTY_TRANSFORM, command.transform),
          until: command.holdMs ? performance.now() + command.holdMs : null,
        });
        break;
      }
      case "setParts": {
        for (const [part, transform] of Object.entries(command.parts) as [RigPartId, RigPartTransform][]) {
          this.overrides.set(part, {
            transform: mergeTransform(EMPTY_TRANSFORM, transform),
            until: command.holdMs ? performance.now() + command.holdMs : null,
          });
        }
        break;
      }
      case "playPose":
        this.playPose(command.pose, command.loop ?? true);
        break;
      case "playClip": {
        const clip = getRigClip(command.clipId);
        if (!clip) break;
        this.poseClip = { clip, startedAt: performance.now(), loop: command.loop ?? Boolean(clip.loop) };
        break;
      }
      case "blendTo": {
        this.blend = {
          from: { ...this.snapshot },
          to: command.parts,
          startedAt: performance.now(),
          durationMs: command.durationMs,
          ease: command.ease ?? "easeInOut",
        };
        break;
      }
      case "clearOverrides":
        this.overrides.clear();
        break;
      case "clearOverride":
        this.overrides.delete(command.part);
        break;
      case "queue":
        this.commandQueue.unshift(...command.commands);
        break;
      case "wait":
        this.waitUntil = performance.now() + command.ms;
        break;
      case "reset":
        this.overrides.clear();
        this.blend = null;
        this.playPose("loaf");
        break;
      default:
        break;
    }
  }
}

export function createHerculesRigEngine(): HerculesRigEngine {
  return new HerculesRigEngine();
}
