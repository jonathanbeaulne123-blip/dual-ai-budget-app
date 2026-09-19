import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { KittyPaintV1, KittyPieceV1 } from "../../core/types.ts";
import type { QueenStone } from "../../core/queenPresentation.ts";
import { createKittySculpture, type KittySculpture } from "../../kitty/sculpture.ts";
import { createQueenSculpture, QUEEN_HEIGHT, type QueenSculpture } from "./queenSculpture.ts";
import { createQueenScenery, type QueenScenery, type QueenSceneryKind } from "./queenScenery.ts";
import type { QueenGlazeAxis, QueenPose } from "./queenAuthoring.ts";
import type { QueenCharmPart, QueenCharmV1 } from "../../core/queenCharms.ts";
import { queenLampShare, type QueenLight } from "../../core/queenLight.ts";
import type { QueenForm } from "./queenCharmSurface.ts";
import { HOME_BANK_MODELS, loadHomeBankModel, loadQueenModel, queenModelResources, type HomeBankModelId } from "./queenModel.ts";
import { createHomeBankModel } from "./homeBankModel.ts";
import { acquireWorldRenderer } from "../../house/world/rendererOwner.ts";

/**
 * The Home world: one renderer, one scene, one still camera. A diorama you
 * look into. Everything is placed on the z = 0 plane where the DOM says it
 * is, so the real controls (buttons over the canvas) and the sculptures never
 * drift apart. Frames are rendered on demand — after a state change, a layout
 * change or a breath frame — never on an unconditional loop.
 */
export type WorldRect = { x: number; y: number; w: number; h: number };
export type WorldBankInput = { id: string; piece: KittyPieceV1; fired: boolean; step: number };
export type WorldQueenInput = {
  pose: QueenPose;
  fill: number;
  axis: QueenGlazeAxis;
  crown: boolean;
  seams: number;
  vine: { chapter: boolean; growth: number; buds: number };
  feet: QueenStone["size"][];
  paint: KittyPaintV1 | null;
  /** Already through the guard; drawn as given. */
  charms: QueenCharmV1[];
  /** The thrown handles and the ring count. */
  form: QueenForm;
  /** Tipped over to show her underside. */
  tipped: boolean;
  /** The makers' marks on her underside. Null draws bare clay. */
  marks: { initials: readonly string[]; date: string } | null;
  /** Where the sun is over the household's day. Scales the lamps within a floor; never the material axis. */
  light: QueenLight;
};
export type WorldLayout = { host: WorldRect; queen: WorldRect; banks: Record<string, WorldRect> };
export type WorldStats = { frames: number; lastFrameMs: number; maxFrameMs: number; sculptures: number; breathing: boolean; scenery: QueenSceneryKind | "none"; ambient: boolean; sceneryGeometries: number; charms: number; charmDrawCalls: number; charmGeometries: number; keyLight: number; keyHeight: number; keyColor: string; rings: number; tipped: boolean; model: "model" | "awaiting" | "drawn"; bankModels?: Record<string, "studio" | "model"> };
export type WorldPick = (clientX: number, clientY: number) => { part: QueenCharmPart; u: number; v: number } | null;

const VISIBLE_HEIGHT = 10;
const FOV = 34;
const BREATH_MS = 6000;
const BREATH_PX = 14;

export function createQueenWorld(host: HTMLElement, options: { reducedMotion: boolean; onLost?: () => void; brass?: string; wood?: string; /** Jonathan's Mandevilla Queen (D-266). Tests pass `null` to keep the drawn figure; a failed load keeps it too. */ loadModel?: ((signal: AbortSignal) => Promise<THREE.Object3D>) | null; onModel?: (state: "model" | "drawn") => void; /** Jonathan's Protect and Build models (D-267). Tests pass `null` to keep the studio cats; a failed load keeps them too. */ loadBankModel?: ((id: HomeBankModelId, signal: AbortSignal) => Promise<THREE.Object3D>) | null }) {
  let suspendRenderer = () => {}, resumeRenderer = () => {};
  const rendererLease = acquireWorldRenderer(host, {
    parameters: { alpha: true, antialias: true, powerPreference: "low-power", preserveDrawingBuffer: true },
    configure(renderer) {
      renderer.setPixelRatio(Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, 1.5));
      renderer.shadowMap.enabled = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.96;
      renderer.localClippingEnabled = false;
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.className = "queen-world__canvas";
    },
    onSuspend: () => suspendRenderer(),
    onResume: () => resumeRenderer(),
  });
  const renderer = rendererLease.renderer;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 80);
  const distance = (VISIBLE_HEIGHT / 2) / Math.tan((FOV / 2) * (Math.PI / 180));
  camera.position.set(0, 0, distance);
  camera.lookAt(0, 0, 0);

  const cleanup: Array<() => void> = [];
  const pmrem = new THREE.PMREMGenerator(renderer);
  try {
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    cleanup.push(() => { env.dispose(); pmrem.dispose(); });
  } catch { pmrem.dispose(); }
  // The rig: a sky, a key and a rim. The living light scales them within a floor and moves the key with the sun's height; it never touches a material.
  const sky = new THREE.HemisphereLight("#fff1d9", "#8a8276", 1.1);
  scene.add(sky);
  const key = new THREE.DirectionalLight("#ffe9ca", 1.9);
  key.position.set(-4, 7, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#d9ecfa", 0.9);
  rim.position.set(4, 4, -4);
  scene.add(rim);
  const WARM = new THREE.Color("#ffe2b8"), COOL = new THREE.Color("#c9d6ea"), SKY_WARM = new THREE.Color("#fff1d9"), SKY_COOL = new THREE.Color("#dfe6f2");
  let lightKey = "";
  const setLight = (light: QueenLight) => {
    const next = `${light.level}:${light.warmth}`;
    if (next === lightKey) return;
    lightKey = next;
    const share = queenLampShare(light);
    key.intensity = 1.9 * share;
    sky.intensity = 1.1 * share;
    rim.intensity = 0.9 * (0.8 + 0.2 * (1 - light.level));
    key.color.copy(COOL).lerp(WARM, light.warmth);
    sky.color.copy(SKY_COOL).lerp(SKY_WARM, light.warmth);
    // The key climbs with the sun: low across the room at dusk, high at noon.
    key.position.set(-4, 3 + 5 * light.level, 6);
  };

  const queen: QueenSculpture = createQueenSculpture({ reducedMotion: options.reducedMotion });
  scene.add(queen.group);
  // Her model: nothing of her is drawn while it is on its way, so the old figure never flashes up first. If it cannot arrive, she is drawn as before.
  const modelLoad = new AbortController();
  const loadModel = options.loadModel === undefined ? loadQueenModel : options.loadModel;
  if (loadModel) {
    queen.setAwaitingModel(true);
    loadModel(modelLoad.signal)
      .then((model) => { if (dead) return; queen.setModel(model); lastLayoutKey = ""; invalidate(); options.onModel?.("model"); })
      .catch(() => { if (dead) return; queen.setAwaitingModel(false); invalidate(); options.onModel?.("drawn"); });
    cleanup.push(() => modelLoad.abort());
  }
  /** The place she is in. One at a time, rebuilt only when the scene changes, disposed with the world. */
  let scenery: QueenScenery | null = null;
  let sceneryFloor = 0, sceneryScale = 1;
  let sceneryPaper: string | undefined;
  const placeScenery = () => {
    if (!scenery) return;
    scenery.group.position.set(0, sceneryFloor, 0);
    scenery.group.scale.setScalar(sceneryScale);
  };
  type BankSculpture = Pick<KittySculpture, "group" | "setFill" | "dispose">;
  const banks = new Map<string, { sculpture: BankSculpture; height: number; fired: boolean; pieceId: string; paintKey: string; kind: "studio" | "model" }>();
  // Protect and Build stand as Jonathan's models. Each loads once; until it arrives that bank is not drawn (no studio cat flashes up), and if it cannot arrive the studio cat stands as before.
  const bankModels = new Map<HomeBankModelId, { state: "loading" | "ready" | "failed"; template: THREE.Object3D | null }>();
  let lastBankInputs: WorldBankInput[] = [];
  const loadBankModel = options.loadBankModel === undefined ? loadHomeBankModel : options.loadBankModel;
  const bankModelId = (id: string): HomeBankModelId | null => (id in HOME_BANK_MODELS ? id as HomeBankModelId : null);
  const bankModelFor = (id: HomeBankModelId) => {
    let entry = bankModels.get(id);
    if (entry) return entry;
    entry = { state: loadBankModel ? "loading" : "failed", template: null };
    bankModels.set(id, entry);
    if (loadBankModel) {
      const current = entry;
      loadBankModel(id, modelLoad.signal)
        .then((template) => { if (dead) return; current.state = "ready"; current.template = template; api.setBanks(lastBankInputs); })
        .catch(() => { if (dead) return; current.state = "failed"; api.setBanks(lastBankInputs); });
    }
    return entry;
  };
  cleanup.push(() => {
    for (const entry of bankModels.values()) {
      if (!entry.template) continue;
      const { geometries, materials, textures } = queenModelResources(entry.template);
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
    }
    bankModels.clear();
  });

  let dead = false;
  let pending = 0;
  let unitsPerPx = VISIBLE_HEIGHT / Math.max(1, host.clientHeight);
  let lastLayoutKey = "";
  const stats: WorldStats = { frames: 0, lastFrameMs: 0, maxFrameMs: 0, sculptures: 1, breathing: false, scenery: "none", ambient: false, sceneryGeometries: 0, charms: 0, charmDrawCalls: 0, charmGeometries: 0, keyLight: 1.9, keyHeight: 7, keyColor: "#ffe9ca", rings: 0, tipped: false, model: "drawn" };
  const raycaster = new THREE.Raycaster();
  let marksKey = "null";
  let hostRect: WorldRect = { x: 0, y: 0, w: host.clientWidth, h: host.clientHeight };
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  const render = () => {
    if (dead) return;
    const t0 = now();
    renderer.render(scene, camera);
    const ms = now() - t0;
    stats.frames += 1;
    stats.lastFrameMs = ms;
    stats.maxFrameMs = Math.max(stats.maxFrameMs, ms);
  };
  /** One frame, coalesced. */
  const invalidate = () => {
    if (dead || pending) return;
    pending = requestAnimationFrame(() => { pending = 0; render(); });
  };

  // ---- the ambient clock: her breath and the world she is in, on one loop ----
  // A page with neither running asks for no frames at all, which is the whole
  // reason render-on-demand exists. Reduced motion and a hidden tab stop both.
  let breathRaf = 0;
  let breathStart = 0;
  const running = () => stats.breathing || (stats.ambient && Boolean(scenery?.animated));
  const breathFrame = (t: number) => {
    breathRaf = 0;
    if (dead || !running()) return;
    if (!breathStart) breathStart = t;
    const elapsed = t - breathStart;
    if (stats.breathing) queen.setBreath(Math.sin((elapsed / BREATH_MS) * Math.PI * 2) * BREATH_PX * unitsPerPx);
    if (stats.ambient && scenery) scenery.tick(elapsed / 1000);
    render();
    breathRaf = requestAnimationFrame(breathFrame);
  };
  const pump = () => { if (!dead && running() && !breathRaf) { breathStart = 0; breathRaf = requestAnimationFrame(breathFrame); } };
  const halt = () => { if (breathRaf) cancelAnimationFrame(breathRaf); breathRaf = 0; };
  suspendRenderer = () => { if (pending) cancelAnimationFrame(pending); pending = 0; halt(); };
  resumeRenderer = () => { if (hostRect.w && hostRect.h) { renderer.setSize(hostRect.w, hostRect.h, false); renderer.domElement.style.width = `${hostRect.w}px`; renderer.domElement.style.height = `${hostRect.h}px`; } invalidate(); pump(); };
  const setBreathing = (on: boolean) => {
    const next = on && !options.reducedMotion;
    if (next === stats.breathing) return;
    stats.breathing = next;
    if (next) pump();
    else { if (!running()) halt(); queen.setBreath(0); invalidate(); }
  };
  const onHidden = () => { if (document.hidden) halt(); else pump(); };
  document.addEventListener("visibilitychange", onHidden);
  cleanup.push(() => document.removeEventListener("visibilitychange", onHidden));

  const lost = (event: Event) => { event.preventDefault(); options.onLost?.(); };
  cleanup.push(rendererLease.listenCanvas("webglcontextlost", lost));

  /** Screen px (relative to the viewport) → the z = 0 plane. */
  const toWorld = (hostRect: WorldRect, px: number, py: number): [number, number] => [
    (px - (hostRect.x + hostRect.w / 2)) * unitsPerPx,
    ((hostRect.y + hostRect.h / 2) - py) * unitsPerPx,
  ];

  const api = {
    scene,
    camera,
    renderer,
    queen,
    stats: () => { const c = queen.charmCounts(); return { ...stats, sculptures: 1 + banks.size, charms: c.instances, charmDrawCalls: c.drawCalls, charmGeometries: c.geometries, keyLight: +key.intensity.toFixed(3), keyHeight: +key.position.y.toFixed(2), keyColor: `#${key.color.getHexString()}`, rings: queen.form.rings, tipped: queen.tipped, model: queen.modelState, bankModels: Object.fromEntries([...banks].map(([id, bank]) => [id, bank.kind])) }; },
    /** A viewport point → where it lands on her paintable surface. Null off her. */
    pick(clientX: number, clientY: number) {
      if (dead || !hostRect.w || !hostRect.h) return null;
      raycaster.setFromCamera(new THREE.Vector2(((clientX - hostRect.x) / hostRect.w) * 2 - 1, -((clientY - hostRect.y) / hostRect.h) * 2 + 1), camera);
      scene.updateMatrixWorld(true);
      return queen.pick(raycaster);
    },
    /**
     * The place she is in. `null` is the bare field the first version had, and
     * remains the honest fallback for any scene with no world of its own.
     */
    setScenery(kind: QueenSceneryKind | null, paper?: string) {
      if (dead || ((scenery?.kind ?? null) === kind && sceneryPaper === paper)) return;
      sceneryPaper = paper;
      scenery?.group.removeFromParent();
      scenery?.dispose();
      scenery = null;
      stats.scenery = kind ?? "none";
      stats.sceneryGeometries = 0;
      if (kind) {
        try {
          scenery = createQueenScenery(kind, { reducedMotion: options.reducedMotion, paper });
          scene.add(scenery.group);
          stats.sceneryGeometries = scenery.counts().geometries;
          placeScenery();
        } catch { scenery = null; stats.scenery = "none"; }
      }
      if (!running()) halt(); else pump();
      invalidate();
    },
    /** Whether the world moves on its own. Off under reduced motion, a paused atmosphere, or a hidden tab. */
    setAmbient(on: boolean) {
      const next = on && !options.reducedMotion;
      if (next === stats.ambient) return;
      stats.ambient = next;
      if (next) pump();
      else { if (!running()) halt(); scenery?.tick(0); invalidate(); }
    },
    invalidate,
    render,
    setBreathing,
    setQueen(input: WorldQueenInput) {
      queen.setPose(input.pose);
      queen.setFill(input.fill);
      queen.setGlaze(input.axis);
      queen.setCrown(input.crown);
      queen.setSeams(input.seams);
      queen.setVine(input.vine.chapter, input.vine.growth, input.vine.buds);
      queen.setFeet(input.feet);
      queen.setPaint(input.paint);
      queen.setForm(input.form);
      queen.setCharms(input.charms);
      queen.setTipped(input.tipped);
      if (JSON.stringify(input.marks) !== marksKey) { marksKey = JSON.stringify(input.marks); queen.setMarks(input.marks); }
      setLight(input.light);
      invalidate();
    },
    /** Banks are studio sculptures. Rebuilt only when the piece or its firing changes; disposed when they leave. */
    setBanks(inputs: WorldBankInput[]) {
      if (dead) return;
      lastBankInputs = inputs;
      const seen = new Set<string>();
      for (const input of inputs) {
        const modelId = bankModelId(input.id);
        const model = modelId ? bankModelFor(modelId) : null;
        // Still on its way: draw nothing for this bank yet.
        if (model?.state === "loading") continue;
        seen.add(input.id);
        const existing = banks.get(input.id);
        if (model?.state === "ready" && model.template) {
          // The model does not wear the studio piece, so only its fill can change it.
          if (existing?.kind === "model") { existing.sculpture.setFill(input.step, false); continue; }
          if (existing) { existing.sculpture.group.removeFromParent(); existing.sculpture.dispose(); banks.delete(input.id); }
          const bank = createHomeBankModel(model.template, HOME_BANK_MODELS[modelId!].name);
          bank.setFill(input.step);
          bank.group.visible = false;
          scene.add(bank.group);
          const box = new THREE.Box3().setFromObject(bank.group);
          banks.set(input.id, { sculpture: bank, height: Math.max(0.5, box.max.y - box.min.y), fired: input.fired, pieceId: input.piece.id, paintKey: "", kind: "model" });
          continue;
        }
        const paintKey = JSON.stringify(input.piece.paint);
        if (existing && existing.kind === "studio" && existing.pieceId === input.piece.id && existing.fired === input.fired && existing.paintKey === paintKey) {
          existing.sculpture.setFill(input.step, false);
          continue;
        }
        if (existing) { existing.sculpture.group.removeFromParent(); existing.sculpture.dispose(); banks.delete(input.id); }
        const sculpture = createKittySculpture(input.piece, { brass: options.brass ?? "#bda375", wood: options.wood ?? "#62412b", fired: input.fired, reducedMotion: true });
        sculpture.setOpen(false);
        sculpture.setSpin(0);
        sculpture.setIdle(false);
        sculpture.setFill(input.step, false);
        sculpture.group.visible = false;
        scene.add(sculpture.group);
        const box = new THREE.Box3().setFromObject(sculpture.group);
        banks.set(input.id, { sculpture, height: Math.max(0.5, box.max.y - box.min.y), fired: input.fired, pieceId: input.piece.id, paintKey, kind: "studio" });
      }
      for (const [id, bank] of banks) if (!seen.has(id)) { bank.sculpture.group.removeFromParent(); bank.sculpture.dispose(); banks.delete(id); }
      lastLayoutKey = "";
      invalidate();
    },
    /** Put her and the banks exactly where the DOM keeps their controls. */
    layout(next: WorldLayout) {
      if (!next.host.w || !next.host.h) return;
      hostRect = next.host;
      // Measured often (through CSS transitions); rendered only when something actually moved.
      const key = JSON.stringify([hostRect, next.queen, next.banks, [...banks.keys()]]);
      if (key === lastLayoutKey) return;
      lastLayoutKey = key;
      unitsPerPx = VISIBLE_HEIGHT / hostRect.h;
      camera.aspect = hostRect.w / hostRect.h;
      camera.updateProjectionMatrix();
      renderer.setSize(hostRect.w, hostRect.h, false);
      if (rendererLease.active) {
        renderer.domElement.style.width = `${hostRect.w}px`;
        renderer.domElement.style.height = `${hostRect.h}px`;
      }
      const [qx, qy] = toWorld(hostRect, next.queen.x + next.queen.w / 2, next.queen.y + next.queen.h);
      const queenScale = (next.queen.h * unitsPerPx) / QUEEN_HEIGHT;
      queen.group.position.set(qx, qy, 0);
      queen.group.scale.setScalar(queenScale);
      // The world's floor is her floor, and it grows with her: a mug beside a
      // ceramic cat has to stay a mug at every width.
      sceneryFloor = qy;
      sceneryScale = queenScale;
      placeScenery();
      for (const [id, bank] of banks) {
        const rect = next.banks[id];
        bank.sculpture.group.visible = Boolean(rect);
        if (!rect) continue;
        const [bx, by] = toWorld(hostRect, rect.x + rect.w / 2, rect.y + rect.h);
        bank.sculpture.group.position.set(bx, by, 0);
        bank.sculpture.group.scale.setScalar((rect.h * unitsPerPx) / bank.height);
      }
      invalidate();
    },
    dispose() {
      if (dead) return;
      dead = true;
      if (pending) cancelAnimationFrame(pending);
      halt();
      for (const bank of banks.values()) { bank.sculpture.group.removeFromParent(); bank.sculpture.dispose(); }
      banks.clear();
      scenery?.dispose();
      scenery = null;
      queen.dispose();
      for (const release of cleanup.splice(0).reverse()) { try { release(); } catch { /* keep releasing */ } }
      scene.clear();
      rendererLease.release();
    },
  };
  return api;
}
export type QueenWorld = ReturnType<typeof createQueenWorld>;
