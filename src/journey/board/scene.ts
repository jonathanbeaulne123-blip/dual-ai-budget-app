/**
 * `createJourneyMapScene(host, options)` (Horizon Clock, L3): the clay diorama of the real island inside the clock
 * bezel, the Year ring of twelve minis and the Week Party Board trail — one scene, one level pull `t` — on the SHARED
 * renderer lease (`acquireWorldRenderer`, priority 1). Ported from the approved prototype (`horizon-clock.html`).
 *
 * What it draws comes only from `options.board` (a v2 board) and `options.land` (L2's clay land handle):
 * - Month (t 1): plinth + bezel road with 31 day slots (`layoutClock`: same date → same slot), studs, the chapter arch
 *   at the top, toys on coin stacks per slot (`ringsFor` heights only; null amount → no stack), the honey needs-you ring
 *   with its dark outline and "!" bead, the cat-eared bus at today, procedural clay Hercules on The Green.
 * - Year (t 0): twelve minis (`layoutYear`, the land's shared `miniGeometry`, instanced), one stack each on the Year
 *   ruler (solid recorded and see-through not-recorded side by side, never one on the other), kept / future / empty
 *   treatments; the Month diorama shrinks into the middle. Choosing a mini at Year (`setChapter` then `setLevel`) grows
 *   that mini straight into its month — no detour spin.
 * - Week (t 2): Party Board tiles on a paper trail along the real Year Walk (`layoutWeek`), today biggest, money days
 *   chunky, empty days small stepping stones, the to-check pile as one tile; the land is asked to calm everything off
 *   the trail (`setCalm`, when the land offers it).
 *
 * All text stays DOM: the scene reports `onAnchors` (stop ids, dates, chapter ids, `piece`, `hercules`, `pile`, plus
 * decorative `numeral:<day>` and Week `face:<date>` anchors) and the UI prints every word, number and face tag.
 * Canvas `aria-hidden`.
 *
 * Inert: the options carry no actions. Picking reports ids (`onPick`), the pull reports `onLevel`; selecting, turning,
 * levelling and animating only change pixels. Reduced motion (`options.reducedMotion`, `prefers-reduced-motion` or
 * `html[data-motion="reduced"]`) makes every move a cut. Frames are drawn only while something moves; idle = no frames.
 */
import * as THREE from "three";
import {
  JOURNEY_DIORAMA, JOURNEY_MAP_MARKS, LEVEL_T, fromDiorama, levelForT, toDiorama,
  type ChapterId, type CreateJourneyMapScene, type DioramaFrame, type JourneyBoard, type JourneyLandHandle, type JourneyLevel,
  type JourneyLandCalm, type JourneyMapSceneHandle, type JourneyMapSceneOptions, type MarkAnchor, type Point2, type Stop, type ThemeId,
} from "../contracts.ts";
import { acquireWorldRenderer, type WorldRendererOptions } from "../../house/world/rendererOwner.ts";
import { effectiveDpr } from "../../harbour/scene/quality.ts";
import { layoutClock, RING_HEIGHT_DU, stackFor, type ClockItem, type ClockLayout, type ClockSlot } from "./clock.ts";
import { angDiff, clamp, distToLine, frameFromCoast, isDry, popE, resample, smoothstep, walkAt, walkSlice } from "./geo.ts";
import { at, bake, blob, clapboardTex, countBoardDraws, disposeBaked, flatRing, flatTorus, kitMaterials, lathe, part, rbox, stylePaint, type KitMaterials } from "./kit.ts";
import { createClayLights } from "../land/clay.ts";
import {
  cameraAt, chapterTurn, islandYawAt, isPhone, levelTransition, NO_INSET, PINCH_T_PER_DOUBLING, popsAt, restOf, tilePop, weekFrame,
  WHEEL_T_PER_PX, CHAPTER_TURN_SECONDS, type CameraView, type SafeInset, type WeekFrame,
} from "./levels.ts";
import { boardPalette, colourOf } from "./palette.ts";
import {
  BUS_TOP, chapterGate, coinStack, makeBus, makeHercules, moreBead, needBeadGeometryParts, needRing, nextBadgeParts, PROP_TOP, propModel,
} from "./props.ts";
import { layoutWeek, type WeekLayout, type WeekTile } from "./week.ts";
import { layoutYear, YEAR_MINI_ROAD, YEAR_MINI_SCALE, YEAR_STACK_AT, type YearMini } from "./year.ts";
import { propKindFor } from "./kinds.ts";
import { polar } from "./geo.ts";

/** The bezel's sand top (du, the prototype's `SAND_Y`): the slots, studs, gate and bus stand on it. */
export const BEZEL_Y = 0.35;
/** Toy scale on the Month clock (prototype `PS`) and the bus (prototype `BUS_S`). */
const PROP_SCALE = 1.2;
const BUS_SCALE = 1.25;
const HERCULES_SCALE = 0.62;
/** Pointer slop before a press becomes a drag (px), the tap time limit (ms) and pick radii (px). */
const DRAG_SLOP = 8, TAP_MS = 500, PICK_MONTH = 38, PICK_WEEK = 60, PICK_YEAR = 90, PICK_HERC = 44, CROWD_PX = 16;
const MONTH_FOCUS_ZOOM = 1.7;

/**
 * Week calm (`JourneyLandHandle.setCalm`): one `JourneyLandCalm` object per Week layout (the land caches its field on the
 * object's identity), and the amount pushed at most every `CALM_THROTTLE_MS` while the pull moves (a recompute costs
 * ~35 ms on the full tier); the rest value is always pushed.
 */
const CALM_THROTTLE_MS = 90;

export type JourneyMapSceneExtras = {
  /** Test seam: passed to the renderer lease (`rendererFactory`), with `shared` to pick the lease mode. */
  rendererFactory?: WorldRendererOptions["rendererFactory"];
  shared?: boolean;
  /** Stage size before the host has layout (jsdom, first paint). */
  size?: { width: number; height: number };
  devicePixelRatio?: number;
};
export type MapSceneOptions = JourneyMapSceneOptions & JourneyMapSceneExtras;
export type MapSceneHandle = JourneyMapSceneHandle & {
  /** The anchors of the last rendered frame. */
  anchors(): MarkAnchor[];
  /** Render a pending (or forced) frame now (captures, tests). */
  renderNow(): void;
  /** Read-only view of the pull, chapter and selection (tests, captures). */
  view(): { t: number; level: JourneyLevel; chapterId: ChapterId; selection: string | null; turning: boolean; spin: number };
};

type Anim = { start: number; duration: number; step(u: number): void; end(): void };

function prefersReducedMotion(explicit: boolean): boolean {
  if (explicit) return true;
  try {
    if (typeof document !== "undefined" && document.documentElement?.dataset.motion === "reduced") return true;
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch { /* fall through */ }
  return false;
}
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const round1 = (n: number) => Math.round(n * 10) / 10;

type SlotNode = { slot: ClockSlot; group: THREE.Group; pop: THREE.Group; bead: THREE.Object3D | null; ring: THREE.Object3D | null; top: number; ord: number; bounce: number };
type TileNode = { tile: WeekTile | null; group: THREE.Group; body: THREE.Group; top: number; topY: number; ord: number; ids: string[]; bump: number; billboards: THREE.Object3D[] };
type MiniNode = { mini: YearMini; group: THREE.Group; top: number };

export function createJourneyMapScene(host: HTMLElement, options: MapSceneOptions): MapSceneHandle {
  const land: JourneyLandHandle = options.land;
  let board: JourneyBoard = options.board;
  let theme: ThemeId = options.theme;
  const tier = options.tier;
  const shadows = tier === "full";
  const reduced = () => prefersReducedMotion(options.reducedMotion);
  let width = Math.max(1, host.clientWidth || options.size?.width || 390);
  let height = Math.max(1, host.clientHeight || options.size?.height || 844);
  const dpr = effectiveDpr(tier, options.devicePixelRatio ?? (typeof window !== "undefined" ? window.devicePixelRatio : 1));
  const frame: DioramaFrame = land.frame ?? frameFromCoast(land.data.coastline);
  const groundY = (x: number, y: number) => land.dioramaGroundAt?.(x, y) ?? toDiorama(frame, x, y, land.rawHeightAt(x, y))[1];
  const du = (x: number, y: number): Point2 => [(x - frame.centre[0]) * frame.scale, (y - frame.centre[1]) * frame.scale];

  // --- scene graph ---------------------------------------------------------------------------------------------
  const scene = new THREE.Scene();
  scene.name = "journey-map-scene";
  // L2's clay lights: hemisphere + ambient + the sun that casts the real shadow map on the full tier (blob shadows on lite).
  const lights = createClayLights(theme, tier);
  scene.add(lights.group);
  /** `world` scales / slides for Year; `island` spins (Month drag, chapter turn, Week yaw); the land lives in it. */
  const world = new THREE.Group(); world.name = "journey-map:world";
  const island = new THREE.Group(); island.name = "journey-map:island";
  world.add(island);
  scene.add(world);
  island.add(land.group);
  const yearGroup = new THREE.Group(); yearGroup.name = "journey-map:year";
  scene.add(yearGroup);
  const plinthRoot = new THREE.Group(); plinthRoot.name = "journey-map:plinth";
  const bezelRoot = new THREE.Group(); bezelRoot.name = "journey-map:bezel";
  const propsRoot = new THREE.Group(); propsRoot.name = "journey-map:month";
  const weekRoot = new THREE.Group(); weekRoot.name = "journey-map:week";
  island.add(plinthRoot, bezelRoot, propsRoot, weekRoot);

  const mats: KitMaterials = kitMaterials();
  const trailMats: KitMaterials = kitMaterials();
  trailMats.solid.transparent = true;
  trailMats.solid.depthWrite = false;
  trailMats.solid.polygonOffset = true; trailMats.solid.polygonOffsetFactor = -4; trailMats.solid.polygonOffsetUnits = -4;
  const plinthMat = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0 });
  plinthMat.name = "journey-map:plinth";
  const roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  roadMat.name = "journey-map:road";
  const miniMats = {
    normal: new THREE.MeshStandardMaterial({ roughness: 0.86 }),
    future: new THREE.MeshStandardMaterial({ roughness: 0.9, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0.32 }),
    empty: new THREE.MeshStandardMaterial({ roughness: 0.9, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0.55 }),
  };
  const camera = new THREE.PerspectiveCamera(JOURNEY_DIORAMA.fovDeg, width / height, 0.05, 200);

  // --- state ---------------------------------------------------------------------------------------------------
  let t = clamp(Number.isFinite(options.t) ? options.t : LEVEL_T.month, 0, 2);
  let chapterId: ChapterId = options.chapterId || board.currentChapterId;
  let selection: string | null = null;
  let safe: SafeInset = NO_INSET;
  let spin = 0, spinShown = 0, spinV = 0, orbit = 0;
  let turnYaw = 0, turnLift = 0;
  let turning: { start: number; dir: -1 | 1; to: ChapterId; swapped: boolean; yaw0: number } | null = null;
  let pull: { start: number; tr: ReturnType<typeof levelTransition> } | null = null;
  let dive: Point2 | null = null;
  const focus = { target: [0, 0, 0] as [number, number, number], zoom: 1 };
  const shown = { target: [0, 0, 0] as [number, number, number], zoom: 1 };
  let busHop: { start: number } | null = null;
  let arrivedWeek = t > 1.5;
  const anims = new Map<string, Anim>();
  let frameId = 0, sleeping = false, hidden = false, disposed = false, readySent = false, lastFrame = 0;
  let lastAnchors: MarkAnchor[] = [];

  // --- renderer lease ------------------------------------------------------------------------------------------
  const configure = (renderer: THREE.WebGLRenderer) => {
    renderer.setPixelRatio?.(dpr);
    renderer.setSize?.(width, height, false);
    renderer.setClearColor?.(0x000000, 0);
    if (renderer.shadowMap) { renderer.shadowMap.enabled = shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    const canvas = renderer.domElement;
    if (canvas) {
      canvas.style.width = "100%"; canvas.style.height = "100%"; canvas.style.display = "block"; canvas.style.touchAction = "none";
      canvas.setAttribute("aria-hidden", "true");
    }
  };
  const lease = acquireWorldRenderer(host, {
    priority: 1, configure,
    parameters: { antialias: tier === "full", alpha: true, powerPreference: "low-power" },
    onResume: () => invalidate(),
    rendererFactory: options.rendererFactory, shared: options.shared,
  });

  // --- plinth + bezel (theme; bezel road repainted per chapter) ------------------------------------------------
  const roadGeo = new THREE.TorusGeometry(JOURNEY_DIORAMA.bezel.road, 0.34, 12, 248);
  roadGeo.rotateX(-Math.PI / 2);
  roadGeo.scale(1, 0.28, 1);
  roadGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(roadGeo.attributes.position!.count * 3), 3));
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.name = "journey-map:road";
  roadMesh.position.y = BEZEL_Y + 0.01;
  roadMesh.receiveShadow = true;
  roadGeo.userData.shared = true;

  function buildPlinth() {
    for (const c of [...plinthRoot.children]) { plinthRoot.remove(c); disposeBaked(c); }
    const p = boardPalette(theme);
    const { inner, outer } = JOURNEY_DIORAMA.bezel;
    const sea = JOURNEY_DIORAMA.slab.sea;
    const plinth = new THREE.Mesh(lathe(96, 0, -1.2, 4.95, -1.2, 5.15, -1.05, 5.24, -0.7, 5.24, 0.12, 5.2, 0.26, 5.1, 0.335, 4.96, 0.352), plinthMat);
    plinth.name = "journey-map:plinth-body";
    plinth.receiveShadow = true;
    plinth.castShadow = shadows;
    if (p.plinthFinish === "clapboard") { plinthMat.map = clapboardTex(); plinthMat.color.set(0xffffff); } else { plinthMat.map = null; plinthMat.color.set(p.plinth); }
    plinthMat.needsUpdate = true;
    const dress = new THREE.Group();
    for (const y of [-0.62, -0.18]) dress.add(at(part(flatTorus(5.25, 0.05, 6, 96), p.plinth2), 0, y, 0));
    dress.add(at(part(flatRing(inner, outer, 128), p.sand), 0, BEZEL_Y + 0.002, 0));
    dress.add(at(part(new THREE.CylinderGeometry(inner + 0.01, inner + 0.01, BEZEL_Y - sea + 0.004, 96, 1, true), p.sand), 0, (BEZEL_Y + sea) / 2, 0));
    dress.add(at(part(flatRing(0, inner + 0.02, 96), p.water), 0, sea, 0));
    dress.add(at(blob(7.2, 0.22), 0, -1.22, 0));
    const baked = bake(dress, mats, false, "journey-map:plinth-dress");
    plinthRoot.add(plinth, baked.group);
  }

  function paintBezel(layout: ClockLayout) {
    for (const c of [...bezelRoot.children]) { if (c !== roadMesh) { bezelRoot.remove(c); disposeBaked(c); } }
    if (!roadMesh.parent) bezelRoot.add(roadMesh);
    const p = boardPalette(theme);
    const pos = roadGeo.attributes.position!, col = roadGeo.attributes.color!;
    const cPast = new THREE.Color(p.roadPast), cFut = new THREE.Color(p.roadFuture), cNow = new THREE.Color(p.road), cToday = new THREE.Color(p.road).lerp(new THREE.Color(p.honey), 0.35);
    const beyond = cPast.clone().lerp(cNow, 0.3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      let th = Math.atan2(pos.getX(i), -pos.getZ(i));
      if (th < 0) th += Math.PI * 2;
      const d = Math.floor((th / (Math.PI * 2)) * JOURNEY_DIORAMA.slots + 0.5) + 1;
      const slot = layout.slots[(d > JOURNEY_DIORAMA.slots ? 1 : d) - 1]!;
      if (!slot.date) c.copy(beyond); else if (slot.relation === "past") c.copy(cPast); else if (slot.relation === "today") c.copy(cToday); else c.copy(cFut);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    // Studs: one per day the month has (a bigger one each Monday-ish week start is the prototype's every-7th).
    const studs = new THREE.Group();
    for (const s of layout.slots) {
      if (!s.date || (s.slot - 1) % 7 === 0) continue;
      const colr = s.relation === "today" ? p.honey : s.relation === "past" ? `#${new THREE.Color(p.roadPast).multiplyScalar(0.9).getHexString()}` : p.stud;
      const [x, z] = polar(s.angle, 5.08);
      studs.add(at(part(new THREE.SphereGeometry(0.05, 10, 6), colr), x, BEZEL_Y + 0.03, z, { s: [1, 0.6, 1] }));
    }
    bezelRoot.add(bake(studs, mats, shadows, "journey-map:studs").group);
    // The chapter gate stands apart so it can hide past t 1.3 with the numerals (the prototype's `ringGate`): in Week
    // it would stand over the trail as a stray arch.
    const gate = chapterGate(theme);
    gate.position.set(layout.gate.at[0], BEZEL_Y + 0.12, layout.gate.at[1]);
    gate.rotation.y = -layout.gate.angle;
    gateNode = bake(gate, mats, shadows, "journey-map:gate").group;
    bezelRoot.add(gateNode);
  }
  let gateNode: THREE.Object3D | null = null;

  // --- Month props on the bezel ---------------------------------------------------------------------------------
  let clock: ClockLayout = layoutClock(board, chapterId);
  let slotNodes: SlotNode[] = [];
  let bus: { group: THREE.Group; top: number } | null = null;
  const stopById = () => new Map(board.stops.map((s) => [s.id, s] as const));

  function itemOn(stop: Stop, item: ClockItem | null, r: number, propS: number, level: "month" | "week"): { group: THREE.Group; top: number } {
    const it = new THREE.Group();
    const stack = stackFor(stop, level);
    let h = 0;
    if (stack) {
      const s = coinStack(stack, r, RING_HEIGHT_DU[level], theme);
      it.add(s.group);
      h = s.height;
      if (stack.direction === "in") {
        // The mint "coming in" arrow, as a small upward cone (the arrow glyph; words stay in the DOM).
        it.add(at(part(new THREE.ConeGeometry(r * 0.35, r * 0.6, 8), colourOf(theme, "mintEdge")), r * 1.05, r * 0.6, r * 0.4));
      }
    }
    const pm = propModel(item?.prop ?? propKindFor(stop), theme);
    stylePaint(pm, { pale: item ? item.pale : stack?.fill === "see-through", faded: item?.faded });
    pm.scale.setScalar(propS);
    pm.position.y = h + 0.004;
    it.add(pm);
    return { group: it, top: h + PROP_TOP * propS };
  }

  function buildMonth(hidden: boolean) {
    for (const n of slotNodes) { propsRoot.remove(n.group); disposeBaked(n.group); }
    if (bus) { propsRoot.remove(bus.group); disposeBaked(bus.group); bus = null; }
    slotNodes = [];
    clock = layoutClock(board, chapterId);
    const pal = boardPalette(theme);
    const byId = stopById();
    for (const slot of clock.slots) {
      if (!slot.stopIds.length) continue;
      const g = new THREE.Group();
      g.position.set(...polarAt(slot.angle, JOURNEY_DIORAMA.bezel.road + 0.04, BEZEL_Y + 0.09));
      g.rotation.y = Math.PI - slot.angle;
      const base = new THREE.Group();
      const padCol = slot.allOpen ? pal.roadFuture : `#${new THREE.Color(pal.roadPast).multiplyScalar(0.92).getHexString()}`;
      base.add(at(part(new THREE.CylinderGeometry(0.3, 0.32, 0.05, 24), slot.allOpen ? { color: padCol, alpha: 0.8 } : padCol), 0, 0.02, 0));
      if (slot.allOpen) for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        base.add(at(part(rbox(0.07, 0.02, 0.025, 0.008, 1), { color: pal.ink, alpha: 0.35 }), Math.cos(a) * 0.33, 0.05, Math.sin(a) * 0.33, { ry: -a + Math.PI / 2 }));
      }
      base.add(at(blob(0.4, 0.35), 0, 0.055, 0));
      let ring: THREE.Object3D | null = null;
      if (slot.needsYou) base.add(at(needRing(0.35, 0.04, theme), 0, 0.04, 0));
      const pop = new THREE.Group();
      pop.position.y = 0.045;
      let top = 0;
      for (const item of slot.items) {
        const stop = byId.get(item.stopId);
        if (!stop) continue;
        const it = itemOn(stop, item, item.small ? 0.085 : 0.11, PROP_SCALE * (item.small ? 0.74 : 1), "month");
        it.group.position.set(item.along, 0, item.radial);
        pop.add(it.group);
        top = Math.max(top, it.top);
      }
      if (slot.more > 0) pop.add(at(moreBead(theme), 0.2, 0.1, 0));
      const bakedBase = bake(base, mats, shadows, `journey-map:slot-base:${slot.slot}`).group;
      const bakedPop = bake(pop, mats, shadows, `journey-map:slot:${slot.slot}`).group;
      g.add(bakedBase, bakedPop);
      ring = slot.needsYou ? bakedBase : null;
      let bead: THREE.Object3D | null = null;
      if (slot.needsYou) {
        const b = needBeadGeometryParts(theme);
        b.scale.setScalar(0.16);
        const bb = bake(b, mats, false, `journey-map:bead:${slot.slot}`).group;
        bb.position.set(0.3, 0.2, 0.12);
        bb.scale.setScalar(0.16);
        g.add(bb);
        bead = bb;
      }
      bakedPop.scale.setScalar(hidden ? 0.001 : 1);
      propsRoot.add(g);
      slotNodes.push({ slot, group: g, pop: bakedPop, bead, ring, top: top + 0.05 + 0.045, ord: 0, bounce: 0 });
    }
    if (clock.bus) {
      const b = bake(makeBus(theme), mats, shadows, "journey-map:bus").group;
      b.position.set(clock.bus.at[0], BEZEL_Y + 0.06, clock.bus.at[1]);
      b.rotation.y = clock.bus.heading;
      b.scale.setScalar(hidden ? 0.001 : BUS_SCALE);
      propsRoot.add(b);
      bus = { group: b, top: BUS_TOP * BUS_SCALE };
    }
    // Front-first order for the level pop (nearest the camera = largest z at rest).
    const ord = [...slotNodes].sort((a, b) => b.group.position.z - a.group.position.z);
    ord.forEach((n, i) => { n.ord = i / Math.max(1, ord.length - 1); });
    paintBezel(clock);
  }
  const polarAt = (th: number, r: number, y: number): [number, number, number] => { const [x, z] = polar(th, r); return [x, y, z]; };

  // --- Hercules on The Green -------------------------------------------------------------------------------------
  let herc: { group: THREE.Group; head: THREE.Group; tail: THREE.Group; y: number; spot: Point2 } | null = null;
  let week: WeekLayout | null = null;
  /** The Week's calm request: rebuilt with each Week layout, so the land recomputes its field once per week, not per frame. */
  let calmFor: JourneyLandCalm | null = null;
  let calmShown = -1, calmAt = 0;
  function pushCalm(amount: number) {
    if (!land.setCalm) return;
    const q = calmFor ? amount : 0;
    if (Math.abs(q - calmShown) < 0.004) return;
    const resting = q === 0 || q === 1;
    const tNow = now();
    if (!resting && tNow - calmAt < CALM_THROTTLE_MS) { invalidate(); return; }
    calmAt = tNow; calmShown = q;
    land.setCalm(q > 0 && calmFor ? calmFor : null, q);
  }
  function herculesSpot(): Point2 | null {
    const green = land.data.districts.find((d) => d.id === "green")?.heart ?? null;
    if (!green) return null;
    const trail = week ? [...week.pastTrail, ...week.trail] : [];
    const tries: Point2[] = [[40, 30], [70, 10], [0, 50], [-30, 40], [0, 0]].map(([dx, dy]) => [green[0] + dx!, green[1] + dy!]);
    for (const c of tries) {
      if (!isDry(land.data, c[0], c[1], 40)) continue;
      if (trail.length > 1 && distToLine(trail, c[0], c[1], false) < 80) continue;
      return c;
    }
    return tries[0]!;
  }
  function buildHercules() {
    if (herc) { island.remove(herc.group); disposeBaked(herc.group); herc = null; }
    const spot = herculesSpot();
    if (!spot) return;
    const h = makeHercules(theme);
    const group = new THREE.Group();
    group.name = "journey-map:hercules";
    const body = bake(h.body, mats, shadows, "journey-map:hercules-body").group;
    const head = bake(h.head, mats, shadows, "journey-map:hercules-head").group;
    const tail = bake(h.tail, mats, shadows, "journey-map:hercules-tail").group;
    group.add(body, head, tail);
    const [x, z] = du(spot[0], spot[1]);
    const y = groundY(spot[0], spot[1]) - 0.03;
    group.position.set(x, y, z);
    group.rotation.y = 0.25;
    group.scale.setScalar(HERCULES_SCALE);
    island.add(group);
    herc = { group, head, tail, y, spot };
  }

  // --- Week ------------------------------------------------------------------------------------------------------
  let tileNodes: TileNode[] = [];
  let trailGroup: THREE.Group | null = null;
  let weekBus: THREE.Group | null = null;
  let wFrame: WeekFrame | null = null;

  function ribbon(pts: readonly Point2[], widthDu: number, lift: number, color: string, alpha = 1): THREE.Mesh {
    const n = pts.length, pos: number[] = [], idx: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(n - 1, i + 1)]!;
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const hw = widthDu / 2 / frame.scale;
      for (const s of [1, -1]) {
        const x = pts[i]![0] - ty * hw * s, y = pts[i]![1] + tx * hw * s;
        const [dx, dz] = du(x, y);
        pos.push(dx, groundY(x, y) + lift, dz);
      }
      if (i < n - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const nn = g.attributes.normal!;
    for (let i = 0; i < nn.count; i += 1) if (nn.getY(i) < 0) nn.setXYZ(i, -nn.getX(i), -nn.getY(i), -nn.getZ(i));
    return part(g, { color, alpha });
  }

  function tileBody(tile: WeekTile | null, opts: { edge: number; colour: string; stone: boolean; today: boolean; next: boolean; needsYou: boolean; at: Point2; tangent: Point2 }) {
    const pal = boardPalette(theme);
    const w = opts.edge;
    const rr = Math.atan2(-opts.tangent[1], opts.tangent[0]);
    const R = w / 2 / frame.scale * 0.92;
    const hs = [[0, 0], [R, 0], [-R, 0], [0, R], [0, -R], [R * 0.7, R * 0.7], [-R * 0.7, -R * 0.7], [R * 0.7, -R * 0.7], [-R * 0.7, R * 0.7]]
      .map((q) => groundY(opts.at[0] + q[0]!, opts.at[1] + q[1]!));
    const top = Math.max(...hs) + 0.06, bot = Math.min(...hs) - 0.05;
    const root = new THREE.Group();
    const [x, z] = du(opts.at[0], opts.at[1]);
    root.position.set(x, 0, z);
    root.rotation.y = rr;
    const body = new THREE.Group();
    const ph = Math.max(0.08, top - bot);
    body.add(at(part(rbox(w * 1.1, ph + 0.04, w * 1.1, Math.min(0.06, w * 0.18), 3), pal.ped), 0, -ph / 2 - 0.02, 0));
    const th = opts.stone ? 0.07 : 0.12;
    body.add(at(part(rbox(w, th, w, Math.min(0.06, w * 0.18), 3), opts.colour), 0, -0.04 - (0.12 - th) / 2, 0));
    if (opts.today) body.add(at(part(flatTorus(w * 0.64, 0.032, 8, 40), pal.tbase), 0, -0.07, 0));
    if (opts.next) body.add(at(part(flatTorus(w * 0.62, 0.03, 8, 40), pal.honey), 0, -0.07, 0));
    if (opts.needsYou) body.add(at(needRing(w * 0.6, 0.03, theme), 0, 0.03, 0));
    void tile;
    return { root, body, top };
  }

  function buildWeek() {
    for (const n of tileNodes) { weekRoot.remove(n.group); disposeBaked(n.group); }
    tileNodes = [];
    if (trailGroup) { weekRoot.remove(trailGroup); disposeBaked(trailGroup); trailGroup = null; }
    if (weekBus) { weekRoot.remove(weekBus); disposeBaked(weekBus); weekBus = null; }
    if (!board.week || !board.week.days.length || land.data.yearWalk.length === 0) { week = null; wFrame = null; calmFor = null; calmShown = -1; return; }
    week = layoutWeek(board, land.data, frame, { orientation: isPhone(width) ? "phone" : "wide" });
    calmFor = {
      trail: [...week.pastTrail, ...week.trail],
      clear: [...week.tiles.map((tl) => ({ x: tl.at[0], y: tl.at[1], r: (tl.edgeDu * 0.56) / frame.scale })), ...(week.pile ? [{ x: week.pile.at[0], y: week.pile.at[1], r: (week.pile.edgeDu * 0.56) / frame.scale }] : [])],
    };
    calmShown = -1;
    const pal = boardPalette(theme);
    const byId = stopById();
    // The paper trail: past (faded), this week, the ink edge and Storybook dashes, a spur to the pile.
    const trail = new THREE.Group();
    for (const [pts, colour] of [[week.pastTrail, pal.roadPast], [week.trail, pal.lane]] as const) {
      if (pts.length < 2) continue;
      trail.add(ribbon(pts, 0.24, 0.02, pal.ink, 0.42));
      trail.add(ribbon(pts, 0.19, 0.024, colour));
    }
    if (week.spur.length === 2) trail.add(ribbon(resample(week.spur, 7), 0.08, 0.022, pal.lane));
    const s1 = week.tiles.length ? week.tiles[week.tiles.length - 1]!.arc + 90 : 0;
    for (let s = week.tiles[0]?.arc ?? 0; s < s1; s += 22) {
      if (week.tiles.some((tl) => Math.abs(tl.arc - s) < (tl.edgeDu * 0.56) / frame.scale + 12) || Math.abs(s - week.stationArc) < 22) continue;
      const p = walkAt(week.walk, s);
      const [x, z] = du(p.x, p.y);
      trail.add(at(part(rbox(0.06, 0.008, 0.02, 0.004, 1), { color: pal.ink, alpha: 0.6 }), x, groundY(p.x, p.y) + 0.03, z, { ry: Math.atan2(-p.ty, p.tx) }));
    }
    trailGroup = bake(trail, trailMats, false, "journey-map:trail").group;
    weekRoot.add(trailGroup);
    const colourOfTile = (tl: WeekTile) => pal[tl.colour];
    for (const tl of week.tiles) {
      const tb = tileBody(tl, { edge: tl.edgeDu, colour: colourOfTile(tl), stone: tl.size === "stone", today: tl.size === "today", next: tl.next, needsYou: tl.needsYou, at: tl.at, tangent: tl.tangent });
      let topY = 0.05;
      const toys = tl.toyIds.map((id) => byId.get(id)).filter((s): s is Stop => !!s);
      toys.forEach((stop, i) => {
        const today = tl.size === "today";
        const it = itemOn(stop, null, today ? 0.12 : 0.13, today ? 1.15 : 1.25, "week");
        const sd = toys.length > 1 ? (i ? 0.22 : -0.22) : 0;
        it.group.position.set(0.24 * (today ? 1 : 0.4), 0.02, sd);
        tb.body.add(it.group);
        topY = Math.max(topY, it.top);
      });
      const bodyBaked = bake(tb.body, mats, shadows, `journey-map:tile:${tl.date}`).group;
      bodyBaked.position.y = tb.top;
      tb.root.add(bodyBaked);
      const billboards: THREE.Object3D[] = [];
      if (tl.next) {
        const badge = bake(nextBadgeParts(theme), mats, false, `journey-map:next:${tl.date}`).group;
        badge.scale.setScalar(0.22);
        badge.position.set(tl.edgeDu * 0.46, 0.06, -tl.edgeDu * 0.46);
        bodyBaked.add(badge); billboards.push(badge);
      }
      if (tl.needsYou) {
        const bead = bake(needBeadGeometryParts(theme), mats, false, `journey-map:tile-bead:${tl.date}`).group;
        bead.scale.setScalar(0.18);
        bead.position.set(tl.edgeDu * 0.42, 0.22, tl.edgeDu * 0.3);
        bodyBaked.add(bead); billboards.push(bead);
      }
      weekRoot.add(tb.root);
      tileNodes.push({ tile: tl, group: tb.root, body: bodyBaked, top: tb.top, topY: tb.top + topY, ord: 0, ids: tl.stopIds.length ? tl.stopIds : [tl.date], bump: 0, billboards });
    }
    if (week.pile && week.tiles[0]) {
      const pile = week.pile;
      const tb = tileBody(null, { edge: pile.edgeDu, colour: pal.tcheck, stone: false, today: false, next: false, needsYou: true, at: pile.at, tangent: week.tiles[0].tangent });
      const cols = [pal.tout, pal.tjar, pal.tin, "#ffffff", pal.tcheck];
      const cards = Math.min(5, Math.max(1, pile.count));
      for (let i = 0; i < cards; i += 1) {
        const w = pile.edgeDu;
        tb.body.add(at(part(rbox(w * 0.5, 0.045, w * 0.36, 0.02, 2), cols[i % cols.length]!), (i % 2 ? 0.03 : -0.03) - w * 0.12, 0.05 + i * 0.05, (i % 3 - 1) * 0.025 - w * 0.06, { ry: (i - 2) * 0.22 }));
      }
      const bodyBaked = bake(tb.body, mats, shadows, "journey-map:pile").group;
      bodyBaked.position.y = tb.top;
      tb.root.add(bodyBaked);
      // The count badge ("8 !") is the pile mark's own DOM ring (words, not a 3D bead), as the prototype's one tag.
      weekRoot.add(tb.root);
      tileNodes.push({ tile: null, group: tb.root, body: bodyBaked, top: tb.top, topY: tb.top + 0.05 + cards * 0.05 + 0.03, ord: 0, ids: pile.stopIds, bump: 0, billboards: [] });
    }
    weekBus = bake(makeBus(theme), mats, shadows, "journey-map:week-bus").group;
    weekBus.scale.setScalar(0.001);
    weekRoot.add(weekBus);
    const pts: Point2[] = week.tiles.map((tl) => du(tl.at[0], tl.at[1]));
    if (week.pile) pts.push(du(week.pile.at[0], week.pile.at[1]));
    const gy = week.tiles.reduce((s, tl) => s + groundY(tl.at[0], tl.at[1]), 0) / Math.max(1, week.tiles.length);
    wFrame = weekFrame(pts, week.yaw, gy);
    // Front-first: nearest the Week camera pops first.
    const cY = Math.cos(wFrame.yaw), sY = Math.sin(wFrame.yaw);
    const ord = [...tileNodes].sort((a, b) => (-b.group.position.x * sY + b.group.position.z * cY) - (-a.group.position.x * sY + a.group.position.z * cY));
    ord.forEach((n, i) => { n.ord = i / Math.max(1, ord.length - 1); });
    busHome();
  }
  function busSpot(i: -1 | 0): { v: THREE.Vector3; rot: number } | null {
    if (!week || !tileNodes[0] || !week.tiles[0]) return null;
    if (i < 0) {
      const p = walkAt(week.walk, week.tiles[0].arc - 150);
      const [x, z] = du(p.x, p.y);
      return { v: new THREE.Vector3(x, groundY(p.x, p.y) + 0.03, z), rot: Math.atan2(-p.ty, p.tx) };
    }
    const n = tileNodes[0];
    const v = new THREE.Vector3(-0.12, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), n.group.rotation.y).add(n.group.position);
    v.y = n.top + 0.005;
    return { v, rot: n.group.rotation.y + Math.PI / 2 };
  }
  function busHome() {
    const s = busSpot(0);
    if (!s || !weekBus) return;
    weekBus.position.copy(s.v);
    weekBus.rotation.y = s.rot;
  }

  // --- Year ring ---------------------------------------------------------------------------------------------------
  let miniNodes: MiniNode[] = [];
  const miniGeometry = land.miniGeometry?.() ?? null;
  const fallbackMini = miniGeometry ? null : (() => { const g = new THREE.CircleGeometry(JOURNEY_DIORAMA.islandUnits * 0.92, 40); g.rotateX(-Math.PI / 2); g.translate(0, JOURNEY_DIORAMA.slab.top, 0); return g; })();
  const miniInstanced: THREE.InstancedMesh[] = [];
  function buildYear() {
    for (const n of miniNodes) { yearGroup.remove(n.group); disposeBaked(n.group); }
    for (const m of miniInstanced) { yearGroup.remove(m); m.dispose(); }
    miniInstanced.length = 0;
    miniNodes = [];
    const p = boardPalette(theme);
    const layout = layoutYear(board);
    const geo = miniGeometry ?? fallbackMini!;
    const vertexColors = !!geo.getAttribute("color");
    for (const m of Object.values(miniMats)) { m.vertexColors = vertexColors; m.color.set(vertexColors ? 0xffffff : p.grass); m.needsUpdate = true; }
    const byTreatment = { normal: [] as THREE.Matrix4[], future: [] as THREE.Matrix4[], empty: [] as THREE.Matrix4[] };
    for (const mini of layout.minis) {
      const g = new THREE.Group();
      g.position.set(mini.at[0], 0, mini.at[1]);
      const empty = mini.treatment === "empty", future = mini.treatment === "future";
      // The plinth drum stops at the bezel's inner edge and steps down under the sea, so the mini's water shows.
      g.add(part(lathe(40, 0, -0.5, 1.55, -0.5, 1.64, -0.3, 1.64, 0.1, 1.58, 0.15, 1.14, 0.15, 1.14, 0.1, 0, 0.1), empty ? p.roadPast : p.plinth));
      g.add(at(part(flatRing(1.14, 1.58, 48), p.sand), 0, 0.152, 0));
      g.add(at(part(flatRing(0, 1.15, 48), p.water), 0, 0.12, 0));
      const rg = new THREE.TorusGeometry(YEAR_MINI_ROAD, 0.09, 6, 64); rg.rotateX(-Math.PI / 2); rg.scale(1, 0.3, 1);
      g.add(at(part(rg, future || empty ? p.roadFuture : p.road), 0, 0.17, 0));
      if (empty) for (let i = 0; i < 24; i += 1) {
        const a = (i / 24) * Math.PI * 2;
        g.add(at(part(rbox(0.16, 0.02, 0.05, 0.01, 1), { color: p.ink, alpha: 0.35 }), Math.cos(a) * YEAR_MINI_ROAD, 0.21, Math.sin(a) * YEAR_MINI_ROAD, { ry: -a + Math.PI / 2 }));
      }
      for (const dot of mini.dots) {
        const col = dot.kind === "check" ? p.honey : dot.kind === "open" ? "#ffffff" : p.ink;
        g.add(at(part(new THREE.SphereGeometry(dot.kind === "check" ? 0.09 : 0.06, 8, 6), dot.kind === "open" ? { color: col, alpha: 0.85 } : col), dot.at[0], 0.25, dot.at[1]));
      }
      if (mini.toCheck > 0) {
        g.add(at(needRing(1.68, 0.05, theme), 0, -0.02, 0));
        const bead = needBeadGeometryParts(theme); bead.scale.setScalar(0.5); bead.position.set(1.45, 0.5, 1.0); g.add(bead);
      }
      let top = 0.2;
      const [sx, sz] = polar(YEAR_STACK_AT.angle, YEAR_STACK_AT.radius);
      mini.stack.forEach((col, i) => {
        const s = coinStack({ cents: col.cents, rings: col.rings, fill: col.fill, direction: "out", heightDu: Math.max(0.012, col.rings.drawnRings * RING_HEIGHT_DU.year) }, 0.2, RING_HEIGHT_DU.year, theme);
        // Side by side, never stacked: recorded and not-recorded are different money.
        s.group.position.set(sx + (mini.stack.length > 1 ? (i ? 0.23 : -0.23) : 0), 0.12, sz);
        g.add(s.group);
        top = Math.max(top, 0.12 + s.height);
      });
      if (mini.kept) {
        g.add(at(part(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), p.trunk), -0.9, 0.4, -0.9));
        g.add(at(part(new THREE.ConeGeometry(0.12, 0.3, 3), p.gate), -0.75, 0.58, -0.9, { rz: -Math.PI / 2 }));
      }
      if (mini.today && board.today.slice(0, 7) === mini.chapterId) {
        const b = makeBus(theme);
        const th = slotAngleOf(board.today);
        const [bx, bz] = polar(th, YEAR_MINI_ROAD);
        b.position.set(bx, 0.16, bz); b.rotation.y = Math.atan2(-Math.sin(th), Math.cos(th)); b.scale.setScalar(0.62);
        g.add(b);
      }
      const baked = bake(g, mats, shadows, `journey-map:mini:${mini.chapterId}`).group;
      yearGroup.add(baked);
      miniNodes.push({ mini, group: baked, top });
      const mtx = new THREE.Matrix4().compose(new THREE.Vector3(mini.at[0], 0.12 - JOURNEY_DIORAMA.slab.sea * YEAR_MINI_SCALE, mini.at[1]), new THREE.Quaternion(), new THREE.Vector3(YEAR_MINI_SCALE, YEAR_MINI_SCALE, YEAR_MINI_SCALE));
      (empty ? byTreatment.empty : future ? byTreatment.future : byTreatment.normal).push(mtx);
    }
    for (const [key, list] of Object.entries(byTreatment) as [keyof typeof byTreatment, THREE.Matrix4[]][]) {
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(geo, miniMats[key], list.length);
      im.name = `journey-map:minis:${key}`;
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.receiveShadow = true;
      im.userData.chapters = layout.minis.filter((mm) => (mm.treatment === "empty" ? "empty" : mm.treatment === "future" ? "future" : "normal") === key).map((mm) => mm.chapterId);
      im.userData.matrices = list;
      yearGroup.add(im);
      miniInstanced.push(im);
    }
  }
  const slotAngleOf = (date: string) => ((Number(date.slice(8, 10)) - 1) / JOURNEY_DIORAMA.slots) * Math.PI * 2;
  function showMini(chapter: ChapterId | null) {
    for (const n of miniNodes) n.group.visible = n.mini.chapterId !== chapter;
    for (const im of miniInstanced) {
      const ids = im.userData.chapters as ChapterId[], list = im.userData.matrices as THREE.Matrix4[];
      ids.forEach((id, i) => im.setMatrixAt(i, id === chapter ? new THREE.Matrix4().makeScale(0, 0, 0) : list[i]!));
      im.instanceMatrix.needsUpdate = true;
    }
  }

  // --- build all -----------------------------------------------------------------------------------------------
  function applyTheme() {
    lights.setTheme(theme);
  }
  function buildAll() {
    applyTheme();
    buildPlinth();
    buildWeek();
    buildMonth(false);
    buildHercules();
    buildYear();
  }
  buildAll();

  // --- per frame -----------------------------------------------------------------------------------------------
  const cameraView = (): CameraView => ({ width, height, safe, focus: { target: shown.target, zoom: shown.zoom }, week: wFrame, dive });
  const tmpQ = new THREE.Quaternion();
  function applyPose(dt: number) {
    const k = reduced() ? 1 : 1 - Math.pow(0.0015, dt);
    for (let i = 0; i < 3; i += 1) shown.target[i] = shown.target[i]! + (focus.target[i]! - shown.target[i]!) * k;
    shown.zoom += (focus.zoom - shown.zoom) * k;
    const pose = cameraAt(t, cameraView());
    camera.aspect = width / height;
    camera.position.set(...pose.position);
    camera.lookAt(...pose.lookAt);
    camera.setViewOffset(width, height, pose.offset[0], pose.offset[1], width, height);
    camera.updateProjectionMatrix();
    world.scale.setScalar(pose.worldScale);
    world.position.set(pose.worldPosition[0], 0, pose.worldPosition[1]);
    yearGroup.scale.setScalar(pose.yearScale);
    yearGroup.visible = pose.yearScale > 0.02;
    // Spin: inertia on Month, eased back to rest off Month.
    if (!turning) {
      const month = t >= 0.5 && t <= 1.5;
      if (!month) { spin *= Math.pow(0.02, dt); spinV = 0; }
      if (!drag && Math.abs(spinV) > 0.001 && !reduced()) { spin += spinV * dt; spinV *= Math.pow(0.02, dt); if (Math.abs(spinV) < 0.02) spinV = 0; }
      if (reduced()) { spinV = 0; if (!month) spin = 0; }
      spinShown = reduced() ? spin : spinShown + (spin - spinShown) * (1 - Math.pow(0.0001, dt));
      if (t <= 1.5) orbit *= Math.pow(0.05, dt);
    }
    island.rotation.y = (turning ? turnYaw : islandYawAt(t, spinShown, wFrame, orbit));
    island.position.y = turnLift;
    return Math.abs(shown.zoom - focus.zoom) > 1e-3 || shown.target.some((v, i) => Math.abs(v - focus.target[i]!) > 1e-3) || Math.abs(spinV) > 0.001 || Math.abs(spin - spinShown) > 1e-3 || (!(t >= 0.5 && t <= 1.5) && Math.abs(spin) > 1e-3) || Math.abs(orbit) > 1e-3 && t <= 1.5;
  }

  function applyPops(clockSec: number): boolean {
    const P = popsAt(t, reduced());
    let moving = false;
    for (const n of slotNodes) {
      const turnS = turning ? (n.group.userData.turnS as number | undefined) ?? 1 : 1;
      const s = Math.max(0.001, turnS * P.monthProp(n.ord));
      n.pop.scale.setScalar(s);
      n.pop.position.y = n.bounce;
      n.group.visible = s > 0.002 || t < 1.5;
      if (n.bead) n.bead.visible = s > 0.05;
    }
    if (bus) {
      const turnS = turning ? (bus.group.userData.turnS as number | undefined) ?? 1 : 1;
      const s = Math.max(0.001, turnS * P.bus);
      bus.group.scale.setScalar(BUS_SCALE * s);
      bus.group.visible = s > 0.002;
    }
    weekRoot.visible = P.weekVisible;
    if (gateNode) gateNode.visible = P.numerals;
    trailMats.solid.opacity = P.trail;
    trailMats.glass.opacity = P.trail;
    for (const n of tileNodes) {
      const k = P.weekTile(n.ord);
      const s = Math.max(0.001, tilePop(k));
      n.body.scale.setScalar(s);
      n.body.position.y = n.top + (1 - Math.min(1, k * 1.3)) * 0.25 + n.bump;
      n.group.visible = k > 0;
    }
    if (weekBus) {
      const s = Math.max(0.001, 0.62 * P.weekBus);
      weekBus.scale.setScalar(s);
      weekBus.visible = t > 1.5;
      if (busHop) {
        const u = Math.min(1, (clockSec - busHop.start) / 0.9);
        const a = busSpot(-1), b = busSpot(0);
        if (a && b) {
          const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
          weekBus.position.lerpVectors(a.v, b.v, e);
          const f = (u * 2) % 1;
          weekBus.position.y += Math.sin(Math.PI * (u >= 1 ? 0 : f)) * 0.12;
          weekBus.rotation.y = b.rot;
        }
        if (u >= 1) { busHop = null; busHome(); } else moving = true;
      }
    }
    if (herc) {
      herc.group.scale.setScalar(Math.max(0.001, HERCULES_SCALE * P.hercules));
      herc.group.visible = P.hercules > 0.01;
      // Hercules looks toward the selection, else the bus (a gentle turn of the head, a cut under reduced motion).
      const look = selectedObject() ?? (t > 1.5 ? weekBus : bus?.group) ?? null;
      if (look) {
        const lp = look.getWorldPosition(new THREE.Vector3()), hp = herc.group.getWorldPosition(new THREE.Vector3());
        const want = Math.atan2(lp.x - hp.x, lp.z - hp.z) - herc.group.rotation.y - island.rotation.y;
        const goal = clamp(angDiff(want, 0), -0.7, 0.7);
        const d = goal - herc.head.rotation.y;
        herc.head.rotation.y += reduced() ? d : d * 0.2;
        if (Math.abs(d) > 0.01 && !reduced()) moving = true;
      }
    }
    pushCalm(P.calm);
    // Billboards (the "!" beads, the "›" badge) face the camera.
    camera.updateMatrixWorld();
    const faceCamera = (o: THREE.Object3D) => {
      o.parent?.getWorldQuaternion(tmpQ);
      o.quaternion.copy(tmpQ.invert().multiply(camera.quaternion));
    };
    for (const n of slotNodes) if (n.bead?.visible) faceCamera(n.bead);
    if (weekRoot.visible) for (const n of tileNodes) for (const b of n.billboards) faceCamera(b);
    if (yearGroup.visible) { /* Year beads ride the baked mini; they read from the Year camera's fixed heading. */ }
    return moving;
  }

  function selectedObject(): THREE.Object3D | null {
    if (!selection) return null;
    if (t > 1.5) return tileNodes.find((n) => n.ids.includes(selection!) || n.tile?.date === selection)?.group ?? null;
    return slotNodes.find((n) => n.slot.stopIds.includes(selection!) || n.slot.date === selection)?.group ?? null;
  }

  // --- anchors -------------------------------------------------------------------------------------------------
  const v3 = new THREE.Vector3();
  function project(o: THREE.Object3D | null, local: THREE.Vector3 | null, world?: THREE.Vector3): { x: number; y: number; z: number; depth: number } {
    if (world) v3.copy(world); else if (o && local) { o.updateWorldMatrix(true, false); v3.copy(local).applyMatrix4(o.matrixWorld); } else v3.set(0, 0, 0);
    const depth = camera.position.distanceTo(v3);
    v3.project(camera);
    return { x: ((v3.x + 1) / 2) * width, y: ((1 - v3.y) / 2) * height, z: v3.z, depth };
  }
  function computeAnchors(): MarkAnchor[] {
    scene.updateMatrixWorld(true);
    const out: MarkAnchor[] = [];
    const push = (id: string, p: { x: number; y: number; z: number; depth: number }, drawn: boolean) => {
      const inFront = p.z > -1 && p.z < 1, onStage = p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height;
      out.push({ id, x: round1(p.x), y: round1(p.y), depth: round1(p.depth), visible: drawn && inFront && onStage });
    };
    const level = levelForT(t);
    const month = level === "month", wk = level === "week", yr = level === "year";
    const turnHide = !!turning;
    // Month: each slot's date, each stop on it (toys at their own offset, the rest at the slot), the bus, numerals.
    for (const n of slotNodes) {
      const s = n.pop.scale.x;
      const head = project(n.group, new THREE.Vector3(0, n.top * Math.max(0.3, s), 0));
      if (n.slot.date) push(n.slot.date, head, month && !turnHide);
      for (const id of n.slot.stopIds) {
        const item = n.slot.items.find((i) => i.stopId === id);
        push(id, item ? project(n.group, new THREE.Vector3(item.along, n.top * Math.max(0.3, s), item.radial)) : head, month && !turnHide);
      }
    }
    for (const s of clock.slots) {
      if (s.stopIds.length || !s.date) continue;
      push(s.date, project(island, new THREE.Vector3(...polarAt(s.angle, JOURNEY_DIORAMA.bezel.road, BEZEL_Y + 0.1))), month && !turnHide);
    }
    if (bus) push(JOURNEY_MAP_MARKS.piece, project(bus.group, new THREE.Vector3(0, BUS_TOP, 0)), month && bus.group.visible);
    for (const nm of clock.numerals) push(`numeral:${nm.day}`, project(island, new THREE.Vector3(nm.at[0], BEZEL_Y + 0.12, nm.at[1])), t < 1.3 && !yr);
    push("numeral:1", project(island, new THREE.Vector3(clock.gate.at[0], BEZEL_Y + 0.5, clock.gate.at[1])), t < 1.3 && !yr);
    if (herc) push(JOURNEY_MAP_MARKS.hercules, project(herc.group, new THREE.Vector3(0, 1.5, 0)), herc.group.visible && t < 1.5 && t >= 0.5);
    // Week: each tile's date (and its stops), the pile, the bus — and `face:<date>`, the point on the tile's top face
    // nearest the camera, where the UI prints the day's tag ("WED 30 · $300") so it reads as printed on the tile.
    const camFlat = new THREE.Vector3();
    for (const n of tileNodes) {
      const p = project(n.group, new THREE.Vector3(0, n.topY, 0));
      const drawn = wk && n.group.visible;
      if (n.tile) {
        push(n.tile.date, p, drawn);
        for (const id of n.tile.stopIds) push(id, p, drawn);
        n.group.updateWorldMatrix(true, false);
        const c = new THREE.Vector3(0, n.top + 0.02, 0).applyMatrix4(n.group.matrixWorld);
        camFlat.set(camera.position.x - c.x, 0, camera.position.z - c.z);
        if (camFlat.lengthSq() > 1e-9) c.addScaledVector(camFlat.normalize(), n.tile.edgeDu * (n.tile.size === "stone" ? 0.05 : 0.3) * Math.max(0.001, n.body.scale.x));
        push(`face:${n.tile.date}`, project(null, null, c), drawn);
      } else { push(JOURNEY_MAP_MARKS.pile, p, drawn); for (const id of n.ids) push(id, p, drawn); }
    }
    if (weekBus) push(JOURNEY_MAP_MARKS.piece, project(weekBus, new THREE.Vector3(0, BUS_TOP, 0)), wk && weekBus.visible);
    // Year: each mini's chapter id (under the mini, where its label reads), and `centre:<chapter>` (decorative: the
    // mini's own centre, from which a phone leans its plate outward, as the prototype does).
    for (const n of miniNodes) {
      push(n.mini.chapterId, project(n.group, new THREE.Vector3(0, -0.55, 1.6)), yr && n.group.visible);
      push(`centre:${n.mini.chapterId}`, project(n.group, new THREE.Vector3(0, 0, 0)), yr && n.group.visible);
    }
    return dedupe(out);
  }
  /** One anchor per id: a visible one wins (the bus is "piece" on Month and on Week). */
  function dedupe(list: MarkAnchor[]): MarkAnchor[] {
    const by = new Map<string, MarkAnchor>();
    for (const a of list) { const prev = by.get(a.id); if (!prev || (!prev.visible && a.visible)) by.set(a.id, a); }
    return [...by.values()];
  }

  // --- frames --------------------------------------------------------------------------------------------------
  function invalidate() {
    if (frameId || sleeping || hidden || disposed || !lease.active) return;
    frameId = lease.requestFrame(frameCb);
  }
  function frameCb() {
    frameId = 0;
    if (disposed || sleeping || hidden) return;
    const tNow = now();
    const dt = Math.min(0.05, lastFrame ? (tNow - lastFrame) / 1000 : 1 / 60);
    lastFrame = tNow;
    let moving = false;
    for (const [key, a] of [...anims]) {
      const u = a.duration > 0 ? Math.min(1, (tNow - a.start) / a.duration) : 1;
      a.step(u);
      if (u >= 1) { anims.delete(key); a.end(); } else moving = true;
    }
    if (pull) {
      const s = (tNow - pull.start) / 1000;
      setT(pull.tr.at(s), false);
      if (pull.tr.done(s)) { pull = null; arrive(); } else moving = true;
    }
    if (turning) moving = stepTurn(tNow) || moving;
    moving = applyPose(dt) || moving;
    moving = applyPops(tNow / 1000) || moving;
    draw();
    if (moving || anims.size) invalidate(); else lastFrame = 0;
  }
  function draw() {
    lease.renderer.render(scene, camera);
    lastAnchors = computeAnchors();
    options.onAnchors(lastAnchors);
    if (!readySent && lease.active) { readySent = true; options.onReady(); }
  }

  // --- level / chapter -----------------------------------------------------------------------------------------
  function setT(v: number, report: boolean) {
    const prev = t;
    t = clamp(v, 0, 2);
    if (t >= 1 && dive) { dive = null; showMini(null); }
    if (prev <= 1.5 && t > 1.5) { focus.zoom = 1; focus.target = [0, 0, 0]; }
    if (report) options.onLevel(t, levelForT(t));
  }
  function arrive() {
    const wk = t > 1.5;
    if (wk && !arrivedWeek) { arrivedWeek = true; if (!reduced()) busHop = { start: now() / 1000 }; else busHome(); }
    if (!wk) arrivedWeek = false;
  }
  function goLevel(to: number, animate: boolean, report: boolean) {
    const target = clamp(to, 0, 2);
    if (!animate || reduced()) { pull = null; setT(target, report); arrive(); invalidate(); return; }
    const tr = levelTransition(t, target, false);
    pull = { start: now(), tr };
    if (report) {
      // Report the settled level once the pull lands (the UI reads `onLevel` for the pull's resting value too).
      const end = () => options.onLevel(t, levelForT(t));
      startAnim("pull-report", tr.duration * 1000, () => {}, end);
    }
    invalidate();
  }
  function stepTurn(tNow: number): boolean {
    const T = turning!;
    const u = Math.min(1, (tNow - T.start) / (CHAPTER_TURN_SECONDS * 1000));
    const f = chapterTurn(u, T.dir, T.yaw0);
    if (f.swapped && !T.swapped) { T.swapped = true; chapterId = T.to; buildMonth(true); }
    turnYaw = f.yaw; turnLift = f.lift;
    for (const n of slotNodes) n.group.userData.turnS = f.prop(n.slot.slot / JOURNEY_DIORAMA.slots);
    if (bus) bus.group.userData.turnS = f.bus;
    if (u >= 1) {
      turning = null; turnYaw = 0; turnLift = 0; spin = 0; spinShown = 0;
      for (const n of slotNodes) n.group.userData.turnS = 1;
      if (bus) bus.group.userData.turnS = 1;
      return false;
    }
    return true;
  }
  function startAnim(key: string, ms: number, step: (u: number) => void, end: () => void) {
    anims.get(key)?.end();
    anims.set(key, { start: now(), duration: ms, step, end });
    step(0);
    invalidate();
  }
  function bounce(n: { bounce?: number; bump?: number }, isTile: boolean) {
    if (reduced()) return;
    startAnim(isTile ? "bounce-tile" : "bounce-slot", 450, (u) => { const k = Math.sin(Math.PI * u) * 0.16; if (isTile) n.bump = k * 0.8; else n.bounce = k; }, () => { if (isTile) n.bump = 0; else n.bounce = 0; });
  }

  // --- input ---------------------------------------------------------------------------------------------------
  const pointers = new Map<number, { x: number; y: number }>();
  let drag: { x0: number; y0: number; x: number; t0: number; moved: boolean } | null = null;
  let pinch0: { d: number; t: number } | null = null;
  let wheelTimer: ReturnType<typeof setTimeout> | null = null;
  const local = (e: { clientX: number; clientY: number }) => {
    const r = host.getBoundingClientRect?.();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const unlisten: (() => void)[] = [];
  unlisten.push(lease.listenCanvas<PointerEvent>("pointerdown", (e) => {
    const p = local(e);
    pointers.set(e.pointerId, p);
    try { (e.target as Element | null)?.setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
    if (pointers.size === 1) drag = { x0: p.x, y0: p.y, x: p.x, t0: now(), moved: false };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), t }; drag = null; pull = null; }
  }));
  unlisten.push(lease.listenCanvas<PointerEvent>("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pinch0 && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (d > 0 && pinch0.d > 0) { pull = null; setT(pinch0.t + Math.log2(d / pinch0.d) * PINCH_T_PER_DOUBLING, true); invalidate(); }
      return;
    }
    if (drag && !turning && t >= 0.5) {
      const dx = p.x - drag.x;
      drag.x = p.x;
      if (Math.abs(p.x - drag.x0) > DRAG_SLOP || Math.abs(p.y - drag.y0) > DRAG_SLOP) drag.moved = true;
      if (drag.moved) {
        if (t > 1.5) orbit = clamp(orbit + dx * 0.005, -0.9, 0.9);
        else { spin += dx * 0.009; spinV = (dx * 0.009) / 0.016; }
        invalidate();
      }
    }
  }));
  const release = (e: PointerEvent, cancelled: boolean) => {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.delete(e.pointerId);
    if (pointers.size < 2 && pinch0) { pinch0 = null; goLevel(restOf(t), true, true); }
    if (drag && pointers.size === 0 && !cancelled && !drag.moved && now() - drag.t0 < TAP_MS) options.onPick(pickAt(p.x, p.y));
    if (pointers.size === 0) drag = null;
  };
  unlisten.push(lease.listenCanvas<PointerEvent>("pointerup", (e) => release(e, false)));
  unlisten.push(lease.listenCanvas<PointerEvent>("pointercancel", (e) => release(e, true)));
  unlisten.push(lease.listenCanvas<WheelEvent>("wheel", (e) => {
    e.preventDefault?.();
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    pull = null;
    setT(t - clamp(delta, -120, 120) * WHEEL_T_PER_PX, true);
    invalidate();
    if (wheelTimer) clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelTimer = null; if (!disposed) goLevel(restOf(t), true, true); }, 240);
  }, { passive: false }));
  unlisten.push(lease.listenCanvas<Event>("webglcontextlost", (e) => { e.preventDefault?.(); options.onLost(); }));
  const onVisibility = () => {
    hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    if (hidden) { if (frameId) { lease.cancelFrame(frameId); frameId = 0; } } else invalidate();
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);

  /** Every stop id under the pointer (a crowded pair of slots returns both slots' stops), a chapter, a date, or []. */
  function pickAt(x: number, y: number): string[] {
    const level = levelForT(t);
    const near = (a: MarkAnchor | undefined, r: number) => (a && a.visible ? Math.hypot(a.x - x, a.y - y) : Infinity) <= r;
    const anchor = new Map(lastAnchors.map((a) => [a.id, a] as const));
    if (level === "year") {
      let best: { id: string; d: number } | null = null;
      for (const n of miniNodes) {
        const c = project(n.group, new THREE.Vector3(0, 0.2, 0));
        const d = Math.hypot(c.x - x, c.y - y);
        if (d <= PICK_YEAR && (!best || d < best.d)) best = { id: n.mini.chapterId, d };
      }
      return best ? [best.id] : [];
    }
    if (level === "week") {
      let best: { ids: string[]; d: number } | null = null;
      for (const n of tileNodes) {
        if (!n.group.visible) continue;
        const a = project(n.group, new THREE.Vector3(0, n.topY - 0.05, 0)), b = project(n.group, new THREE.Vector3(0, n.top, 0));
        const d = Math.min(Math.hypot(a.x - x, a.y - y), Math.hypot(b.x - x, b.y - y));
        if (d <= PICK_WEEK && (!best || d < best.d)) best = { ids: n.ids, d };
      }
      return best ? [...best.ids] : [];
    }
    const hits: { n: SlotNode; d: number }[] = [];
    for (const n of slotNodes) {
      const a = project(n.group, new THREE.Vector3(0, n.top, 0)), b = project(n.group, new THREE.Vector3(0, 0, 0));
      const d = Math.min(Math.hypot(a.x - x, a.y - y), Math.hypot(b.x - x, b.y - y));
      if (d < PICK_MONTH) hits.push({ n, d });
    }
    hits.sort((p, q) => p.d - q.d);
    if (hits.length > 1 && Math.abs(hits[0]!.d - hits[1]!.d) < CROWD_PX) {
      return [...hits.filter((h) => h.d - hits[0]!.d < CROWD_PX).sort((p, q) => p.n.slot.slot - q.n.slot.slot).flatMap((h) => h.n.slot.stopIds)];
    }
    if (hits[0]) return [...hits[0].n.slot.stopIds];
    if (bus && near(anchor.get(JOURNEY_MAP_MARKS.piece), PICK_MONTH)) {
      const today = clock.slots.find((s) => s.slot === clock.todaySlot);
      return today && today.stopIds.length ? [...today.stopIds] : [board.today];
    }
    if (herc && near(anchor.get(JOURNEY_MAP_MARKS.hercules), PICK_HERC)) return [JOURNEY_MAP_MARKS.hercules];
    // An empty day on the road: its date.
    let best: { date: string; d: number } | null = null;
    for (const s of clock.slots) {
      if (!s.date || s.stopIds.length) continue;
      const a = anchor.get(s.date);
      if (!a || !a.visible) continue;
      const d = Math.hypot(a.x - x, a.y - y);
      if (d < 22 && (!best || d < best.d)) best = { date: s.date, d };
    }
    return best ? [best.date] : [];
  }

  function groundAt(sx: number, sy: number): { x: number; y: number } | null {
    scene.updateMatrixWorld(true);
    const ndc = new THREE.Vector2((sx / width) * 2 - 1, -(sy / height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const inv = new THREE.Matrix4().copy(island.matrixWorld).invert();
    const o = ray.ray.origin.clone().applyMatrix4(inv), d = ray.ray.direction.clone().transformDirection(inv);
    if (Math.abs(d.y) < 1e-6) return null;
    let h: number = JOURNEY_DIORAMA.slab.top, hit: { x: number; z: number } | null = null;
    for (let i = 0; i < 4; i += 1) {
      const k = (h - o.y) / d.y;
      if (k <= 0) return null;
      hit = { x: o.x + d.x * k, z: o.z + d.z * k };
      const c = fromDiorama(frame, hit.x, hit.z);
      h = groundY(c.x, c.y);
    }
    if (!hit || Math.hypot(hit.x, hit.z) > JOURNEY_DIORAMA.bezel.inner) return null;
    const c = fromDiorama(frame, hit.x, hit.z);
    return land.isLand(c.x, c.y) ? c : null;
  }

  // --- start ---------------------------------------------------------------------------------------------------
  applyPose(1);
  applyPops(0);
  invalidate();

  const handle: MapSceneHandle = {
    setBoard(next) {
      if (disposed) return;
      board = next;
      if (!board.chapters.some((c) => c.id === chapterId)) chapterId = board.currentChapterId;
      buildWeek(); buildMonth(false); buildHercules(); buildYear();
      invalidate();
    },
    setLevel(v, animate) { if (!disposed) goLevel(v, animate, false); },
    setChapter(id, direction, animate) {
      if (disposed || id === chapterId && !turning) return;
      if (!board.chapters.some((c) => c.id === id)) return;
      focus.zoom = 1; focus.target = [0, 0, 0];
      const atYear = t < 0.5;
      if (atYear) {
        // A mini chosen at Year: the clock becomes that month at once and grows straight out of the mini (no spin).
        const mini = miniNodes.find((n) => n.mini.chapterId === id)?.mini;
        chapterId = id; turning = null; turnYaw = 0; turnLift = 0; spin = 0; spinShown = 0;
        buildMonth(false);
        dive = mini && !reduced() ? mini.at : null;
        showMini(dive ? id : null);
        invalidate();
        return;
      }
      if (!animate || reduced() || direction === 0 || t > 1.5) {
        turning = null; turnYaw = 0; turnLift = 0;
        chapterId = id; buildMonth(false); invalidate(); return;
      }
      turning = { start: now(), dir: direction, to: id, swapped: false, yaw0: spinShown };
      invalidate();
    },
    setSelection(id) {
      if (disposed || id === selection) return;
      selection = id;
      const lvl = levelForT(t);
      if (lvl === "month") {
        const n = id ? slotNodes.find((s) => s.slot.stopIds.includes(id) || s.slot.date === id) : undefined;
        if (n) {
          island.updateMatrixWorld(true);
          const wp = n.group.getWorldPosition(new THREE.Vector3());
          focus.target = [wp.x * 0.75, wp.y * 0.75, wp.z * 0.75];
          focus.zoom = MONTH_FOCUS_ZOOM;
          bounce(n, false);
        } else { focus.zoom = 1; focus.target = [0, 0, 0]; }
      } else if (lvl === "week") {
        const n = id ? tileNodes.find((s) => s.ids.includes(id) || s.tile?.date === id || (id === JOURNEY_MAP_MARKS.pile && !s.tile)) : undefined;
        if (n) bounce(n, true);
      }
      invalidate();
    },
    setTheme(next) {
      if (disposed || next === theme) return;
      theme = next;
      land.setTheme(theme);
      buildAll();
      invalidate();
    },
    resize(w, h) {
      if (disposed) return;
      const nw = Math.max(1, Math.round(w)), nh = Math.max(1, Math.round(h));
      if (nw === width && nh === height) return;
      const phoneBefore = isPhone(width);
      width = nw; height = nh;
      lease.renderer.setSize?.(width, height, false);
      if (phoneBefore !== isPhone(width)) buildWeek();
      invalidate();
    },
    setSafeArea(inset) {
      if (disposed) return;
      const c = (v: number, max: number) => clamp(Number.isFinite(v) ? v : 0, 0, max * 0.65);
      safe = { top: c(inset.top, height), right: c(inset.right, width), bottom: c(inset.bottom, height), left: c(inset.left, width) };
      invalidate();
    },
    groundAt,
    sleep() { sleeping = true; if (frameId) { lease.cancelFrame(frameId); frameId = 0; } },
    wake() { if (disposed) return; sleeping = false; lastFrame = 0; invalidate(); },
    stats: () => countBoardDraws(scene),
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frameId) lease.cancelFrame(frameId);
      frameId = 0;
      if (wheelTimer) clearTimeout(wheelTimer);
      for (const a of anims.values()) a.end();
      anims.clear();
      for (const off of unlisten) off();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
      land.setCalm?.(null);
      lights.dispose();
      island.remove(land.group);
      for (const root of [plinthRoot, bezelRoot, propsRoot, weekRoot, yearGroup]) for (const c of [...root.children]) { if (c !== roadMesh) disposeBaked(c); }
      if (herc) disposeBaked(herc.group);
      roadGeo.dispose(); fallbackMini?.dispose();
      for (const m of miniInstanced) m.dispose();
      mats.dispose(); trailMats.dispose(); plinthMat.dispose(); roadMat.dispose();
      for (const m of Object.values(miniMats)) m.dispose();
      scene.clear();
      lease.release();
    },
    anchors: () => lastAnchors,
    renderNow() {
      if (disposed) return;
      if (frameId) { lease.cancelFrame(frameId); frameId = 0; }
      frameCb();
    },
    view: () => ({ t, level: levelForT(t), chapterId, selection, turning: !!turning, spin }),
  };
  return handle;
}

/** Type-level check: the extended factory is a valid `CreateJourneyMapScene`. */
export const createJourneyMapSceneContract: CreateJourneyMapScene = createJourneyMapScene;
/** Re-exported for the flat twin and tests. */
export { smoothstep, walkSlice, popE };
