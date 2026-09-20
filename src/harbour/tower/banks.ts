import * as THREE from "three";
import { defaultKittyPaint, defaultKittySculpt, KITTY_BODIES, KITTY_EARS, KITTY_HEADS, KITTY_MOUTHS, KITTY_NOSES, KITTY_TAILS } from "../../core/kittyStudio.ts";
import type { NestCategory } from "../../core/kittyNestDesigns.ts";
import type { KittyPieceV1, KittySculptV1 } from "../../core/types.ts";
import { createKittySculpture } from "../../kitty/sculpture.ts";
import { STUDIO_PALETTE } from "../../kitty/studio/palette.ts";
import type { TowerBank } from "../data/reading.ts";

/**
 * The banks on the tower's floors: how big a bank stands, how full it reads,
 * and the little spring it gives when money lands in it.
 *
 * Everything at the top of this file is pure arithmetic over numbers the
 * reading already holds — no money is read, computed or moved here. A goal's
 * **target** sets the sculpture's height on a log scale (a $10 goal is a
 * thimble, a $10,000 goal a mixing bowl); its **step** — the 10% backing step
 * from `kittyBankBackingStep` — sets the fill; a deposit squashes and
 * stretches it for 420 ms, and never under reduced motion.
 */

/** Height in world units. A thimble at the bottom, a mixing bowl at the top. */
export const BANK_MIN_HEIGHT = 0.28;
export const BANK_MAX_HEIGHT = 1.15;
/** Every target the same size: nobody's goal is bigger than anybody's. */
export const BANK_EVEN_HEIGHT = 0.7;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const positive = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null);

/**
 * A bank's height from its target, on a log scale between the shelf's smallest
 * and largest targets. Clamped to 0.28 – 1.15 units. When every target is the
 * same — or the range is unknown, or the target is not money yet — the bank
 * stands at the even height, so an undated wish is never made to look small.
 */
export function bankHeight(targetCents: number, smallestCents: number, largestCents: number): number {
  const target = positive(targetCents);
  const low = positive(smallestCents);
  const high = positive(largestCents);
  if (target === null) return BANK_MIN_HEIGHT;
  if (low === null || high === null) return BANK_EVEN_HEIGHT;
  const lo = Math.min(low, high), hi = Math.max(low, high);
  if (hi <= lo) return BANK_EVEN_HEIGHT;
  const here = clamp(target, lo, hi);
  const k = (Math.log(here) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
  return BANK_MIN_HEIGHT + clamp(k, 0, 1) * (BANK_MAX_HEIGHT - BANK_MIN_HEIGHT);
}

/** The 10% backing step (0–10) as a fill fraction (0–1). */
export function bankStepFill(step: number): number {
  const rounded = Number.isFinite(step) ? Math.round(step) : 0;
  return clamp(rounded, 0, 10) / 10;
}

/** The squash-and-stretch spring on a deposit: 420 ms, then perfectly still. */
export const SQUASH_MS = 420;
export const SQUASH_SECONDS = SQUASH_MS / 1000;

/**
 * The spring, `t` **seconds** after the deposit (`animate(t, dt)`'s clock).
 * Returns `{sx: 1, sy: 1}` at rest, before the start and past the end, so a
 * bank that is not bouncing is exactly the size its goal says it is. Volume is
 * preserved: what it gains in height it loses around the middle.
 */
export function squash(t: number): { sx: number; sy: number } {
  if (!Number.isFinite(t) || t <= 0 || t >= SQUASH_SECONDS) return { sx: 1, sy: 1 };
  const k = t / SQUASH_SECONDS;
  const wobble = Math.sin(k * Math.PI * 2.6) * 0.26 * Math.exp(-5.2 * k);
  const sy = 1 + wobble;
  return { sx: 1 / Math.sqrt(sy), sy };
}

// ---- the look of a bank that has no piece ----------------------------------

/** FNV-1a over the seed, so the same bank is the same cat on every device. */
export function seedHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

const pick = <T>(list: readonly T[], hash: number, salt: number): T => list[(hash >>> salt) % list.length]!;

/** Glazes by what the bank is for; ids from the studio's own palette, never a colour literal. */
export const BANK_GLAZES: Record<NestCategory, readonly string[]> = {
  build: ["marigold", "honey", "butter"],
  prepare: ["harbour-fog", "storm", "iceberg"],
  protect: ["dory-blue", "kelp", "sea-glass"],
  everyday: ["cream", "peach-melba", "porcelain"],
};

/** The dip colour a seeded bank is glazed in, resolved through the studio palette. */
export function bankGlaze(seed: string, category: NestCategory): string {
  const ids = BANK_GLAZES[category] ?? BANK_GLAZES.everyday;
  const id = pick(ids, seedHash(seed), 3);
  return STUDIO_PALETTE.find((glaze) => glaze.id === id)?.hex ?? STUDIO_PALETTE[0]!.hex;
}

/** A stable sculpt for a bank with no studio piece: the same seed is always the same cat. */
export function bankSculpt(seed: string): KittySculptV1 {
  const hash = seedHash(seed);
  const dial = (salt: number, low: number, high: number) => Math.round((low + (((hash >>> salt) % 100) / 99) * (high - low)) * 100) / 100;
  return {
    ...defaultKittySculpt(),
    body: pick(KITTY_BODIES, hash, 0),
    head: pick(KITTY_HEADS, hash, 5),
    ears: pick(KITTY_EARS, hash, 9),
    mouth: pick(KITTY_MOUTHS, hash, 13),
    tail: pick(KITTY_TAILS, hash, 17),
    nose: pick(KITTY_NOSES, hash, 21),
    profile: [dial(2, 0.85, 1.12), dial(6, 0.72, 1.0), dial(10, 0.7, 0.95), dial(14, 0.55, 0.78)],
  };
}

/** The piece a seeded bank is sculpted from when the household has not made one for it. */
export function bankPiece(bank: Pick<TowerBank, "key" | "sculptSeed" | "category">): KittyPieceV1 {
  const seed = bank.sculptSeed || bank.key;
  return {
    id: `tower:${seed}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    firedAt: "2026-01-01T00:00:00.000Z",
    sculpt: bankSculpt(seed),
    paint: defaultKittyPaint(bankGlaze(seed, bank.category)),
  };
}

// ---- the sculpture on the shelf ---------------------------------------------

export type BankSculptureOptions = {
  /** The tower's brass and timber, from `tower/dressing.ts`. */
  brass: string;
  wood: string;
  /** The household's own piece for this bank; absent = the seeded plain sculpt. */
  piece?: KittyPieceV1 | null;
  reducedMotion?: boolean;
  /** Fired ceramic by default: a bank on the shelf has been through the kiln. */
  fired?: boolean;
  /** The sculpture asks for a frame when it starts moving. */
  onAnimate?: () => void;
};

export type BankSculpture = {
  readonly group: THREE.Group;
  /** The 10% backing step (0–10). `animate` runs the studio's grow/shrink; never under reduced motion. */
  setFill(step: number, animate: boolean): void;
  /** Stands the bank `height` world units tall, whatever the sculpt's natural size is. */
  setScale(height: number): void;
  /** Squash-and-stretch on top of the standing scale; `{1,1}` is at rest. */
  setSquash(squashed: { sx: number; sy: number }): void;
  /** Advances the studio's own animations (sparkles, the grow spring). True while more frames are wanted. */
  update(nowMs: number): boolean;
  /** True when the studio's sculpture could not be built (no 2D canvas) and a plain clay stand-in is standing in. */
  readonly placeholder: boolean;
  readonly naturalHeight: number;
  dispose(): void;
};

/** Natural height of the studio's cat, used when the scene cannot measure one. */
export const KITTY_NATURAL_HEIGHT = 2.7;

/**
 * One bank as the studio's sculpted cat, wrapped so the tower can stand it at
 * its goal's height and bounce it without fighting the studio's own growth
 * scale (which `setFill` owns, on the cat inside).
 *
 * Without a 2D canvas the studio's paint layers cannot be built; rather than
 * take the floor down with it, the bank falls back to a plain clay stand-in of
 * the same height that answers the same handle.
 */
export function createBankSculpture(bank: TowerBank, options: BankSculptureOptions): BankSculpture {
  const group = new THREE.Group();
  group.name = `bank:${bank.key}`;
  const stand = new THREE.Group();
  stand.name = "bank-stand";
  group.add(stand);

  const piece = options.piece ?? bankPiece(bank);
  const reduced = Boolean(options.reducedMotion);
  let sculpture: ReturnType<typeof createKittySculpture> | null = null;
  try {
    sculpture = createKittySculpture(piece, {
      brass: options.brass,
      wood: options.wood,
      fired: options.fired ?? true,
      reducedMotion: reduced,
      ...(options.onAnimate ? { onAnimate: options.onAnimate } : {}),
    });
  } catch {
    sculpture = null;
  }

  let natural = KITTY_NATURAL_HEIGHT;
  const fallback: { dispose(): void }[] = [];
  if (sculpture) {
    stand.add(sculpture.group);
    const box = new THREE.Box3().setFromObject(sculpture.group);
    const height = box.max.y - box.min.y;
    if (Number.isFinite(height) && height > 0.2) natural = height;
  } else {
    // A plain clay loaf: body, head, one pair of ears. Same height, same handle.
    const colour = piece.paint.base;
    const clay = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.55 });
    fallback.push(clay);
    const body = new THREE.SphereGeometry(1, 14, 10);
    const head = new THREE.SphereGeometry(0.62, 12, 9);
    const ears = new THREE.ConeGeometry(0.22, 0.44, 5);
    fallback.push(body, head, ears);
    const bodyMesh = new THREE.Mesh(body, clay); bodyMesh.position.y = 0.95; bodyMesh.scale.set(1, 0.95, 0.9);
    const headMesh = new THREE.Mesh(head, clay); headMesh.position.y = 2.0;
    const earMesh = new THREE.Mesh(ears, clay); earMesh.position.set(0.32, 2.5, 0);
    for (const mesh of [bodyMesh, headMesh, earMesh]) { mesh.castShadow = true; mesh.receiveShadow = true; stand.add(mesh); }
    natural = KITTY_NATURAL_HEIGHT;
  }

  let height = BANK_EVEN_HEIGHT;
  let squashed = { sx: 1, sy: 1 };
  let fill = 0;
  const apply = (): void => {
    const base = height / natural;
    group.scale.set(base * squashed.sx, base * squashed.sy, base * squashed.sx);
    if (!sculpture) {
      // The stand-in grows the studio's way: 5.5% per step.
      const grown = 1 + bankStepFill(fill) * 10 * 0.055;
      stand.scale.setScalar(grown);
    }
  };
  apply();

  return {
    group,
    setFill(step, animate) {
      fill = step;
      if (sculpture) sculpture.setFill(step, animate && !reduced);
      else apply();
    },
    setScale(next) {
      if (Number.isFinite(next) && next > 0) height = next;
      apply();
    },
    setSquash(next) {
      squashed = reduced ? { sx: 1, sy: 1 } : next;
      apply();
    },
    update(nowMs) {
      return sculpture ? sculpture.update(nowMs) : false;
    },
    placeholder: sculpture === null,
    naturalHeight: natural,
    dispose() {
      sculpture?.dispose();
      for (const item of fallback) item.dispose();
      group.removeFromParent();
    },
  };
}
