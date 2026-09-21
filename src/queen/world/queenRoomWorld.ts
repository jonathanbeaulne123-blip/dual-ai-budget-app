import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { bankGeometry, buildBankVessel, type BankForm, type BankGeometry, type BankMaterials } from "./queenBankSculpture.ts";
import { bisqueHex } from "../../kitty/studio/paintCanvas.ts";
import { createKittySculpture, type KittySculpture } from "../../kitty/sculpture.ts";
import type { KittyPieceV1 } from "../../core/types.ts";
import { bankModelFor, loadBankModel, type BankModelKey } from "./bankModels.ts";
import { queenModelResources } from "./queenModel.ts";
import { acquireWorldRenderer } from "../../house/world/rendererOwner.ts";

/**
 * The two rooms, in three dimensions: **the cellar**, where Protect runs a
 * ribbon of near-identical jars past a lit gate, and **the loft**, where Build
 * keeps its banks on a ledge under the roof.
 *
 * It is the Home world's pattern, not a new one. One renderer, one scene, one
 * still camera. The vessels are placed where the DOM keeps their controls, so
 * the buttons the keyboard and the screen reader use are the same ones the eye
 * lands on and nothing here has to be reachable twice. Ambient motion is one
 * clock that the caller starts and stops; reduced motion never starts it. The
 * room carries no money: a jar's swell and fill and a bank's glaze height
 * arrive as bands already quantised by `queenPresentation`, so no figure can be
 * read off a shape.
 *
 * Two grammars the references settle, and they are opposite on purpose:
 * **a lidded thing refuses** — a bill leans away, because there was never a
 * decision inside it — and **an open-mouthed thing accepts**. The lean is a
 * pose, so the rule still reads with motion off.
 */
export type QueenRoom = "cellar" | "loft";

/** One vessel on a rail or a ledge, in the form the room draws it. No amounts. */
export type RoomVessel = {
  id: string;
  /** `jar` is a month on the cellar's rail; `goal` opens; `bill` is lidded. */
  kind: "jar" | "goal" | "bill";
  /** 0.85–1.45 on a jar: how much the month took against its usual. 1 elsewhere. */
  swell?: number;
  /** 0–1: how high the glaze stands. */
  fill?: number;
  /** The month that stepped out of the rail, with its ghost left behind. */
  outlier?: boolean;
  /** Nothing was posted: the jar is drawn as an outline, claiming nothing. */
  hollow?: boolean;
  /** A planned expense: not posted, but not nothing either — frosted glass in its group's tint, the shape of what might be. */
  frosted?: boolean;
  /** Picked up. It lifts off the shelf; its shadow spreads. */
  lifted?: boolean;
  /** Leaning away, because something was offered to a lidded thing. */
  refusing?: boolean;
  /** Necks on the shoulder: how many parts are inside. */
  parts?: number;
  /** Three widths on the loft's ledge. */
  size?: "small" | "middling" | "large";
  /** The cellar's purposes: a body per purpose. Absent, the kind's own form stands. */
  form?: BankForm;
  /** The clay's tint (a hex colour from the category group) and its finish. Absent, the bare clay. */
  tint?: string;
  finish?: "plain" | "speckle" | "banded" | "crackle";
  /**
   * The loft (2026-09-15, Jonathan: "the kitty banks in the loft need to be the
   * 3d models created in the studio"): the bank's own studio piece, stood as
   * the studio's sculpture — its paint, its add-ons, its firing — growing by
   * the studio's own ten steps as it fills. Absent, the room's drawn bank.
   */
  studio?: { piece: KittyPieceV1; fired: boolean; step: number };
  /**
   * The Queen's household (2026-09-16): stand one of Jonathan's models here —
   * a bill as its umbrella's bank, a pay jar as Clink or Poise. The model is
   * never re-shaped: it is bisque above `fill` and its own glazed self below,
   * and `glass` shows the whole of it frosted ("if all of it came in"). While
   * it loads the seat stands nothing; if it can't load, the drawn vessel stands.
   */
  model?: { key: BankModelKey; glass?: boolean };
};
export type RoomRect = { x: number; y: number; w: number; h: number };
export type RoomLayout = { host: RoomRect; seats: Record<string, RoomRect>; /** The cellar (2026-09-15): the rail and where its floor sits, so the room's furniture no longer follows the jars' sizes. */ stage?: RoomRect & { floor: number }; /** The loft's shelves (2026-09-15): one board per DOM shelf, top first. */ shelves?: RoomRect[] };
export type RoomStats = { frames: number; lastFrameMs: number; maxFrameMs: number; vessels: number; ambient: boolean; geometries: number; /** Seats standing one of Jonathan's models. */ models?: number };

const VISIBLE_HEIGHT = 10;
const FOV = 34;
/** A vessel is authored one unit tall; the seat's height in world units is its scale. */
const VESSEL_HEIGHT = 1;

export type RoomModelLoader = (key: BankModelKey, signal?: AbortSignal) => Promise<THREE.Object3D>;

export function createQueenRoomWorld(host: HTMLElement, options: { room: QueenRoom; reducedMotion?: boolean; onLost?: () => void; /** `null` never loads a model (tests, and the flat fallback). */ loadModel?: RoomModelLoader | null }) {
  let suspendRenderer = () => {}, resumeRenderer = () => {};
  const rendererLease = acquireWorldRenderer(host, {
    parameters: { alpha: true, antialias: true, powerPreference: "low-power", preserveDrawingBuffer: true },
    configure(renderer) {
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = options.room === "cellar" ? 0.7 : 0.88;
      // A model bank is glazed below its fill line and bisque above it: one clipping plane each.
      renderer.localClippingEnabled = true;
      renderer.shadowMap.enabled = false;
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.className = "queen-room-world__canvas";
      renderer.domElement.style.touchAction = "";
    },
    onSuspend: () => suspendRenderer(),
    onResume: () => resumeRenderer(),
  });
  const renderer = rendererLease.renderer;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 90);
  const distance = (VISIBLE_HEIGHT / 2) / Math.tan((FOV / 2) * (Math.PI / 180));
  camera.position.set(0, 0, distance);
  camera.lookAt(0, 0, 0);

  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const cleanup: Array<() => void> = [];
  const geo = <G extends THREE.BufferGeometry>(g: G): G => { geometries.add(g); return g; };
  const mat = <M extends THREE.Material>(m: M): M => { materials.add(m); return m; };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, name: string) => {
    const object = new THREE.Mesh(geo(g), m);
    object.name = name;
    parent.add(object);
    return object;
  };

  const pmrem = new THREE.PMREMGenerator(renderer);
  {
    const environment = new RoomEnvironment();
    try {
      const env = pmrem.fromScene(environment, 0.05);
      scene.environment = env.texture;
      cleanup.push(() => { env.dispose(); pmrem.dispose(); });
    } catch { pmrem.dispose(); }
    finally {
      // See queenWorld.ts: dispose the environment scene and its instanced
      // furniture rather than leaking both once per mount.
      environment.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
      environment.dispose();
    }
  }

  // ---- the light each room is lit by ------------------------------------
  const cellar = options.room === "cellar";
  const sky = new THREE.HemisphereLight(cellar ? "#b6a88e" : "#fff3dc", cellar ? "#211f1b" : "#6d6658", cellar ? 0.3 : 0.75);
  scene.add(sky);
  // The cellar has one bulb over the gate; the loft has a window low and to one side.
  const key = new THREE.DirectionalLight(cellar ? "#ffd48f" : "#fff0cf", cellar ? 1.15 : 1.7);
  key.position.set(cellar ? 0 : -5, cellar ? 9 : 6, cellar ? 3 : 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(cellar ? "#93a6b8" : "#d9ecfa", cellar ? 0.5 : 0.8);
  rim.position.set(4, 3, -5);
  scene.add(rim);
  const bulb = new THREE.PointLight(cellar ? "#ffd48a" : "#ffe6b8", cellar ? 2.1 : 0, cellar ? 16 : 1, 2);
  bulb.position.set(0, 3.3, 2);
  scene.add(bulb);

  // ---- the room itself ---------------------------------------------------
  const interior = new THREE.Group();
  interior.name = `queen-room-${options.room}`;
  scene.add(interior);
  const swaying: { object: THREE.Object3D; amount: number; speed: number; phase: number }[] = [];
  let motes: THREE.InstancedMesh | null = null;
  // The loft's rack (2026-09-15): a board per shelf the DOM hangs, standing where the shelf stands. The single ledge stays for one shelf.
  let ledgeParts: { ledge: THREE.Mesh; lip: THREE.Mesh; wood: THREE.Material; beam: THREE.Material } | null = null;
  const boards: THREE.Group[] = [];
  const moteSeeds: { x: number; y: number; z: number; speed: number; phase: number }[] = [];

  const box = geo(new THREE.BoxGeometry(1, 1, 1));
  const rng = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; }; };
  const random = rng(cellar ? 0xce11a2 : 0x10f7);

  if (cellar) {
    // Distance: the far wall, coursed stone, and the dark the rail runs into at both ends.
    const stone = mat(new THREE.MeshStandardMaterial({ color: "#564e42", roughness: 1 }));
    const stoneDark = mat(new THREE.MeshStandardMaterial({ color: "#39332c", roughness: 1 }));
    const back = mesh(new THREE.PlaneGeometry(60, 30), stone, interior, "queen-cellar-wall");
    back.position.set(0, 6, -14);
    for (let course = 0; course < 9; course += 1) {
      const line = mesh(new THREE.BoxGeometry(60, 0.06, 0.02), stoneDark, interior, "queen-cellar-course");
      line.position.set(0, -3 + course * 1.7, -13.94);
    }
    // A barrel vault overhead, so the room has a lid and the eye knows it is underground.
    const vault = mesh(new THREE.CylinderGeometry(9, 9, 60, 24, 1, true, Math.PI, Math.PI), stoneDark, interior, "queen-cellar-vault");
    vault.rotation.z = Math.PI / 2;
    vault.position.set(0, 3.2, -5);
    vault.material.side = THREE.BackSide;
    // Middle: the stone rail the ribbon stands on, running off both ends.
    const rail = mesh(box, mat(new THREE.MeshStandardMaterial({ color: "#6b6152", roughness: 0.95 })), interior, "queen-cellar-rail");
    rail.scale.set(90, 0.5, 3.2);
    // The slab ends behind the banks. A shelf that runs toward the lens is seen
    // from slightly above, and its top surface is then drawn over their feet.
    rail.position.set(0, -0.3, -2.1);
    const railEdge = mesh(box, stoneDark, interior, "queen-cellar-rail-edge");
    railEdge.scale.set(90, 0.16, 0.18);
    railEdge.position.set(0, -0.12, -0.46);
    // The floor, and crates at the near edge the camera looks past.
    const floor = mesh(new THREE.PlaneGeometry(90, 40), mat(new THREE.MeshStandardMaterial({ color: "#3f3a33", roughness: 1 })), interior, "queen-cellar-floor");
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -4.6, 0);
    const wood = mat(new THREE.MeshStandardMaterial({ color: "#6a5236", roughness: 0.9 }));
    for (const [x, z, s] of [[-5.2, 3.4, 1.5], [5.6, 3.8, 1.3], [-6.4, 2.2, 1]] as const) {
      const crate = mesh(box, wood, interior, "queen-cellar-crate");
      crate.scale.set(s, s * 0.8, s);
      crate.position.set(x, -4.6 + s * 0.4, z);
      crate.rotation.y = random() * 0.6 - 0.3;
    }
    // The gate: one bulb on a flex over the middle of the rail, and the pool it throws.
    const flex = mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.2, 6), stoneDark, interior, "queen-cellar-flex");
    flex.position.set(0, 4.7, 1.6);
    const lamp = new THREE.Group();
    lamp.name = "queen-cellar-lamp";
    lamp.position.set(0, 3.15, 1.6);
    interior.add(lamp);
    mesh(new THREE.ConeGeometry(0.62, 0.5, 16, 1, true), mat(new THREE.MeshStandardMaterial({ color: "#3f3a33", roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide })), lamp, "queen-cellar-shade");
    const glow = mesh(new THREE.SphereGeometry(0.2, 12, 9), mat(new THREE.MeshBasicMaterial({ color: "#ffe1a8", toneMapped: false })), lamp, "queen-cellar-bulb");
    glow.position.y = -0.24;
    swaying.push({ object: lamp, amount: 0.02, speed: 0.34, phase: 0 });
    // Dusty bottles on a back shelf: the detail that says people keep things down here.
    const shelf = mesh(box, wood, interior, "queen-cellar-shelf");
    shelf.scale.set(26, 0.2, 0.9);
    shelf.position.set(0, 2.4, -12.4);
    const bottleGeo = geo(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 8));
    const bottleMats = ["#3f5342", "#4a4038", "#55503f"].map((color) => mat(new THREE.MeshStandardMaterial({ color, roughness: 0.7 })));
    for (let i = 0; i < 22; i += 1) {
      const bottle = mesh(bottleGeo, bottleMats[i % bottleMats.length]!, interior, "queen-cellar-bottle");
      bottle.position.set(-12 + i * 1.15 + random() * 0.2, 2.95, -12.4);
    }
  } else {
    // Distance: the gable end, the dormer, and the daylight coming through it.
    const plaster = mat(new THREE.MeshStandardMaterial({ color: "#e7dcc6", roughness: 0.95 }));
    const beam = mat(new THREE.MeshStandardMaterial({ color: "#8a6a45", roughness: 0.85 }));
    const back = mesh(new THREE.PlaneGeometry(60, 30), plaster, interior, "queen-loft-wall");
    back.position.set(0, 6, -12);
    // The roof: two slopes meeting a ridge, which is what makes it a loft and not a room.
    for (const side of [-1, 1] as const) {
      const slope = mesh(new THREE.PlaneGeometry(60, 16), mat(new THREE.MeshStandardMaterial({ color: "#c3b394", roughness: 1, side: THREE.DoubleSide })), interior, "queen-loft-slope");
      slope.rotation.set(0, 0, side * -0.95);
      slope.position.set(side * 9.4, 8.4, -4);
    }
    const ridge = mesh(box, beam, interior, "queen-loft-ridge");
    ridge.scale.set(60, 0.42, 0.42);
    ridge.position.set(0, 11.4, -4);
    for (let i = 0; i < 7; i += 1) {
      const rafter = mesh(box, beam, interior, "queen-loft-rafter");
      rafter.scale.set(0.3, 0.3, 15);
      rafter.position.set(-18 + i * 6, 7.2, -4);
      rafter.rotation.x = 0;
    }
    // The dormer, and the light it lets in: the loft's one bright thing.
    const glassCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
    let glass: THREE.Texture | null = null;
    if (glassCanvas) {
      glassCanvas.width = 4; glassCanvas.height = 128;
      const ctx = glassCanvas.getContext("2d");
      if (ctx) {
        const fill = ctx.createLinearGradient(0, 0, 0, 128);
        fill.addColorStop(0, "#cfe3f2"); fill.addColorStop(0.6, "#eef2e4"); fill.addColorStop(1, "#cdd9bb");
        ctx.fillStyle = fill; ctx.fillRect(0, 0, 4, 128);
        glass = new THREE.CanvasTexture(glassCanvas);
        glass.colorSpace = THREE.SRGBColorSpace;
        textures.add(glass);
      }
    }
    const pane = mesh(new THREE.PlaneGeometry(11, 7.4), mat(glass ? new THREE.MeshBasicMaterial({ map: glass, toneMapped: false }) : new THREE.MeshBasicMaterial({ color: "#e8f0e2", toneMapped: false })), interior, "queen-loft-window");
    pane.position.set(0, 5.2, -11.8);
    for (const [x, y, w, h] of [[0, 9, 11.6, 0.4], [0, 1.4, 11.6, 0.4], [-5.6, 5.2, 0.4, 8], [5.6, 5.2, 0.4, 8], [0, 5.2, 0.18, 8], [0, 5.2, 11.6, 0.18]] as const) {
      const bar = mesh(box, beam, interior, "queen-loft-frame");
      bar.scale.set(w, h, 0.26);
      bar.position.set(x, y, -11.62);
    }
    const beamLight = mesh(new THREE.PlaneGeometry(8, 16), mat(new THREE.MeshBasicMaterial({ color: "#fff3d4", transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide })), interior, "queen-loft-beam");
    beamLight.position.set(-1.8, 2.4, -5.5);
    beamLight.rotation.set(-0.45, 0.2, 0.16);
    // Middle: the ledge the shelf stands on, and the wall it is fixed to.
    const ledge = mesh(box, mat(new THREE.MeshStandardMaterial({ color: "#a5835a", roughness: 0.7 })), interior, "queen-loft-ledge");
    ledge.scale.set(90, 0.42, 3.4);
    // As in the cellar: the ledge ends behind the banks, so nothing is drawn over their feet.
    ledge.position.set(0, -0.25, -2.2);
    const lip = mesh(box, beam, interior, "queen-loft-lip");
    lip.scale.set(90, 0.14, 0.22);
    lip.position.set(0, -0.11, -0.48);
    ledgeParts = { ledge, lip, wood: ledge.material as THREE.Material, beam };
    // The floorboards below, and a crate at the near edge.
    const boards = mesh(new THREE.PlaneGeometry(90, 40), mat(new THREE.MeshStandardMaterial({ color: "#9b7c57", roughness: 0.95 })), interior, "queen-loft-floor");
    boards.rotation.x = -Math.PI / 2;
    boards.position.set(0, -4.8, 0);
    for (let i = 0; i < 14; i += 1) {
      const seam = mesh(box, mat(new THREE.MeshStandardMaterial({ color: "#7f6244", roughness: 1 })), interior, "queen-loft-board");
      seam.scale.set(90, 0.02, 0.06);
      seam.position.set(0, -4.78, -16 + i * 2.6);
    }
  }

  // Motes in the one beam of light each room has. The rooms' only ambient motion.
  {
    const moteMat = mat(new THREE.MeshBasicMaterial({ color: cellar ? "#ffe6bb" : "#fff5da", transparent: true, opacity: cellar ? 0.5 : 0.6, depthWrite: false }));
    motes = new THREE.InstancedMesh(geo(new THREE.SphereGeometry(0.035, 5, 4)), moteMat, 26);
    motes.name = "queen-room-motes";
    motes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const seat = new THREE.Object3D();
    for (let i = 0; i < 26; i += 1) {
      const row = { x: (cellar ? -3.5 : -7) + random() * 7, y: -1 + random() * 5.5, z: -4 + random() * 6, speed: 0.12 + random() * 0.2, phase: random() * 6.28 };
      moteSeeds.push(row);
      seat.position.set(row.x, row.y, row.z);
      seat.updateMatrix();
      motes.setMatrixAt(i, seat.matrix);
    }
    interior.add(motes);
  }

  // ---- the vessels: the studio's kitty banks, not pots --------------------
  // The rooms stood generic ceramic pots here until 2026-09-14. They stand the
  // Kitty Bank Studio's own cat now — same thrown silhouette, same head, same
  // brass slot on the crown — so a bank looks like itself on a ledge, on a rail
  // and on the wheel. Geometry is shared per form: a dozen banks is a dozen
  // draws, not a dozen canvases.
  const clay = mat(new THREE.MeshPhysicalMaterial({ color: "#c0a67e", roughness: 0.6, clearcoat: 0.3, clearcoatRoughness: 0.25, metalness: 0.02 }));
  const glaze = mat(new THREE.MeshPhysicalMaterial({ color: "#7d6a52", roughness: 0.26, clearcoat: 0.75, metalness: 0.03 }));
  const deepClay = mat(new THREE.MeshStandardMaterial({ color: "#8a6a47", roughness: 0.8 }));
  const brassMat = mat(new THREE.MeshStandardMaterial({ color: "#c99a4b", roughness: 0.34, metalness: 0.7 }));
  const inkMat = mat(new THREE.MeshStandardMaterial({ color: "#2f2a26", roughness: 0.55 }));
  const ghostMat = mat(new THREE.MeshBasicMaterial({ color: "#8a8071", wireframe: true, transparent: true, opacity: 0.4 }));
  const shadowMat = mat(new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.2, depthWrite: false }));
  // The dressing's cloth and paper (queenBankDress): a postman's felt, a calendar's paper.
  const feltMat = mat(new THREE.MeshStandardMaterial({ color: "#4f6e9c", roughness: 0.85, side: THREE.DoubleSide }));
  const paperMat = mat(new THREE.MeshStandardMaterial({ color: "#efe6d2", roughness: 0.85 }));
  const bankMaterials: BankMaterials = { clay, glaze, deep: deepClay, brass: brassMat, ink: inkMat, ghost: ghostMat, felt: feltMat, paper: paperMat };
  // The cellar's tinted, finished clays: one small greyscale canvas per finish (a speckle, bands, a crackle),
  // multiplied by the group's tint, so six hues × four finishes cost four textures and a material per pair in use.
  const finishMaps = new Map<string, THREE.Texture | null>();
  const finishMap = (finish: NonNullable<RoomVessel["finish"]>): THREE.Texture | null => {
    if (finishMaps.has(finish)) return finishMaps.get(finish)!;
    let texture: THREE.Texture | null = null;
    if (finish !== "plain" && typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = "rgba(60,40,20,.42)";
        if (finish === "speckle") { let seed = 7; for (let i = 0; i < 90; i += 1) { seed = (seed * 9301 + 49297) % 233280; const x = (seed / 233280) * 64; seed = (seed * 9301 + 49297) % 233280; const y = (seed / 233280) * 64; ctx.beginPath(); ctx.arc(x, y, 1.1 + (i % 3) * 0.5, 0, Math.PI * 2); ctx.fill(); } }
        if (finish === "banded") { for (let y = 4; y < 64; y += 12) ctx.fillRect(0, y, 64, 3); }
        if (finish === "crackle") { ctx.strokeStyle = "rgba(60,40,20,.5)"; ctx.lineWidth = 1; for (let i = 0; i < 9; i += 1) { ctx.beginPath(); ctx.moveTo((i * 23) % 64, 0); ctx.lineTo(((i * 23) % 64) + 18 - (i % 2) * 30, 64); ctx.stroke(); } }
        texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(finish === "banded" ? 1 : 2, finish === "banded" ? 2 : 2);
        texture.colorSpace = THREE.SRGBColorSpace;
        textures.add(texture);
      }
    }
    finishMaps.set(finish, texture);
    return texture;
  };
  const frostedClays = new Map<string, THREE.Material>();
  const frostedFor = (tint?: string): THREE.Material => {
    const key = tint ?? "clay";
    const known = frostedClays.get(key);
    if (known) return known;
    const built = mat(new THREE.MeshPhysicalMaterial({ color: tint ?? "#c0a67e", roughness: 0.55, transmission: 0, transparent: true, opacity: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.35, depthWrite: false }));
    frostedClays.set(key, built);
    return built;
  };
  const tintedClays = new Map<string, THREE.Material>();
  const clayFor = (tint?: string, finish: NonNullable<RoomVessel["finish"]> = "plain"): THREE.Material => {
    if (!tint) return clay;
    const key = `${tint}:${finish}`;
    const known = tintedClays.get(key);
    if (known) return known;
    const map = finishMap(finish);
    const built = mat(new THREE.MeshPhysicalMaterial({ color: tint, roughness: finish === "crackle" ? 0.72 : 0.6, clearcoat: finish === "banded" ? 0.45 : 0.3, clearcoatRoughness: 0.25, metalness: 0.02, ...(map ? { map } : {}) }));
    tintedClays.set(key, built);
    return built;
  };
  // ---- the kiln (2026-09-15) ---------------------------------------------
  // Jonathan: "they start off bare and unfired. as money gets put in or they
  // get paid they slowly get more and more glazed from the ground up." The
  // studio's own two looks — chalky bisque, and the deep clearcoated glaze of
  // a fired piece — meet on the body at the fill line: one colour map and one
  // roughness/clearcoat map per fill band (eleven bands, the nest's own
  // quantisation), shared by every jar at that band. The head, ears, paws and
  // tail fire only once she is full: glazed to the crown.
  const BANDS = 10;
  const fillBand = (fill: number | undefined) => Math.round(Math.max(0, Math.min(1, fill ?? 0)) * BANDS);
  const kilnMaps = new Map<number, THREE.Texture | null>();
  /** R = clearcoat, G = roughness, by height: fired below the line, bisque above. */
  const kilnMapFor = (band: number): THREE.Texture | null => {
    if (kilnMaps.has(band)) return kilnMaps.get(band)!;
    let texture: THREE.Texture | null = null;
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = 4; canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const line = Math.round((1 - band / BANDS) * 128);
        ctx.fillStyle = "rgb(0,238,0)"; ctx.fillRect(0, 0, 4, line);
        ctx.fillStyle = "rgb(255,38,0)"; ctx.fillRect(0, line, 4, 128 - line);
        texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter;
        textures.add(texture);
      }
    }
    kilnMaps.set(band, texture);
    return texture;
  };
  const drawFinish = (ctx: CanvasRenderingContext2D, finish: NonNullable<RoomVessel["finish"]>, top: number) => {
    ctx.save(); ctx.translate(0, top);
    ctx.fillStyle = "rgba(60,40,20,.42)";
    if (finish === "speckle") { let seed = 7; for (let i = 0; i < 90; i += 1) { seed = (seed * 9301 + 49297) % 233280; const x = (seed / 233280) * 64; seed = (seed * 9301 + 49297) % 233280; const y = (seed / 233280) * 64; ctx.beginPath(); ctx.arc(x, y, 1.1 + (i % 3) * 0.4, 0, Math.PI * 2); ctx.fill(); } }
    if (finish === "banded") { for (let y = 4; y < 64; y += 12) ctx.fillRect(0, y, 64, 3); }
    if (finish === "crackle") { ctx.strokeStyle = "rgba(60,40,20,.5)"; ctx.lineWidth = 1; for (let i = 0; i < 9; i += 1) { ctx.beginPath(); ctx.moveTo((i * 23) % 64, 0); ctx.lineTo(((i * 23) % 64) + 18 - (i % 2) * 30, 34); ctx.lineTo(((i * 23) % 64) + 6, 64); ctx.stroke(); } }
    ctx.restore();
  };
  const glazeMaps = new Map<string, THREE.Texture | null>();
  /** The colour by height: the tint's glaze below the line, its chalky bisque above, the line's finish over both. */
  const glazeMapFor = (tint: string, finish: NonNullable<RoomVessel["finish"]>, band: number): THREE.Texture | null => {
    const key = `${tint}:${finish}:${band}`;
    if (glazeMaps.has(key)) return glazeMaps.get(key)!;
    let texture: THREE.Texture | null = null;
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = 64; canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const line = Math.round((1 - band / BANDS) * 128);
        ctx.fillStyle = bisqueHex(tint); ctx.fillRect(0, 0, 64, line);
        ctx.fillStyle = tint; ctx.fillRect(0, line, 64, 128 - line);
        if (finish !== "plain") { drawFinish(ctx, finish, 0); drawFinish(ctx, finish, 64); }
        texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping; texture.repeat.x = 2;
        texture.colorSpace = THREE.SRGBColorSpace;
        textures.add(texture);
      }
    }
    glazeMaps.set(key, texture);
    return texture;
  };
  const BARE_CLAY = "#c0a67e";
  const bodyMats = new Map<string, THREE.Material>();
  /** The body's material at this fill: white under its maps, so the maps carry the colour, the gloss and the line. */
  const bodyFor = (tint: string | undefined, finish: NonNullable<RoomVessel["finish"]> = "plain", fill: number | undefined): THREE.Material => {
    const band = fillBand(fill);
    const key = `${tint ?? BARE_CLAY}:${finish}:${band}`;
    const known = bodyMats.get(key);
    if (known) return known;
    const map = glazeMapFor(tint ?? BARE_CLAY, finish, band);
    const kiln = kilnMapFor(band);
    const built = map && kiln
      ? mat(new THREE.MeshPhysicalMaterial({ color: "#ffffff", map, roughness: 1, roughnessMap: kiln, clearcoat: 1, clearcoatMap: kiln, clearcoatRoughness: 0.12, metalness: 0.02 }))
      : clayFor(tint, finish);
    bodyMats.set(key, built);
    return built;
  };
  const skinMats = new Map<string, THREE.Material>();
  /** Her other clay: bisque until she is full, then fired with her. */
  const skinFor = (tint: string | undefined, fired: boolean): THREE.Material => {
    const key = `${tint ?? BARE_CLAY}:${fired ? "fired" : "bisque"}`;
    const known = skinMats.get(key);
    if (known) return known;
    const built = mat(fired
      ? new THREE.MeshPhysicalMaterial({ color: tint ?? BARE_CLAY, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.12, metalness: 0.02 })
      : new THREE.MeshPhysicalMaterial({ color: bisqueHex(tint ?? BARE_CLAY), roughness: 0.92, clearcoat: 0, metalness: 0 }));
    skinMats.set(key, built);
    return built;
  };

  const shapes = new Map<BankForm, BankGeometry>();
  /** One set of geometry per form, built the first time a room needs that form. */
  const shapeFor = (form: BankForm) => {
    const known = shapes.get(form);
    if (known) return known;
    const built = bankGeometry(form, geo);
    shapes.set(form, built);
    return built;
  };
  const shadowGeo = geo(new THREE.CircleGeometry(0.5, 20));

  type Seat = { group: THREE.Group; body: THREE.Mesh; glazeMesh: THREE.Mesh; skin: THREE.Mesh[]; shadow: THREE.Mesh; vessel: RoomVessel };
  const seats = new Map<string, Seat>();
  const vesselsGroup = new THREE.Group();
  vesselsGroup.name = "queen-room-vessels";
  scene.add(vesselsGroup);

  /** Build one bank in the form it is given. One unit tall at rest; the seat's height is its scale. */
  const buildVessel = (vessel: RoomVessel): Seat => {
    const form = vessel.form ?? vessel.kind;
    const frosted = Boolean(vessel.frosted);
    const built = buildBankVessel(shapeFor(form), { ...bankMaterials, clay: clayFor(vessel.tint, vessel.finish), ...(frosted ? { ghost: frostedFor(vessel.tint) } : {}) }, {
      form,
      hollow: vessel.hollow || frosted,
      // Open-mouthed things accept; lidded things refuse. A month on the rail is
      // a bill, so it is lidded too: there was never a decision inside it.
      lidded: vessel.kind !== "goal",
      parts: vessel.parts,
    });
    const group = built.group;
    group.name = `queen-room-vessel-${vessel.id}`;
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.name = "queen-room-vessel-shadow";
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    shadow.scale.setScalar(0.8);
    group.add(shadow);
    vesselsGroup.add(group);
    return { group, body: built.body, glazeMesh: built.glaze, skin: built.skin, shadow, vessel };
  };
  /** The pose that carries the reading: the swell, the lift, the lean a lidded thing answers with. */
  const poseVessel = (seat: Seat) => {
    const v = seat.vessel;
    const swell = v.swell ?? 1;
    seat.group.rotation.z = v.refusing ? 0.16 : v.outlier ? 0.1 : 0;
    seat.body.scale.set(swell, 1, swell * 0.86);
    // The kiln: a hollow or frosted thing keeps its ghost; anything else is glazed from the foot to its fill line, and fired to the crown when full.
    const inKiln = !v.hollow && !v.frosted;
    if (inKiln) {
      seat.body.material = bodyFor(v.tint, v.finish, v.fill);
      const fired = fillBand(v.fill) >= BANDS;
      const skinMat = skinFor(v.tint, fired);
      for (const piece of seat.skin) piece.material = skinMat;
    }
    seat.glazeMesh.visible = false;
    seat.shadow.scale.setScalar(v.lifted ? 1.05 : 0.8);
    (seat.shadow.material as THREE.Material & { opacity: number }).opacity = v.lifted ? 0.12 : 0.2;
  };

  // ---- the studio's own sculptures (the loft) -----------------------------
  type StudioSeat = { sculpture: KittySculpture; height: number; key: string; vessel: RoomVessel };
  const studios = new Map<string, StudioSeat>();
  let animRaf = 0;
  /** A sculpture that is growing asks for frames; the room runs them only while any is still moving. */
  const animate = () => {
    if (dead || animRaf) return;
    const step = (t: number) => {
      animRaf = 0;
      if (dead) return;
      let busy = false;
      for (const seat of studios.values()) if (seat.sculpture.update(t)) busy = true;
      render();
      if (busy) animRaf = rendererLease.requestFrame(step);
    };
    animRaf = rendererLease.requestFrame(step);
  };
  const studioKey = (v: RoomVessel) => v.studio ? JSON.stringify([v.studio.piece.id, v.studio.fired, v.studio.piece.sculpt, v.studio.piece.paint, v.studio.piece.charms ?? null]) : "";
  const buildStudio = (vessel: RoomVessel): StudioSeat => {
    const sculpture = createKittySculpture(vessel.studio!.piece, { brass: "#c99a4b", wood: "#62412b", fired: vessel.studio!.fired, reducedMotion: options.reducedMotion, onAnimate: animate });
    sculpture.setOpen(false);
    sculpture.setSpin(0);
    sculpture.setIdle(false);
    // Measured at full growth: the seat is the size a full bank stands at, so an empty one visibly has room to grow into.
    sculpture.setFill(10, false);
    const bounds = new THREE.Box3().setFromObject(sculpture.group);
    sculpture.setFill(vessel.studio!.step, false);
    sculpture.group.name = `queen-room-studio-${vessel.id}`;
    vesselsGroup.add(sculpture.group);
    return { sculpture, height: Math.max(0.5, bounds.max.y - bounds.min.y), key: studioKey(vessel), vessel };
  };
  const poseStudio = (seat: StudioSeat, next: RoomVessel) => {
    const before = seat.vessel.studio?.step ?? 0;
    seat.vessel = next;
    const step = next.studio?.step ?? 0;
    // Watching it fill: a deposit swells the cat with the studio's squash and sparkle; using money slims it.
    if (step !== before) seat.sculpture.setFill(step, true);
    seat.sculpture.group.rotation.z = next.refusing ? 0.16 : 0;
  };
  const dropStudio = (seat: StudioSeat) => { seat.sculpture.group.removeFromParent(); seat.sculpture.dispose(); };


  // ---- Jonathan's models (2026-09-16) -------------------------------------
  // Each model loads once and is a shared template; a seat is two clones of
  // its scene graph that share its geometry. The lower clone wears the model's
  // own materials (cloned only to carry a clipping plane) and stands below the
  // fill line; the upper clone wears one chalky bisque and stands above it —
  // the kiln grammar the drawn jars already use, without touching a mesh.
  type ModelTemplate = { state: "loading" | "ready" | "failed"; template: THREE.Object3D | null; height: number; lift: number };
  const templates = new Map<BankModelKey, ModelTemplate>();
  const modelLoad = new AbortController();
  cleanup.push(() => modelLoad.abort());
  const loadModel = options.loadModel === undefined ? loadBankModel : options.loadModel;
  let lastVessels: readonly RoomVessel[] = [];
  const templateFor = (key: BankModelKey): ModelTemplate => {
    const known = templates.get(key);
    if (known) return known;
    const entry: ModelTemplate = { state: loadModel && bankModelFor(key) ? "loading" : "failed", template: null, height: 1, lift: 0 };
    templates.set(key, entry);
    if (entry.state === "loading") {
      loadModel!(key, modelLoad.signal)
        .then((template) => {
          if (dead) return;
          template.updateWorldMatrix(true, true);
          const bounds = new THREE.Box3().setFromObject(template);
          entry.template = template;
          entry.height = Math.max(0.05, bounds.max.y - bounds.min.y);
          entry.lift = -bounds.min.y;
          entry.state = "ready";
          api.setVessels(lastVessels);
        })
        .catch(() => { if (dead) return; entry.state = "failed"; api.setVessels(lastVessels); });
    }
    return entry;
  };
  cleanup.push(() => {
    for (const entry of templates.values()) {
      if (!entry.template) continue;
      const owned = queenModelResources(entry.template);
      for (const g of owned.geometries) g.dispose();
      for (const m of owned.materials) m.dispose();
      for (const t of owned.textures) t.dispose();
    }
    templates.clear();
  });
  // Frosted glass that still writes depth, so only the model's outer surface shows and its insides don't crowd the glass.
  const frostModel = mat(new THREE.MeshPhysicalMaterial({ color: "#dde8ee", roughness: 0.28, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.2, transparent: true, opacity: 0.45 }));
  type ModelSeat = { group: THREE.Group; glazed: THREE.Object3D; bisque: THREE.Object3D; below: THREE.Plane; above: THREE.Plane; own: THREE.Material[]; bisqueMat: THREE.Material; height: number; lift: number; key: string; vessel: RoomVessel };
  const modelSeats = new Map<string, ModelSeat>();
  const modelSeatKey = (v: RoomVessel) => `${v.model!.key}:${v.model!.glass ? "glass" : "clay"}`;
  const buildModel = (vessel: RoomVessel, entry: ModelTemplate): ModelSeat => {
    const group = new THREE.Group();
    group.name = `queen-room-model-${vessel.id}`;
    const holder = new THREE.Group();
    holder.position.y = entry.lift;
    group.add(holder);
    const below = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const above = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const own: THREE.Material[] = [];
    const glazed = entry.template!.clone(true);
    const bisque = entry.template!.clone(true);
    const glass = Boolean(vessel.model!.glass);
    const bisqueMat = new THREE.MeshPhysicalMaterial({ color: "#e6ddce", roughness: 0.94, metalness: 0, clearcoat: 0, clippingPlanes: [above] });
    const copies = new Map<string, THREE.Material>();
    glazed.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const swap = (m: THREE.Material) => {
        let copy = copies.get(m.uuid);
        if (!copy) { copy = m.clone(); copy.clippingPlanes = [below]; copies.set(m.uuid, copy); own.push(copy); }
        return copy;
      };
      node.material = Array.isArray(node.material) ? node.material.map(swap) : swap(node.material);
    });
    bisque.traverse((node) => {
      if (node instanceof THREE.Mesh) node.material = glass ? frostModel : bisqueMat;
    });
    glazed.visible = !glass;
    holder.add(glazed, bisque);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.name = "queen-room-vessel-shadow";
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    shadow.scale.setScalar(0.8);
    group.add(shadow);
    vesselsGroup.add(group);
    return { group, glazed, bisque, below, above, own, bisqueMat, height: entry.height, lift: entry.lift, key: modelSeatKey(vessel), vessel };
  };
  /** Where the fill line stands in the world, from the seat's own place and scale. */
  const placeFillLine = (seat: ModelSeat) => {
    const v = seat.vessel;
    if (v.model?.glass) { seat.above.constant = 1e4; seat.glazed.visible = false; seat.bisque.visible = true; return; }
    const band = fillBand(v.fill);
    const line = seat.group.position.y + seat.group.scale.y * seat.height * (band / BANDS);
    seat.below.constant = band >= BANDS ? 1e4 : line;
    seat.above.constant = -line;
    seat.glazed.visible = band > 0;
    seat.bisque.visible = band < BANDS;
  };
  const poseModel = (seat: ModelSeat, next: RoomVessel) => {
    seat.vessel = next;
    seat.group.rotation.z = next.refusing ? 0.16 : next.outlier ? 0.1 : 0;
    placeFillLine(seat);
  };
  const dropModel = (seat: ModelSeat) => {
    seat.group.removeFromParent();
    seat.group.clear();
    for (const m of seat.own) m.dispose();
    seat.bisqueMat.dispose();
  };

  // ---- placement ---------------------------------------------------------
  let hostRect: RoomRect = { x: 0, y: 0, w: host.clientWidth, h: host.clientHeight };
  let unitsPerPx = VISIBLE_HEIGHT / Math.max(1, host.clientHeight);
  let lastLayoutKey = "";
  const toWorld = (rect: RoomRect, px: number, py: number): [number, number] => [
    (px - (rect.x + rect.w / 2)) * unitsPerPx,
    ((rect.y + rect.h / 2) - py) * unitsPerPx,
  ];

  const stats: RoomStats = { frames: 0, lastFrameMs: 0, maxFrameMs: 0, vessels: 0, ambient: false, geometries: 0 };
  let dead = false, pending = 0, raf = 0, started = 0;
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
  const invalidate = () => { if (dead || pending) return; pending = rendererLease.requestFrame(() => { pending = 0; render(); }); };

  const seatMatrix = new THREE.Object3D();
  const tick = (seconds: number) => {
    for (const row of swaying) row.object.rotation.z = Math.sin(seconds * row.speed + row.phase) * row.amount;
    if (motes) {
      for (const [i, row] of moteSeeds.entries()) {
        seatMatrix.position.set(row.x + Math.sin(seconds * row.speed * 0.6 + row.phase) * 0.5, row.y + ((seconds * row.speed + row.phase) % 5) - 2.5, row.z);
        seatMatrix.updateMatrix();
        motes.setMatrixAt(i, seatMatrix.matrix);
      }
      motes.instanceMatrix.needsUpdate = true;
    }
  };
  const frame = (t: number) => {
    raf = 0;
    if (dead || !stats.ambient) return;
    if (!started) started = t;
    tick((t - started) / 1000);
    render();
    raf = rendererLease.requestFrame(frame);
  };
  const pump = () => { if (!dead && stats.ambient && !raf) { started = 0; raf = rendererLease.requestFrame(frame); } };
  const halt = () => { if (raf) rendererLease.cancelFrame(raf); raf = 0; };
  suspendRenderer = () => { halt(); if (pending) rendererLease.cancelFrame(pending); pending = 0; if (animRaf) rendererLease.cancelFrame(animRaf); animRaf = 0; };
  resumeRenderer = () => { if (hostRect.w && hostRect.h) { renderer.setSize(hostRect.w, hostRect.h, false); renderer.domElement.style.width = `${hostRect.w}px`; renderer.domElement.style.height = `${hostRect.h}px`; } invalidate(); animate(); pump(); };
  const onHidden = () => { if (typeof document !== "undefined" && document.hidden) halt(); else pump(); };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onHidden);
    cleanup.push(() => document.removeEventListener("visibilitychange", onHidden));
  }
  const lost = (event: Event) => { event.preventDefault(); options.onLost?.(); };
  cleanup.push(rendererLease.listenCanvas("webglcontextlost", lost));

  const api = {
    scene,
    camera,
    renderer,
    room: options.room,
    stats: () => ({ ...stats, vessels: seats.size + studios.size + modelSeats.size, models: modelSeats.size, geometries: geometries.size }),
    /** The vessels on the rail or the ledge, by id. Rebuilt only for ids that arrive or leave. */
    setVessels(incoming: readonly RoomVessel[]) {
      if (dead) return;
      lastVessels = incoming;
      const seen = new Set<string>();
      const list: RoomVessel[] = [];
      for (const vessel of incoming) {
        if (!vessel.model) { list.push(vessel); continue; }
        const entry = templateFor(vessel.model.key);
        // Still on its way: stand nothing here yet, so no drawn jar flashes up first.
        if (entry.state === "loading") continue;
        if (entry.state === "failed") {
          const { model, ...rest } = vessel;
          list.push({ ...rest, ...(model.glass ? { frosted: true } : {}) });
          continue;
        }
        seen.add(vessel.id);
        const drawn = seats.get(vessel.id);
        if (drawn) { drawn.group.removeFromParent(); drawn.group.clear(); seats.delete(vessel.id); }
        const staleStudio = studios.get(vessel.id);
        if (staleStudio) { dropStudio(staleStudio); studios.delete(vessel.id); }
        const known = modelSeats.get(vessel.id);
        if (known && known.key === modelSeatKey(vessel)) { poseModel(known, vessel); continue; }
        if (known) dropModel(known);
        const seat = buildModel(vessel, entry);
        modelSeats.set(vessel.id, seat);
        poseModel(seat, vessel);
      }
      for (const vessel of list) {
        seen.add(vessel.id);
        const staleModel = modelSeats.get(vessel.id);
        if (staleModel) { dropModel(staleModel); modelSeats.delete(vessel.id); }
        if (vessel.studio) {
          const drawn = seats.get(vessel.id);
          if (drawn) { drawn.group.removeFromParent(); drawn.group.clear(); seats.delete(vessel.id); }
          const known = studios.get(vessel.id);
          if (known && known.key === studioKey(vessel)) { poseStudio(known, vessel); continue; }
          if (known) dropStudio(known);
          studios.set(vessel.id, buildStudio(vessel));
          continue;
        }
        const stale = studios.get(vessel.id);
        if (stale) { dropStudio(stale); studios.delete(vessel.id); }
        const old = seats.get(vessel.id);
        // A change of kind, hollowness or part count is a different vessel; everything else is a pose.
        if (old && old.vessel.kind === vessel.kind && old.vessel.form === vessel.form && old.vessel.tint === vessel.tint && old.vessel.finish === vessel.finish && old.vessel.hollow === vessel.hollow && old.vessel.frosted === vessel.frosted && old.vessel.parts === vessel.parts) {
          old.vessel = vessel;
          poseVessel(old);
          continue;
        }
        if (old) { old.group.removeFromParent(); old.group.clear(); seats.delete(vessel.id); }
        const seat = buildVessel(vessel);
        seats.set(vessel.id, seat);
        poseVessel(seat);
      }
      for (const [id, seat] of seats) if (!seen.has(id)) { seat.group.removeFromParent(); seat.group.clear(); seats.delete(id); }
      for (const [id, seat] of studios) if (!seen.has(id)) { dropStudio(seat); studios.delete(id); }
      for (const [id, seat] of modelSeats) if (!seen.has(id)) { dropModel(seat); modelSeats.delete(id); }
      lastLayoutKey = "";
      invalidate();
    },
    /** Put every vessel where the DOM keeps its control, and the room where the host is. */
    layout(next: RoomLayout) {
      if (dead || !next.host.w || !next.host.h) return;
      const key = JSON.stringify([next.host, next.seats, next.stage ?? null]);
      if (key === lastLayoutKey) return;
      lastLayoutKey = key;
      hostRect = next.host;
      unitsPerPx = VISIBLE_HEIGHT / hostRect.h;
      camera.aspect = hostRect.w / hostRect.h;
      camera.updateProjectionMatrix();
      renderer.setSize(hostRect.w, hostRect.h, false);
      if (rendererLease.active) {
        renderer.domElement.style.width = `${hostRect.w}px`;
        renderer.domElement.style.height = `${hostRect.h}px`;
      }
      let floor = -VISIBLE_HEIGHT / 2;
      let tallest = 0;
      for (const [id, seat] of seats) {
        const rect = next.seats[id];
        seat.group.visible = Boolean(rect);
        if (!rect) continue;
        const [x, y] = toWorld(hostRect, rect.x + rect.w / 2, rect.y + rect.h);
        const scale = (rect.h * unitsPerPx) / VESSEL_HEIGHT;
        seat.group.position.set(x, y + (seat.vessel.lifted ? scale * 0.14 : 0), seat.vessel.outlier ? 0.6 : 0);
        seat.group.scale.setScalar(scale);
        floor = y;
        tallest = Math.max(tallest, scale);
      }
      for (const [id, seat] of studios) {
        const rect = next.seats[id];
        seat.sculpture.group.visible = Boolean(rect);
        if (!rect) continue;
        const [x, y] = toWorld(hostRect, rect.x + rect.w / 2, rect.y + rect.h);
        const scale = (rect.h * unitsPerPx) / seat.height;
        seat.sculpture.group.position.set(x, y + (seat.vessel.lifted ? rect.h * unitsPerPx * 0.14 : 0), 0);
        seat.sculpture.group.scale.setScalar(scale);
        floor = y;
        // The room's furniture follows the tallest bank on the rack, whatever its size.
        tallest = Math.max(tallest, Math.min(1.6, rect.h * unitsPerPx));
      }
      for (const [id, seat] of modelSeats) {
        const rect = next.seats[id];
        seat.group.visible = Boolean(rect);
        if (!rect) continue;
        const [x, y] = toWorld(hostRect, rect.x + rect.w / 2, rect.y + rect.h);
        const scale = (rect.h * unitsPerPx) / seat.height;
        seat.group.position.set(x, y + (seat.vessel.lifted ? rect.h * unitsPerPx * 0.14 : 0), seat.vessel.outlier ? 0.6 : 0);
        seat.group.scale.setScalar(scale);
        placeFillLine(seat);
        floor = y;
        tallest = Math.max(tallest, Math.min(1.6, rect.h * unitsPerPx));
      }
      // The cellar's rail is its own floor now that jars are sized by dollars: the furniture stands on the rail at a fixed scale.
      if (next.stage) {
        floor = toWorld(hostRect, 0, next.stage.y + next.stage.h - next.stage.floor)[1];
        tallest = Math.max(0.35, Math.min(90, next.stage.h - next.stage.floor) * unitsPerPx);
      }
      // The room's floor is the shelf the vessels stand on, and it grows with them.
      interior.position.set(0, floor, 0);
      interior.scale.setScalar(Math.max(0.35, tallest || 1));
      // The rack: one board per shelf, in the scene (not the interior) so a shelf stands exactly on its DOM row whatever the interior's scale.
      const shelfRects = next.shelves ?? [];
      if (ledgeParts) { ledgeParts.ledge.visible = shelfRects.length <= 1; ledgeParts.lip.visible = shelfRects.length <= 1; }
      while (boards.length < shelfRects.length && ledgeParts) {
        const board = new THREE.Group();
        board.name = "queen-loft-board";
        const plank = new THREE.Mesh(box, ledgeParts.wood); plank.name = "queen-loft-board-plank"; plank.scale.set(1, 0.16, 2.6); plank.position.set(0, -0.1, -1.6); board.add(plank);
        const edge = new THREE.Mesh(box, ledgeParts.beam); edge.name = "queen-loft-board-lip"; edge.scale.set(1, 0.07, 0.14); edge.position.set(0, -0.05, -0.32); board.add(edge);
        for (const side of [-1, 1] as const) { const bracket = new THREE.Mesh(box, ledgeParts.beam); bracket.name = "queen-loft-board-bracket"; bracket.scale.set(0.05, 0.34, 0.05); bracket.position.set(side * 0.44, -0.35, -1.2); board.add(bracket); }
        scene.add(board); boards.push(board);
      }
      boards.forEach((board, i) => {
        const r = shelfRects[i];
        board.visible = shelfRects.length > 1 && Boolean(r);
        if (!r) return;
        const [x, y] = toWorld(hostRect, r.x + r.w / 2, r.y + r.h);
        const scale = Math.max(0.35, tallest || 1);
        board.position.set(x, y, 0);
        board.scale.set(r.w * unitsPerPx + 2 * scale, scale, scale);
      });
      invalidate();
    },
    /** Whether the room's dust moves. Off under reduced motion, a paused atmosphere or a hidden tab. */
    setAmbient(on: boolean) {
      const next = on && !options.reducedMotion;
      if (next === stats.ambient) return;
      stats.ambient = next;
      if (next) pump(); else { halt(); tick(0); invalidate(); }
    },
    invalidate,
    render,
    get disposed() { return dead; },
    dispose() {
      if (dead) return;
      dead = true;
      halt();
      if (pending) rendererLease.cancelFrame(pending);
      if (animRaf) rendererLease.cancelFrame(animRaf);
      for (const seat of seats.values()) { seat.group.removeFromParent(); seat.group.clear(); }
      seats.clear();
      for (const seat of studios.values()) dropStudio(seat);
      studios.clear();
      for (const seat of modelSeats.values()) dropModel(seat);
      modelSeats.clear();
      for (const release of cleanup.splice(0).reverse()) { try { release(); } catch { /* keep releasing */ } }
      scene.clear();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      geometries.clear(); materials.clear(); textures.clear();
      rendererLease.release();
    },
  };
  return api;
}
export type QueenRoomWorld = ReturnType<typeof createQueenRoomWorld>;
