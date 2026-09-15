import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { bankGeometry, buildBankVessel, type BankForm, type BankGeometry, type BankMaterials } from "./queenBankSculpture.ts";

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
};
export type RoomRect = { x: number; y: number; w: number; h: number };
export type RoomLayout = { host: RoomRect; seats: Record<string, RoomRect> };
export type RoomStats = { frames: number; lastFrameMs: number; maxFrameMs: number; vessels: number; ambient: boolean; geometries: number };

const VISIBLE_HEIGHT = 10;
const FOV = 34;
/** A vessel is authored one unit tall; the seat's height in world units is its scale. */
const VESSEL_HEIGHT = 1;

export function createQueenRoomWorld(host: HTMLElement, options: { room: QueenRoom; reducedMotion?: boolean; onLost?: () => void }) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power", preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = options.room === "cellar" ? 0.7 : 0.88;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.className = "queen-room-world__canvas";
  host.appendChild(renderer.domElement);

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
  try {
    const env = pmrem.fromScene(new RoomEnvironment(), 0.05);
    scene.environment = env.texture;
    cleanup.push(() => { env.dispose(); pmrem.dispose(); });
  } catch { pmrem.dispose(); }

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
  const bankMaterials: BankMaterials = { clay, glaze, deep: deepClay, brass: brassMat, ink: inkMat, ghost: ghostMat };
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

  type Seat = { group: THREE.Group; body: THREE.Mesh; glazeMesh: THREE.Mesh; shadow: THREE.Mesh; vessel: RoomVessel };
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
    return { group, body: built.body, glazeMesh: built.glaze, shadow, vessel };
  };
  /** The pose that carries the reading: the swell, the lift, the lean a lidded thing answers with. */
  const poseVessel = (seat: Seat) => {
    const v = seat.vessel;
    const swell = v.swell ?? 1;
    seat.group.rotation.z = v.refusing ? 0.16 : v.outlier ? 0.1 : 0;
    seat.body.scale.set(swell, 1, swell * 0.86);
    seat.glazeMesh.scale.set(swell * 0.94, Math.max(0.001, v.fill ?? 0), swell * 0.94 * 0.86);
    seat.glazeMesh.visible = !v.hollow && (v.fill ?? 0) > 0.01;
    seat.shadow.scale.setScalar(v.lifted ? 1.05 : 0.8);
    (seat.shadow.material as THREE.Material & { opacity: number }).opacity = v.lifted ? 0.12 : 0.2;
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
  const invalidate = () => { if (dead || pending) return; pending = requestAnimationFrame(() => { pending = 0; render(); }); };

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
    raf = requestAnimationFrame(frame);
  };
  const pump = () => { if (!dead && stats.ambient && !raf) { started = 0; raf = requestAnimationFrame(frame); } };
  const halt = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  const onHidden = () => { if (typeof document !== "undefined" && document.hidden) halt(); else pump(); };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onHidden);
    cleanup.push(() => document.removeEventListener("visibilitychange", onHidden));
  }
  const lost = (event: Event) => { event.preventDefault(); options.onLost?.(); };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  cleanup.push(() => renderer.domElement.removeEventListener("webglcontextlost", lost));

  return {
    scene,
    camera,
    renderer,
    room: options.room,
    stats: () => ({ ...stats, vessels: seats.size, geometries: geometries.size }),
    /** The vessels on the rail or the ledge, by id. Rebuilt only for ids that arrive or leave. */
    setVessels(list: readonly RoomVessel[]) {
      if (dead) return;
      const seen = new Set<string>();
      for (const vessel of list) {
        seen.add(vessel.id);
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
      lastLayoutKey = "";
      invalidate();
    },
    /** Put every vessel where the DOM keeps its control, and the room where the host is. */
    layout(next: RoomLayout) {
      if (dead || !next.host.w || !next.host.h) return;
      const key = JSON.stringify([next.host, next.seats]);
      if (key === lastLayoutKey) return;
      lastLayoutKey = key;
      hostRect = next.host;
      unitsPerPx = VISIBLE_HEIGHT / hostRect.h;
      camera.aspect = hostRect.w / hostRect.h;
      camera.updateProjectionMatrix();
      renderer.setSize(hostRect.w, hostRect.h, false);
      renderer.domElement.style.width = `${hostRect.w}px`;
      renderer.domElement.style.height = `${hostRect.h}px`;
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
      // The room's floor is the shelf the vessels stand on, and it grows with them.
      interior.position.set(0, floor, 0);
      interior.scale.setScalar(Math.max(0.35, tallest || 1));
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
      if (pending) cancelAnimationFrame(pending);
      for (const seat of seats.values()) { seat.group.removeFromParent(); seat.group.clear(); }
      seats.clear();
      for (const release of cleanup.splice(0).reverse()) { try { release(); } catch { /* keep releasing */ } }
      scene.clear();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      geometries.clear(); materials.clear(); textures.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
export type QueenRoomWorld = ReturnType<typeof createQueenRoomWorld>;
