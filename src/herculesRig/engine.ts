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

export type RigVisibilityProfile = "full" | "compact" | "hidden";
export type RigEngineDiagnostics = {
  motionMode: RigEngineState["motionMode"];
  tickCount: number;
  emitCount: number;
  framesPerSecond: number;
};

const REACTION_FPS = 24;
const AMBIENT_FPS = 8;
const RESTLESS_FPS = 12;
const QUIET_FPS = 2;
const REACTION_LEASE_MS = 8_000;
const TRANSFORM_EPSILON = 0.01;

const clipTrackCache = new WeakMap<RigClip, Map<RigPartId, RigClip["keyframes"]>>();

function clipTracks(clip: RigClip): Map<RigPartId, RigClip["keyframes"]> {
  const cached = clipTrackCache.get(clip);
  if (cached) return cached;
  const tracks = new Map<RigPartId, RigClip["keyframes"]>();
  for (const frame of clip.keyframes) {
    for (const part of Object.keys(frame.parts) as RigPartId[]) {
      const rows = tracks.get(part) ?? [];
      rows.push(frame);
      tracks.set(part, rows);
    }
  }
  for (const rows of tracks.values()) rows.sort((a, b) => a.t - b.t);
  clipTrackCache.set(clip, tracks);
  return tracks;
}

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

function sampleClip(clip: RigClip, elapsedMs: number, reducedMotion: boolean, loop = Boolean(clip.loop)): Partial<RigSnapshot> {
  const duration = Math.max(1, clip.durationMs);
  const raw = reducedMotion ? 0 : (elapsedMs / duration);
  const time = loop ? raw % 1 : Math.min(1, raw);
  const parts: Partial<RigSnapshot> = {};
  for (const [part, framesWithPart] of clipTracks(clip)) {
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
  return clipTracks(clip).has(part);
}

function transformChanged(a: RigPartTransform, b: RigPartTransform): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as Array<keyof RigPartTransform>);
  for (const key of keys) {
    const left = a[key];
    const right = b[key];
    if (typeof left === "number" && typeof right === "number") {
      if (Math.abs(left - right) > TRANSFORM_EPSILON) return true;
    } else if (left !== right) {
      return true;
    }
  }
  return false;
}

function snapshotChanged(a: RigSnapshot, b: RigSnapshot): boolean {
  return RIG_PARTS.some((part) => transformChanged(a[part], b[part]));
}

export class HerculesRigEngine {
  private pose: HerculesRigPose = "loaf";
  private baselinePose: HerculesRigPose = "loaf";
  private baselineStartedAt = performance.now();
  private mood: HerculesRigMood = "content";
  private reducedMotion = false;
  private visibilityProfile: RigVisibilityProfile = "full";
  private motionMode: RigEngineState["motionMode"] = "ambient";
  private poseClip: ActiveClip | null = null;
  private reactionUntil = 0;
  private overrides = new Map<RigPartId, Override>();
  private blend: Blend | null = null;
  private commandQueue: HerculesRigCommand[] = [];
  private waitUntil = 0;
  private listeners = new Set<RigListener>();
  private raf = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private lastTickAt = 0;
  private tickCount = 0;
  private emitCount = 0;
  private lastEmittedSnapshot: RigSnapshot = emptySnapshot();
  private lastEmittedMode: RigEngineState["motionMode"] | null = null;
  private snapshot: RigSnapshot = emptySnapshot();

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
    if (value) {
      this.cancelSchedule();
      this.motionMode = "paused";
      this.snapshot = this.compose(performance.now());
      this.emit(true);
      return;
    }
    this.resume();
  }

  setMood(mood: HerculesRigMood): void {
    if (this.mood === mood) return;
    this.mood = mood;
    this.snapshot = this.compose(performance.now());
    this.emit(true);
    this.scheduleNext();
  }

  setVisibilityProfile(profile: RigVisibilityProfile): void {
    if (this.visibilityProfile === profile) return;
    this.visibilityProfile = profile;
    if (profile === "hidden") {
      this.cancelSchedule();
      this.motionMode = "paused";
      this.emit(true);
      return;
    }
    this.resume();
  }

  getState(): RigEngineState {
    return {
      pose: this.pose,
      mood: this.mood,
      clipId: this.poseClip?.clip.id ?? null,
      parts: { ...this.snapshot, ...Object.fromEntries(RIG_PARTS.map((part) => [part, { ...this.snapshot[part] }])) },
      reducedMotion: this.reducedMotion,
      motionMode: this.motionMode,
      transitionMs: this.transitionMs(),
    };
  }

  getDiagnostics(): RigEngineDiagnostics {
    return {
      motionMode: this.motionMode,
      tickCount: this.tickCount,
      emitCount: this.emitCount,
      framesPerSecond: this.motionMode === "paused" ? 0 : this.framesPerSecond(),
    };
  }

  dispatch(command: HerculesRigCommand): void {
    this.commandQueue.push(command);
    this.pumpCommands();
    this.tick();
    this.scheduleNext();
  }

  playPose(pose: HerculesRigPose, loop = true): void {
    this.baselinePose = pose;
    this.baselineStartedAt = performance.now();
    if (this.isReactionActive(this.baselineStartedAt)) return;
    this.pose = pose;
    const clip = POSE_CLIPS[pose];
    this.poseClip = { clip, startedAt: this.baselineStartedAt, loop: loop && Boolean(clip.loop) };
    if (!this.isReactionActive(this.baselineStartedAt)) this.motionMode = this.isPaused() ? "paused" : "ambient";
    this.snapshot = this.compose(this.baselineStartedAt);
    this.emit(true);
    this.scheduleNext();
  }

  tick(now = performance.now()): void {
    this.tickCount += 1;
    this.lastTickAt = now;
    if (now >= this.waitUntil) this.pumpCommands();
    if (this.reactionUntil > 0 && now >= this.reactionUntil && now >= this.waitUntil) {
      this.settleReaction(now);
    }
    this.snapshot = this.compose(now);
    this.emit();
  }

  destroy(): void {
    this.running = false;
    this.cancelSchedule();
    this.listeners.clear();
  }

  /** Begin the animation frame loop. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.tick();
    this.scheduleNext();
  }

  private isPaused(): boolean {
    return this.reducedMotion || this.visibilityProfile === "hidden";
  }

  private isReactionActive(now = performance.now()): boolean {
    return this.reactionUntil > now;
  }

  private framesPerSecond(): number {
    if (this.motionMode === "reaction") return REACTION_FPS;
    if (this.visibilityProfile === "compact") return QUIET_FPS;
    if (this.mood === "restless") return RESTLESS_FPS;
    if (this.mood === "hiding") return QUIET_FPS;
    return AMBIENT_FPS;
  }

  private transitionMs(): number {
    if (this.motionMode === "paused") return 0;
    return Math.round((1000 / this.framesPerSecond()) + (this.motionMode === "reaction" ? 6 : 18));
  }

  private resume(): void {
    if (this.isPaused()) return;
    const now = performance.now();
    this.motionMode = this.isReactionActive(now) ? "reaction" : "ambient";
    this.tick(now);
    this.scheduleNext();
  }

  private cancelSchedule(): void {
    if (this.timer != null) clearTimeout(this.timer);
    this.timer = null;
    if (this.raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private scheduleNext(): void {
    if (!this.running || this.isPaused() || this.timer != null || this.raf) return;
    const interval = 1000 / this.framesPerSecond();
    const delay = Math.max(0, interval - (performance.now() - this.lastTickAt));
    this.timer = setTimeout(() => {
      this.timer = null;
      const run = (now: number) => {
        this.raf = 0;
        if (!this.running || this.isPaused()) return;
        this.tick(now);
        this.scheduleNext();
      };
      if (typeof requestAnimationFrame === "function") {
        this.raf = requestAnimationFrame(run);
      } else {
        run(performance.now());
      }
    }, delay);
  }

  private enterReaction(now: number, durationMs = REACTION_LEASE_MS): void {
    const entering = this.motionMode !== "reaction";
    this.reactionUntil = Math.max(this.reactionUntil, now + Math.min(REACTION_LEASE_MS, Math.max(1, durationMs)));
    if (!this.isPaused()) this.motionMode = "reaction";
    if (entering && typeof performance.mark === "function") performance.mark("hearth:hercules-rig:reaction-start");
  }

  private settleReaction(now: number): void {
    this.reactionUntil = 0;
    this.waitUntil = 0;
    this.commandQueue = [];
    this.overrides.clear();
    this.blend = null;
    this.pose = this.baselinePose;
    const clip = POSE_CLIPS[this.baselinePose];
    this.poseClip = { clip, startedAt: this.baselineStartedAt || now, loop: Boolean(clip.loop) };
    this.motionMode = this.isPaused() ? "paused" : "ambient";
    if (typeof performance.mark === "function") {
      performance.mark("hearth:hercules-rig:reaction-settled");
      try {
        performance.measure(
          "hearth:hercules-rig:reaction-duration",
          "hearth:hercules-rig:reaction-start",
          "hearth:hercules-rig:reaction-settled",
        );
      } catch {
        // A reset may settle before a measured reaction starts.
      }
    }
  }

  private emit(force = false): void {
    if (!force && this.lastEmittedMode === this.motionMode && !snapshotChanged(this.lastEmittedSnapshot, this.snapshot)) return;
    const state = this.getState();
    this.emitCount += 1;
    this.lastEmittedSnapshot = state.parts;
    this.lastEmittedMode = state.motionMode;
    for (const listener of this.listeners) listener(state);
  }

  private compose(now: number): RigSnapshot {
    const base = emptySnapshot();
    const poseSample = this.poseClip
      ? sampleClip(this.poseClip.clip, now - this.poseClip.startedAt, this.reducedMotion, this.poseClip.loop)
      : {};
    const breathe = sampleClip(IDLE_CLIPS.breathe, now, this.reducedMotion);
    const tail = sampleClip(IDLE_CLIPS.tail, now, this.reducedMotion);
    const blink = sampleClip(IDLE_CLIPS.blink, now, this.reducedMotion);
    for (const part of RIG_PARTS) {
      let transform = { ...EMPTY_TRANSFORM };

      if (!clipOwnsPart(this.poseClip?.clip ?? null, part) && part === "body") {
        transform = mergeTransform(transform, breathe.body);
      }
      if (!clipOwnsPart(this.poseClip?.clip ?? null, part) && part === "tail") {
        transform = mergeTransform(transform, tail.tail);
      }
      if ((part === "eye" || part === "eyeShut") && !clipOwnsPart(this.poseClip?.clip ?? null, part)) {
        if (blink[part]) transform = mergeTransform(transform, blink[part]);
      }

      const moodParts = MOOD_PARTS[this.mood];
      if (moodParts?.[part]) transform = mergeTransform(transform, moodParts[part]);

      if (poseSample[part]) transform = mergeTransform(transform, poseSample[part]);

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
        this.enterReaction(performance.now(), command.holdMs ?? REACTION_LEASE_MS);
        break;
      }
      case "setParts": {
        for (const [part, transform] of Object.entries(command.parts) as [RigPartId, RigPartTransform][]) {
          this.overrides.set(part, {
            transform: mergeTransform(EMPTY_TRANSFORM, transform),
            until: command.holdMs ? performance.now() + command.holdMs : null,
          });
        }
        this.enterReaction(performance.now(), command.holdMs ?? REACTION_LEASE_MS);
        break;
      }
      case "playPose": {
        const clip = POSE_CLIPS[command.pose];
        const now = performance.now();
        this.pose = command.pose;
        this.poseClip = { clip, startedAt: now, loop: command.loop === true && Boolean(clip.loop) };
        this.enterReaction(now, command.loop === true ? REACTION_LEASE_MS : clip.durationMs);
        break;
      }
      case "playClip": {
        const clip = getRigClip(command.clipId);
        if (!clip) break;
        const now = performance.now();
        this.poseClip = { clip, startedAt: now, loop: command.loop === true && Boolean(clip.loop) };
        this.enterReaction(now, command.loop === true ? REACTION_LEASE_MS : clip.durationMs);
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
        this.enterReaction(performance.now(), command.durationMs);
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
        this.enterReaction(performance.now(), command.ms);
        break;
      case "reset":
        this.settleReaction(performance.now());
        break;
      default:
        break;
    }
  }
}

export function createHerculesRigEngine(): HerculesRigEngine {
  return new HerculesRigEngine();
}
