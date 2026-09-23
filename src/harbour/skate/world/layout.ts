/**
 * Tideline Skate Club v2 · world — the authored places worth skating.
 *
 * Pure data (plus the frame arithmetic that turns it into island
 * coordinates). Every feature is written in its spot's own frame; the spot's
 * frame is written in the island's. Heights are above the spot's pad plane,
 * which `field.ts` fits to the island's ground at runtime, so the same layout
 * rides correctly on any ground function (tests use flat and sloped ones).
 *
 * The kitchen-table names are on purpose: this is a model village on a
 * kitchen table, and the park is the thing Jonathan and Bianca built on it.
 * See `NOTES-park.md` for the intended lines.
 */
import type { SkateSpot } from '../contract.ts';
import { arcFor, composeFrame, frameToWorld, DEG, type Frame } from './profiles.ts';
import type { FeatureDef } from './features.ts';

export type PadDef = {
  /** Centre in the spot frame. */
  at: readonly [number, number];
  half: readonly [number, number];
  corner: number;
  /** The pad plane follows the island's fall up to this gradient (drainage), then is filled level-ish. */
  maxSlope: number;
};

export type SpotLayout = {
  id: string; name: string; words: string;
  frame: Frame;
  pad: PadDef;
  features: readonly FeatureDef[];
  /** Start in the spot frame and the local heading (radians; 0 = spot +lz). */
  start: readonly [number, number];
  startYaw: number;
  /** Sign position in the spot frame; the plate faces local heading `signYaw`. */
  sign: { at: readonly [number, number]; yaw: number };
};

/** How far past the pad's corners the apron may reach, for the spot's island rectangle (tests prove the real apron fits). */
export const APRON_ALLOWANCE = 2.2;

const H = Math.PI / 2;

/* ================================================================ Tideline Park */

const HOB = arcFor(1.1, 62), CHIMNEY = arcFor(1.9, 84), BREADBIN = arcFor(0.85, 72);
const BREADBIN_HALF = 2.4 / 2 + BREADBIN.T + 0.9;

/**
 * The flagship. Local X runs along the lawn's crown (−X is the Boathouse end,
 * +X the Northlight end); local +Z faces the north shore and is gently
 * downhill. See NOTES-park.md for the lines.
 */
const TIDELINE: SpotLayout = {
  id: 'tideline', name: 'Tideline Park', words: 'A little concrete. A lot of possibility.',
  frame: { x: 18.6, z: -38.3, yaw: 150 * DEG },
  pad: { at: [0, 0], half: [14.5, 10], corner: 1.5, maxSlope: 0.025 },
  start: [-1, 0.8], startYaw: -H,
  sign: { at: [2, -11.2], yaw: Math.PI },
  features: [
    // ---- the transition end (−X): the Kettle, its Hob wall and the Breadbin mini
    { type: 'bowl', id: 'tideline-kettle', name: 'The Kettle', at: [-9.7, -5.8], floor: [1.9, 1.1], corner: 1.1, depth: 1.1, angle: 80, block: [3.9, 3.2] },
    { type: 'quarter', id: 'tideline-hob', name: 'The Hob', at: [-9.7, -2.6 + HOB.T], yaw: Math.PI, width: 7.8, height: 1.1, angle: 62, deck: 0 },
    { type: 'bank', id: 'tideline-kettle-rollin', name: 'Kettle roll-in', at: [-5.8 + 3.0, -6.2], yaw: -H, width: 4.4, run: 3.0, rise: 1.1, fillet: 0.35 },
    { type: 'mini', id: 'tideline-breadbin', name: 'The Breadbin', at: [-9.0, 6.4], yaw: H, width: 4.0, height: 0.85, angle: 72, flat: 2.4, deck: 0.9 },
    { type: 'bank', id: 'tideline-breadbin-rollin', name: 'Breadbin roll-in', at: [-9.0 + BREADBIN_HALF + 2.4, 6.4], yaw: -H, width: 4.0, run: 2.4, rise: 0.85, fillet: 0.3 },
    // ---- the long runway to the Chimney
    { type: 'box', id: 'tideline-breadboard', name: 'The Breadboard', at: [4.3, -7.6], half: [1.8, 0.6], height: 0.18, role: 'manual', ledges: [{ side: '+z' }, { side: '-z' }] },
    { type: 'quarter', id: 'tideline-chimney', name: 'The Chimney', at: [13.1 - CHIMNEY.T, -6.7], yaw: H, width: 5.0, height: 1.9, angle: 84, deck: 1.0 },
    { type: 'rail', id: 'tideline-rolling-pin', name: 'The Rolling Pin', kind: 'round-rail', points: [[0.8, -3.4, 0.36], [6.0, -3.4, 0.36]] },
    // ---- the Cake Stand funbox: banks, a ledge and a kinked rail
    { type: 'funbox', id: 'tideline-cake-stand', name: 'The Cake Stand', at: [9.0, -0.8], half: [1.4, 1.0], height: 0.5, runs: { px: 1.3, nx: 1.3 }, fillet: 0.25, ledges: [{ side: '-z', name: 'Cake Stand ledge' }] },
    { type: 'rail', id: 'tideline-teaspoon', name: 'The Teaspoon', kind: 'kinked-rail', points: [[7.6, -0.05, 0.82], [10.4, -0.05, 0.82], [11.7, -0.05, 0.32], [12.4, -0.05, 0.32]] },
    // ---- the Hatch: kicker over the planter to a landing and down-bank (launches toward −X)
    { type: 'kicker', id: 'tideline-hatch', name: 'The Hatch', at: [7.2, 2.5], yaw: -H, width: 1.8, height: 0.5, angle: 38 },
    { type: 'planter', id: 'tideline-hatch-planter', name: 'Hatch planter', at: [4.5, 2.5], half: [0.4, 0.8], height: 0.42 },
    { type: 'box', id: 'tideline-hatch-landing', name: 'Hatch landing', at: [2.8, 2.5], half: [0.4, 0.9], height: 0.45, role: 'landing' },
    { type: 'bank', id: 'tideline-hatch-bank', name: 'Hatch down-bank', at: [1.0, 2.5], yaw: H, width: 1.8, run: 1.4, rise: 0.45, fillet: 0.25 },
    // ---- the Lantern Steps: platform, five-stair, the Mantel hubba, the Lamplighter handrail, the Sill (bank-to-ledge)
    { type: 'box', id: 'tideline-lantern-deck', name: 'Lantern terrace', at: [11.6, 7.5], half: [2.4, 1.9], height: 0.6, role: 'platform' },
    { type: 'stairs', id: 'tideline-lantern-steps', name: 'The Lantern Steps', at: [9.2, 7.35], yaw: -H, width: 3.0, steps: 5, rise: 0.12, run: 0.34 },
    { type: 'hubba', id: 'tideline-mantel', name: 'The Mantel', at: [9.2, 9.125], yaw: -H, width: 0.55, profile: [[-1.2, 0.9], [0, 0.9], [1.7, 0.3]], ledges: ['+x', '-x'] },
    { type: 'rail', id: 'tideline-lamplighter', name: 'The Lamplighter', kind: 'round-rail', points: [[10.0, 5.62, 0.96], [9.2, 5.62, 0.96], [7.84, 5.62, 0.48], [7.34, 5.62, 0.3035]] },
    { type: 'bank', id: 'tideline-sill-bank', name: 'Sill bank', at: [12.1, 3.6], yaw: 0, width: 3.8, run: 2.0, rise: 0.6, fillet: 0.25 },
    { type: 'box', id: 'tideline-sill', name: 'The Sill', at: [13.0, 5.8], half: [1.0, 0.2], height: 0.9, role: 'ledge', ledges: [{ side: '-z', name: 'The Sill' }] },
    // ---- somewhere to sit
    { type: 'box', id: 'tideline-bench', name: 'The Dunking Bench', at: [1.5, 9.1], half: [0.9, 0.22], height: 0.38, role: 'bench', ledges: [{ side: '+z' }, { side: '-z' }] },
    // ---- paper lanterns round the edge (never rideable)
    ...([[-14.6, -10.1], [14.6, -10.1], [-14.6, 10.1], [14.6, 10.1], [-4.5, -10.6], [8.5, -10.6]] as const).map(([x, z], i) => ({ type: 'post' as const, id: `tideline-lantern-${i}`, at: [x, z] as const, r: 0.07, height: 1.7, look: 'lantern' as const })),
  ],
};

/* ================================================================ street spots */

const BOOKENDS: SpotLayout = {
  id: 'bookends', name: 'Bookends Square', words: 'Low ledges. Long lines. One more try.',
  frame: { x: -14, z: -6, yaw: 0 },
  pad: { at: [0, 0], half: [5, 4], corner: 1.2, maxSlope: 0.07 },
  start: [-4.0, 1.9], startYaw: H,
  sign: { at: [0, -4.9], yaw: Math.PI },
  features: [
    { type: 'planter', id: 'bookends-left', name: 'Left bookend', at: [-2.4, -1.3], half: [2.1, 0.45], height: 0.42, ledges: [{ side: '+z', name: 'Left bookend rim' }, { side: '-z', name: 'Left bookend back' }] },
    { type: 'planter', id: 'bookends-right', name: 'Right bookend', at: [2.4, 1.3], half: [2.1, 0.45], height: 0.42, ledges: [{ side: '+z', name: 'Right bookend back' }, { side: '-z', name: 'Right bookend rim' }] },
    { type: 'box', id: 'bookends-bench', name: 'Reading bench', at: [0, -3.1], half: [1.0, 0.22], height: 0.38, role: 'bench', ledges: [{ side: '+z' }, { side: '-z' }] },
    { type: 'box', id: 'bookends-curb', name: 'Westway curb', at: [0, 3.55], half: [4.2, 0.14], height: 0.12, role: 'curb', ledges: [{ side: '+z', kind: 'curb' }, { side: '-z', kind: 'curb' }] },
    { type: 'post', id: 'bookends-lantern-0', at: [-5.3, -4.3], r: 0.07, height: 1.7, look: 'lantern' },
    { type: 'post', id: 'bookends-lantern-1', at: [5.3, -4.3], r: 0.07, height: 1.7, look: 'lantern' },
  ],
};

const FUNDSTEPS: SpotLayout = {
  id: 'fundsteps', name: 'Counting-House Steps', words: 'Six steps down from the Fund. Count them on the way.',
  frame: { x: 15, z: -16, yaw: 0 },
  pad: { at: [0, 0], half: [5.5, 4.5], corner: 1.2, maxSlope: 0.07 },
  start: [-3.4, 0], startYaw: H,
  sign: { at: [-5.9, -3.6], yaw: -H },
  features: [
    { type: 'box', id: 'fundsteps-top', name: 'Counting-house landing', at: [3.2, 0], half: [1.8, 2.2], height: 0.72, role: 'platform' },
    { type: 'stairs', id: 'fundsteps-steps', name: 'The Six', at: [1.4, 0], yaw: -H, width: 3.0, steps: 6, rise: 0.12, run: 0.34 },
    { type: 'rail', id: 'fundsteps-ledger', name: 'The Ledger rail', kind: 'round-rail', points: [[2.2, 1.75, 1.08], [1.4, 1.75, 1.08], [-0.3, 1.75, 0.48], [-0.8, 1.75, 0.3035]] },
    { type: 'rail', id: 'fundsteps-tally', name: 'The Tally rail', kind: 'round-rail', points: [[2.2, -1.75, 1.08], [1.4, -1.75, 1.08], [-0.3, -1.75, 0.48], [-0.8, -1.75, 0.3035]] },
    { type: 'bank', id: 'fundsteps-bank-n', name: 'North bank', at: [3.2, -4.2], yaw: 0, width: 3.6, run: 2.0, rise: 0.72, fillet: 0.25 },
    { type: 'bank', id: 'fundsteps-bank-s', name: 'South bank', at: [3.2, 4.2], yaw: Math.PI, width: 3.6, run: 2.0, rise: 0.72, fillet: 0.25 },
    { type: 'box', id: 'fundsteps-ledge', name: 'The Counting ledge', at: [4.75, 0], half: [0.25, 1.6], height: 1.02, role: 'ledge', ledges: [{ side: '-x', name: 'The Counting ledge' }] },
  ],
};

const NORTHLIGHT: SpotLayout = {
  id: 'northlight', name: 'Northlight Run', words: 'The island ends. The line goes on.',
  frame: { x: -12, z: -48, yaw: 0 },
  pad: { at: [0, 0], half: [3, 8], corner: 1.2, maxSlope: 0.09 },
  start: [0, 6.6], startYaw: Math.PI,
  sign: { at: [-3.9, 6.8], yaw: -H },
  features: [
    { type: 'kicker', id: 'northlight-beacon', name: 'The Beacon', at: [0, 4.6], yaw: Math.PI, width: 2.2, height: 0.42, angle: 32 },
    { type: 'rail', id: 'northlight-rail', name: 'The Lighthouse rail', kind: 'round-rail', points: [[1.5, 1.0, 0.36], [1.5, -5.0, 0.36]] },
    { type: 'box', id: 'northlight-keeper', name: "The Keeper's ledge", at: [-1.9, -2.5], half: [0.25, 2.9], height: 0.3, role: 'ledge', ledges: [{ side: '+x', name: "The Keeper's ledge" }, { side: '-x' }] },
    { type: 'quarter', id: 'northlight-point', name: 'The Point', at: [0, -6.3], yaw: Math.PI, width: 5.6, height: 0.7, angle: 55, deck: 0.3 },
  ],
};

const ORCHARD: SpotLayout = {
  id: 'orchard', name: 'Orchard Culvert', words: 'The rain found this line first.',
  frame: { x: -42, z: 39, yaw: 0 },
  pad: { at: [0, 0], half: [6.4, 3.5], corner: 1.2, maxSlope: 0.07 },
  start: [-5.4, 0], startYaw: H,
  sign: { at: [-7.3, 2.4], yaw: -H },
  features: [
    { type: 'funbox', id: 'orchard-berm-n', name: 'North berm', at: [0, -2.0], half: [3.4, 0.25], height: 0.6, runs: { px: 1.2, nx: 1.2, pz: 1.2, nz: 1.2 }, fillet: 0.25 },
    { type: 'funbox', id: 'orchard-berm-s', name: 'South berm', at: [0, 2.0], half: [3.4, 0.25], height: 0.6, runs: { px: 1.2, nx: 1.2, pz: 1.2, nz: 1.2 }, fillet: 0.25 },
    { type: 'rail', id: 'orchard-rail', name: 'The Culvert rail', kind: 'round-rail', points: [[-3.2, 0, 0.34], [3.2, 0, 0.34]] },
  ],
};

const TIDEPOOLS: SpotLayout = {
  id: 'tidepools', name: 'Tidepool Promenade', words: 'Save a little speed for the way back.',
  frame: { x: 46.2, z: 31, yaw: 0 },
  pad: { at: [0, 0], half: [1.9, 5.2], corner: 0.9, maxSlope: 0.09 },
  start: [0.1, -4.3], startYaw: 0,
  sign: { at: [-2.6, -4.6], yaw: -H },
  features: [
    { type: 'box', id: 'tidepools-curb', name: 'Promenade curb', at: [1.55, 0], half: [0.14, 4.6], height: 0.12, role: 'curb', ledges: [{ side: '+x', kind: 'curb', name: 'Promenade curb' }, { side: '-x', kind: 'curb' }] },
    { type: 'box', id: 'tidepools-bench-a', name: 'Low-tide bench', at: [-1.3, -2.4], half: [0.22, 1.0], height: 0.38, role: 'bench', ledges: [{ side: '+x' }, { side: '-x' }] },
    { type: 'box', id: 'tidepools-bench-b', name: 'High-tide bench', at: [-1.3, 2.4], half: [0.22, 1.0], height: 0.38, role: 'bench', ledges: [{ side: '+x' }, { side: '-x' }] },
    { type: 'box', id: 'tidepools-manual', name: 'Shell pad', at: [0.1, 0], half: [0.5, 1.0], height: 0.16, role: 'manual', ledges: [{ side: '+x' }, { side: '-x' }] },
  ],
};

const DRYDOCK: SpotLayout = {
  id: 'drydock', name: 'Drydock Pier', words: 'Salt air and a rail all the way home.',
  frame: { x: 52, z: -32, yaw: 122 * DEG },
  pad: { at: [0, 0], half: [2.4, 7.2], corner: 1.0, maxSlope: 0.06 },
  start: [0, -6.6], startYaw: 0,
  sign: { at: [-2.9, -6.2], yaw: -H },
  features: [
    { type: 'bank', id: 'drydock-ramp', name: 'Slipway', at: [0, -4.4], yaw: 0, width: 2.2, run: 1.2, rise: 0.4, fillet: 0.25, kind: 'wood' },
    { type: 'box', id: 'drydock-pier', name: 'The Pier', at: [0, 1.6], half: [1.1, 4.8], height: 0.4, role: 'deck', kind: 'wood', ledges: [{ side: '+x', name: 'Salt plank' }, { side: '-x', name: 'Tar plank' }] },
    { type: 'rail', id: 'drydock-mooring', name: 'The Mooring rail', kind: 'round-rail', points: [[1.85, -2.6, 0.38], [1.85, 5.2, 0.38]] },
    { type: 'post', id: 'drydock-bollard-0', at: [-0.75, 6.0], r: 0.12, height: 0.95, look: 'bollard' },
    { type: 'post', id: 'drydock-bollard-1', at: [0.75, 6.0], r: 0.12, height: 0.95, look: 'bollard' },
  ],
};

/** Order is the spot book's order. `tideline` stays first (v1 discovery code relies on it being the free spot). */
export const SPOT_LAYOUTS: readonly SpotLayout[] = [TIDELINE, BOOKENDS, FUNDSTEPS, DRYDOCK, ORCHARD, NORTHLIGHT, TIDEPOOLS];

/* ================================================================ derived island data */

/** The spot's island rectangle: axis-aligned, enclosing the pad and its apron allowance. */
function spotRect(l: SpotLayout): { x: number; z: number; halfWidth: number; halfDepth: number } {
  const pf = composeFrame(l.frame, l.pad.at[0], l.pad.at[1], 0);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [x, z] = frameToWorld(pf, sx * l.pad.half[0], sz * l.pad.half[1]);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { x: r((minX + maxX) / 2), z: r((minZ + maxZ) / 2), halfWidth: r((maxX - minX) / 2 + APRON_ALLOWANCE), halfDepth: r((maxZ - minZ) / 2 + APRON_ALLOWANCE) };
}

export type SkateSpotEntry = SkateSpot;

export const SPOTS: readonly SkateSpotEntry[] = SPOT_LAYOUTS.map(l => {
  const rect = spotRect(l), start = frameToWorld(l.frame, l.start[0], l.start[1]);
  const startYaw = Math.atan2(Math.sin(l.frame.yaw + l.startYaw), Math.cos(l.frame.yaw + l.startYaw));
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return { id: l.id, name: l.name, words: l.words, ...rect, start: [round(start[0]), round(start[1])] as const, startYaw: round(startYaw) };
});

/**
 * Oriented keep-out rectangles (pad + apron allowance) in `scene/planting.ts`'s
 * `KeepOutRect` shape. Tighter than the axis-aligned spot rectangles for the
 * rotated parks; integration may swap planting's `SKATE_SPOTS.map(rect…)` for these.
 */
export const SKATE_KEEP_OUTS: readonly { kind: 'rect'; id: string; x: number; z: number; halfWidth: number; halfDepth: number; yaw: number }[] = SPOT_LAYOUTS.map(l => {
  const f = composeFrame(l.frame, l.pad.at[0], l.pad.at[1], 0);
  return { kind: 'rect' as const, id: `skate-${l.id}`, x: f.x, z: f.z, halfWidth: l.pad.half[0] + APRON_ALLOWANCE, halfDepth: l.pad.half[1] + APRON_ALLOWANCE, yaw: f.yaw };
});

/** A park-local point in island coordinates. */
export const parkPoint = (spotId: string, lx: number, lz: number): [number, number] => {
  const l = SPOT_LAYOUTS.find(s => s.id === spotId);
  if (!l) throw new Error(`unknown spot ${spotId}`);
  const [x, z] = frameToWorld(l.frame, lx, lz);
  return [Math.round(x * 100) / 100, Math.round(z * 100) / 100];
};

/**
 * Timed checkpoint routes. Ids are v1's. `first-line` is now a lap of the new
 * Tideline that passes every section; the island runs follow the roads.
 */
export const ROUTES = [
  { id: 'first-line', name: 'First light', detail: 'A lap of Tideline. Find the Kettle, the Chimney and the Steps.', seconds: [26, 38, 58] as const,
    points: [parkPoint('tideline', -1, 0.8), parkPoint('tideline', -12.2, 2.3), parkPoint('tideline', -1.2, -6.4), parkPoint('tideline', 8.6, -5.8), parkPoint('tideline', 12.6, 1.6), parkPoint('tideline', 5.6, 5.2), parkPoint('tideline', -2.2, 3.0)] },
  { id: 'north-run', name: 'Chase the lighthouse', detail: 'Out of the square and all the way to Northlight.', seconds: [18, 27, 42] as const, points: [[0, -8], [0, -18], [-3, -36], [-4, -47], [-5, -61]] as [number, number][] },
  { id: 'coast-run', name: 'Salt on the wheels', detail: 'Follow the east road to the tide pools.', seconds: [23, 35, 55] as const, points: [[12, -1], [23, -4], [37, 4], [45, 20], [50.8, 30.5], [49, 43]] as [number, number][] },
  { id: 'orchard-run', name: 'The scenic way', detail: 'Find Bookends, then follow the western lane.', seconds: [22, 34, 52] as const, points: [[-6, 0], [-16, 0], [-25, 4], [-35, 14], [-36, 26], [-44, 32]] as [number, number][] },
  { id: 'meadow-run', name: 'Meet me by the sea', detail: 'A south-road cruise through the long meadow.', seconds: [22, 34, 55] as const, points: [[0, 9], [0, 20], [2, 32], [0, 44], [-10, 48], [-17, 51]] as [number, number][] },
] as const;
