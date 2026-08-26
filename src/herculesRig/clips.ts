import type { HerculesRigPose, RigClip, RigSnapshot } from "./types.ts";

const LEGS_LOAF = { legs: { translateY: 9, scaleY: 0.34 }, body: { translateY: 3, scaleY: 0.95 } };
const LEGS_SLEEP = { head: { rotate: 9, translateX: 6, translateY: 8 }, legs: { translateY: 10, scaleY: 0.28 }, tail: { rotate: -16, translateX: -14 }, whiskers: { opacity: 0.3 }, eye: { visible: false }, eyeShut: { visible: true } };

/** Built-in pose clips — mirror hercules.css at 96px. AI agents may register more. */
export const POSE_CLIPS: Record<HerculesRigPose, RigClip> = {
  loaf: {
    id: "pose-loaf",
    label: "Loaf",
    durationMs: 5500,
    loop: true,
    keyframes: [
      { t: 0, parts: { ...LEGS_LOAF, tail: { rotate: -5 } } },
      { t: 0.35, parts: { ...LEGS_LOAF, tail: { rotate: -5 } } },
      { t: 0.7, parts: { ...LEGS_LOAF, tail: { rotate: 4 } } },
      { t: 1, parts: { ...LEGS_LOAF, tail: { rotate: 0 } } },
    ],
  },
  perch: {
    id: "pose-perch",
    label: "Perch",
    durationMs: 5000,
    loop: true,
    keyframes: [
      { t: 0, parts: { legs: { translateY: 7, scaleY: 0.5 }, head: { rotate: -3 }, tail: { rotate: 26 } } },
      { t: 0.5, parts: { legs: { translateY: 7, scaleY: 0.5 }, head: { rotate: -3 }, tail: { rotate: 34 } } },
      { t: 1, parts: { legs: { translateY: 7, scaleY: 0.5 }, head: { rotate: -3 }, tail: { rotate: 26 } } },
    ],
  },
  sleep: {
    id: "pose-sleep",
    label: "Sleep",
    durationMs: 5400,
    loop: true,
    keyframes: [
      { t: 0, parts: { ...LEGS_SLEEP, body: { scaleY: 1 } } },
      { t: 0.5, parts: { ...LEGS_SLEEP, body: { scaleY: 1.02 } } },
      { t: 1, parts: { ...LEGS_SLEEP, body: { scaleY: 1 } } },
    ],
  },
  walk: {
    id: "pose-walk",
    label: "Walk",
    durationMs: 620,
    loop: true,
    keyframes: [
      { t: 0, parts: { legFront: { rotate: 13 }, legBack: { rotate: -13 }, body: { translateY: 0 }, head: { translateY: 0, rotate: 0 }, tail: { rotate: -22 } } },
      { t: 0.5, parts: { legFront: { rotate: -13 }, legBack: { rotate: 13 }, body: { translateY: -2.5 }, head: { translateY: -1.5, rotate: -1.5 }, tail: { rotate: -32 } } },
      { t: 1, parts: { legFront: { rotate: 13 }, legBack: { rotate: -13 }, body: { translateY: 0 }, head: { translateY: 0, rotate: 0 }, tail: { rotate: -22 } } },
    ],
  },
  pace: {
    id: "pose-pace",
    label: "Pace",
    durationMs: 340,
    loop: true,
    keyframes: [
      { t: 0, parts: { legFront: { rotate: 13 }, legBack: { rotate: -13 }, body: { translateY: 0 }, tail: { rotate: -14 } } },
      { t: 0.5, parts: { legFront: { rotate: -13 }, legBack: { rotate: 13 }, body: { translateY: -2.5 }, tail: { rotate: -26 } } },
      { t: 1, parts: { legFront: { rotate: 13 }, legBack: { rotate: -13 }, body: { translateY: 0 }, tail: { rotate: -14 } } },
    ],
  },
  jump: {
    id: "pose-jump",
    label: "Jump",
    durationMs: 620,
    keyframes: [
      { t: 0, parts: { root: { translateY: 0, scaleY: 1 }, legs: { translateY: -4, rotate: -9 }, tail: { rotate: -46 }, head: { rotate: -7, translateY: -2 } } },
      { t: 0.22, parts: { root: { translateY: 3, scaleY: 0.9 }, legs: { translateY: -4, rotate: -9 }, tail: { rotate: -46 }, head: { rotate: -7, translateY: -2 } } },
      { t: 0.55, parts: { root: { translateY: -26, scaleY: 1.09 }, legs: { translateY: -4, rotate: -9 }, tail: { rotate: -46 }, head: { rotate: -7, translateY: -2 } } },
      { t: 0.85, parts: { root: { translateY: 2, scaleY: 0.93 }, legs: { translateY: -4, rotate: -9 }, tail: { rotate: -46 }, head: { rotate: -7, translateY: -2 } } },
      { t: 1, parts: { root: { translateY: 0, scaleY: 1 }, legs: { translateY: -4, rotate: -9 }, tail: { rotate: -46 }, head: { rotate: -7, translateY: -2 } } },
    ],
  },
  celebrate: {
    id: "pose-celebrate",
    label: "Celebrate",
    durationMs: 520,
    loop: true,
    keyframes: [
      { t: 0, parts: { root: { translateY: 0, scaleY: 1 }, tail: { rotate: -54 }, head: { rotate: -9 } } },
      { t: 0.55, parts: { root: { translateY: -26, scaleY: 1.09 }, tail: { rotate: -54 }, head: { rotate: -9 } } },
      { t: 1, parts: { root: { translateY: 0, scaleY: 1 }, tail: { rotate: -54 }, head: { rotate: -9 } } },
    ],
  },
  stretch: {
    id: "pose-stretch",
    label: "Stretch",
    durationMs: 1200,
    loop: true,
    keyframes: [
      { t: 0, parts: { body: { scaleX: 1.1, scaleY: 0.84, translateX: 6 }, head: { translateX: -9, translateY: 5, rotate: 5 }, legs: { rotate: -13 }, tail: { rotate: -34 } } },
      { t: 1, parts: { body: { scaleX: 1.1, scaleY: 0.84, translateX: 6 }, head: { translateX: -9, translateY: 5, rotate: 5 }, legs: { rotate: -13 }, tail: { rotate: -34 } } },
    ],
  },
  wash: {
    id: "pose-wash",
    label: "Wash",
    durationMs: 1500,
    loop: true,
    keyframes: [
      { t: 0, parts: { head: { rotate: 6, translateX: 4, translateY: 4 }, legs: { translateY: 7, scaleY: 0.5 } } },
      { t: 0.5, parts: { head: { rotate: 15, translateX: 7, translateY: 10 }, legs: { translateY: 7, scaleY: 0.5 } } },
      { t: 1, parts: { head: { rotate: 6, translateX: 4, translateY: 4 }, legs: { translateY: 7, scaleY: 0.5 } } },
    ],
  },
  lick: {
    id: "pose-lick",
    label: "Lick",
    durationMs: 1500,
    loop: true,
    keyframes: [
      { t: 0, parts: { head: { rotate: 6, translateX: 4, translateY: 4 }, legs: { translateY: 7, scaleY: 0.5 } } },
      { t: 0.5, parts: { head: { rotate: 15, translateX: 7, translateY: 10 }, legs: { translateY: 7, scaleY: 0.5 } } },
      { t: 1, parts: { head: { rotate: 6, translateX: 4, translateY: 4 }, legs: { translateY: 7, scaleY: 0.5 } } },
    ],
  },
  pounce: {
    id: "pose-pounce",
    label: "Pounce",
    durationMs: 1050,
    keyframes: [
      { t: 0, parts: { root: { translateX: 0, scaleY: 1 }, head: { translateX: -4, rotate: -3 }, tail: { rotate: -14 } } },
      { t: 0.15, parts: { root: { translateX: 3, scaleY: 0.93 }, head: { translateX: -4, rotate: -3 }, tail: { rotate: -26 } } },
      { t: 0.45, parts: { root: { translateX: -2, scaleY: 0.93 }, head: { translateX: -4, rotate: -3 }, tail: { rotate: -26 } } },
      { t: 0.75, parts: { root: { translateX: -22, scaleY: 0.95 }, head: { translateX: -4, rotate: -3 }, tail: { rotate: -26 } } },
      { t: 1, parts: { root: { translateX: 0, scaleY: 1 }, head: { translateX: -4, rotate: -3 }, tail: { rotate: -14 } } },
    ],
  },
  attack: {
    id: "pose-attack",
    label: "Attack",
    durationMs: 500,
    keyframes: [
      { t: 0, parts: { root: { translateX: 0, rotate: 0 }, legFront: { rotate: -68, translateX: -6, translateY: -18 }, head: { translateX: -6, rotate: -8 }, tail: { rotate: -40 } } },
      { t: 0.4, parts: { root: { translateX: -16, rotate: -5 }, legFront: { rotate: -68, translateX: -6, translateY: -18 }, head: { translateX: -6, rotate: -8 }, tail: { rotate: -40 } } },
      { t: 1, parts: { root: { translateX: 0, rotate: 0 }, legFront: { rotate: -68, translateX: -6, translateY: -18 }, head: { translateX: -6, rotate: -8 }, tail: { rotate: -40 } } },
    ],
  },
  bump: {
    id: "pose-bump",
    label: "Bump",
    durationMs: 420,
    keyframes: [
      { t: 0, parts: { root: { translateX: 0 }, head: { rotate: 4, translateX: 3 } } },
      { t: 0.3, parts: { root: { translateX: -5 }, head: { rotate: 4, translateX: 3 } } },
      { t: 0.6, parts: { root: { translateX: 3 }, head: { rotate: 4, translateX: 3 } } },
      { t: 1, parts: { root: { translateX: 0 }, head: { rotate: 4, translateX: 3 } } },
    ],
  },
  hide: {
    id: "pose-hide",
    label: "Hide",
    durationMs: 800,
    loop: true,
    keyframes: [
      {
        t: 0,
        parts: {
          root: { scaleX: 0.86, scaleY: 0.86 },
          head: { translateY: 7, rotate: 4 },
          ears: { rotate: -16, scaleY: 0.72 },
          legs: { translateY: 10, scaleY: 0.3 },
          tail: { rotate: 20, translateX: -16 },
          whiskers: { opacity: 0.25 },
          eye: { visible: false },
          eyeShut: { visible: true },
        },
      },
      { t: 1, parts: {
        root: { scaleX: 0.86, scaleY: 0.86 },
        head: { translateY: 7, rotate: 4 },
        ears: { rotate: -16, scaleY: 0.72 },
        legs: { translateY: 10, scaleY: 0.3 },
        tail: { rotate: 20, translateX: -16 },
        whiskers: { opacity: 0.25 },
        eye: { visible: false },
        eyeShut: { visible: true },
      } },
    ],
  },
  sit: {
    id: "pose-sit",
    label: "Sit",
    durationMs: 4200,
    loop: true,
    keyframes: [
      { t: 0, parts: { legs: { translateY: 6, scaleY: 0.55 }, body: { translateY: 2 }, tail: { rotate: -5 } } },
      { t: 0.5, parts: { legs: { translateY: 6, scaleY: 0.55 }, body: { translateY: 2 }, tail: { rotate: 4 } } },
      { t: 1, parts: { legs: { translateY: 6, scaleY: 0.55 }, body: { translateY: 2 }, tail: { rotate: 0 } } },
    ],
  },
  beg: {
    id: "pose-beg",
    label: "Beg",
    durationMs: 900,
    loop: true,
    keyframes: [
      {
        t: 0,
        parts: {
          head: { translateY: -4, rotate: -6 },
          ears: { rotate: -22, scaleY: 0.68 },
          legs: { translateY: -8 },
          legFront: { rotate: -18, translateY: -6 },
          legBack: { rotate: 12, translateY: -4 },
          whiskers: { opacity: 0.7 },
        },
      },
      { t: 1, parts: {
        head: { translateY: -4, rotate: -6 },
        ears: { rotate: -22, scaleY: 0.68 },
        legs: { translateY: -8 },
        legFront: { rotate: -18, translateY: -6 },
        legBack: { rotate: 12, translateY: -4 },
        whiskers: { opacity: 0.7 },
      } },
    ],
  },
  bag: {
    id: "pose-bag",
    label: "Bag",
    durationMs: 1100,
    loop: true,
    keyframes: [
      { t: 0, parts: { bag: { opacity: 1, rotate: -4 }, head: { translateX: 10, translateY: 4, rotate: 8 }, legFront: { translateX: 18, translateY: -4, rotate: 12 } } },
      { t: 0.5, parts: { bag: { opacity: 1, rotate: 8, translateY: -3 }, head: { translateX: 10, translateY: 4, rotate: 8 }, legFront: { translateX: 18, translateY: -4, rotate: 12 } } },
      { t: 1, parts: { bag: { opacity: 1, rotate: -4 }, head: { translateX: 10, translateY: 4, rotate: 8 }, legFront: { translateX: 18, translateY: -4, rotate: 12 } } },
    ],
  },
};

/** Always-on life overlays unless a pose owns the part. */
export const IDLE_CLIPS = {
  breathe: {
    id: "idle-breathe",
    durationMs: 3600,
    loop: true,
    keyframes: [
      { t: 0, parts: { body: { scaleX: 1, scaleY: 1 } } },
      { t: 0.5, parts: { body: { scaleX: 1.012, scaleY: 1.02 } } },
      { t: 1, parts: { body: { scaleX: 1, scaleY: 1 } } },
    ],
  } satisfies RigClip,
  tail: {
    id: "idle-tail",
    durationMs: 4200,
    loop: true,
    keyframes: [
      { t: 0, parts: { tail: { rotate: 0 } } },
      { t: 0.35, parts: { tail: { rotate: -5 } } },
      { t: 0.7, parts: { tail: { rotate: 4 } } },
      { t: 1, parts: { tail: { rotate: 0 } } },
    ],
  } satisfies RigClip,
  blink: {
    id: "idle-blink",
    durationMs: 6500,
    loop: true,
    keyframes: [
      { t: 0, parts: { eye: { scaleY: 1, visible: true }, eyeShut: { visible: false } } },
      { t: 0.96, parts: { eye: { scaleY: 1, visible: true }, eyeShut: { visible: false } } },
      { t: 0.975, parts: { eye: { scaleY: 0.1, visible: true }, eyeShut: { visible: false } } },
      { t: 1, parts: { eye: { scaleY: 1, visible: true }, eyeShut: { visible: false } } },
    ],
  } satisfies RigClip,
};

export const MOOD_PARTS: Record<string, Partial<RigSnapshot>> = {
  glowing: { tail: { rotate: 3 }, ears: { rotate: 3 } },
  restless: { tail: { rotate: -8 } },
  hiding: { ears: { rotate: -12, scaleY: 0.8 }, eye: { visible: false }, eyeShut: { visible: true } },
};

export function poseClipId(pose: HerculesRigPose): string {
  return POSE_CLIPS[pose].id;
}
